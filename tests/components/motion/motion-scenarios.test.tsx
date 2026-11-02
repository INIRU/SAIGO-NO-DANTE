import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

const locale = vi.hoisted(() => ({ value: 'ko' }))
vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key, useLocale: () => locale.value }))
vi.mock('next/image', () => ({ default: ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} /> }))

import MotionScenarios from '@/components/motion/MotionScenarios'
import MotionSkillStrip from '@/components/motion/MotionSkillStrip'
import MotionTimeline, { chapterSpans, currentChapter } from '@/components/motion/MotionTimeline'
import { pickLinkState, toggleDeadState, type MotionPartner, type MotionSkill, type MotionState } from '@/lib/motion/catalog'
import type { VoiceLink } from '@/lib/motion/soundbuttons'

const state = (id: string, label: string, extra: Partial<MotionState> = {}): MotionState => ({ state: id, label, name: '', video: '', meta: '', bytes: 0, ...extra })
const person = (gameId: string, sinner: string): MotionPartner => ({ gameId, name: `흑수 ${gameId}`, sinner, portrait: `/p/${gameId}.webp` })
const link = (partners: MotionPartner[], max: boolean) => ({ link: { id: partners.map(p => p.gameId).join('+'), partners, max } })
const states = [
  state('v:base', '기본'),
  state('v:link-10114', '연계: 오', link([person('10114', '이상')], false)),
  state('v:link-10114-max', '연계: 오 (최대)', link([person('10114', '이상')], true)),
  state('v:link-10212', '연계: 묘', link([person('10212', '파우스트')], false)),
  state('v:link-10212-max', '연계: 묘 (최대)', link([person('10212', '파우스트')], true)),
  state('v:best', '최고 상태'),
]
const render = (current: string, list = states, voices: VoiceLink[] = []) => renderToStaticMarkup(<MotionScenarios states={list} current={current} onPick={() => {}} voices={voices} onVoice={async () => {}} onVoiceStop={() => {}} />)

describe('REQ-MOTION-046 scenarios', () => {
  it('REQ-MOTION-046 lists one row per video and each link once with its faces', () => {
    const html = render('v:base')
    expect(html.match(/data-scenario=/g)).toHaveLength(2)
    expect(html.match(/data-partner=/g)).toHaveLength(2)
    expect(html).toContain('/p/10114.webp')
    expect(html).toMatch(/aria-pressed="true"[^>]*data-scenario="v:base"/)
  })

  it('REQ-MOTION-046 shows the max switch only under the chosen link', () => {
    expect(render('v:base')).not.toContain('role="switch"')
    const normal = render('v:link-10114')
    expect(normal).toMatch(/aria-pressed="true"[^>]*data-partner="10114"/)
    expect(normal).toMatch(/<button[^>]*role="switch"[^>]*aria-checked="false"/)
    expect(render('v:link-10114-max')).toMatch(/<button[^>]*role="switch"[^>]*aria-checked="true"/)
  })

  it('REQ-MOTION-046 finds the video of a link at the chosen max, or its other video when that one is missing', () => {
    expect(pickLinkState(states, '10114', true)?.state).toBe('v:link-10114-max')
    expect(pickLinkState(states, '10212', false)?.state).toBe('v:link-10212')
    expect(pickLinkState(states.slice(0, 2), '10114', true)?.state).toBe('v:link-10114')
    expect(pickLinkState(states, '99999', false)).toBeUndefined()
  })

  it('REQ-MOTION-033 shows one row with every partner of a link', () => {
    const duo = [states[0], state('v:link-11216+11009', 'L', link([person('11216', '그레고르'), person('11009', '싱클레어')], false))]
    const html = render('v:link-11216+11009', duo)
    expect(html.match(/data-partner=/g)).toHaveLength(1)
    expect(html).toContain('/p/11216.webp')
    expect(html).toContain('/p/11009.webp')
  })

  const ids = ['10916', '10115', '11115', '10614']
  const abi = Object.fromEntries(ids.map((id, i) => [id, person(id, ['로쟈', '이상', '오티스', '홍루'][i])]))
  const dead = (...who: string[]) => state(`v:${who.map(id => `dead-${id}`).join('+')}`, 'x', { dead: who.map(id => abi[id]) })
  const list = [state('v:base', '기본'), state('v:best-3', '최고 상태'), dead('10916'), dead('10115'), dead('10916', '10115'), dead(...ids)]

  it('REQ-MOTION-046 shows the dead allies as cards in the order of the state with the most dead, the other videos as rows', () => {
    const html = render('v:dead-10916+dead-10115', list)
    expect([...html.matchAll(/data-dead="(\d+)"/g)].map(m => m[1])).toEqual(ids)
    expect(html).toMatch(/aria-pressed="true"[^>]*data-dead="10916"/)
    expect(html).toMatch(/aria-pressed="false"[^>]*data-dead="11115"/)
    expect(html).toContain('최고 상태')
    expect(html).not.toContain('>x<')
  })

  it('REQ-MOTION-046 turns a card on or off by opening the state with that set of dead, base with none', () => {
    expect(toggleDeadState(list, 'v:dead-10916', '10115')).toBe('v:dead-10916+dead-10115')
    expect(toggleDeadState(list, 'v:dead-10916+dead-10115', '10916')).toBe('v:dead-10115')
    expect(toggleDeadState(list, 'v:dead-10916', '10916')).toBe('v:base')
    expect(toggleDeadState(list, 'v:best-3', '10115')).toBe('v:dead-10115')
    expect(toggleDeadState(list, 'v:dead-10916', '10614')).toBeUndefined()
  })

  const voice = (id: string): VoiceLink => ({ id, identities: ['10315'], main: '10315', partners: [], dead: [], when: 'roundStart', label: `대사 ${id}`, labelEn: `Line ${id}`, cues: [], pools: [], seconds: 3 })

  it('REQ-MOTION-046 puts the link lines under the scenarios, in the page language (Japanese reads English)', () => {
    const html = render('v:base', [states[0], states[5]], [voice('a'), voice('b')])
    expect(html.match(/data-voice=/g)).toHaveLength(2)
    expect(html).toContain('대사 a')
    expect(html.indexOf('data-voice')).toBeGreaterThan(html.lastIndexOf('data-scenario'))
    locale.value = 'ja'
    try { expect(render('v:base', [states[0]], [voice('a')])).toContain('Line a') } finally { locale.value = 'ko' }
  })
})

describe('REQ-MOTION-044 the skill strip', () => {
  it('REQ-MOTION-044 draws each skill in the game frame from the icon it is given, a line before another form', () => {
    const skill = (key: string, skillId: number, form: string | null): MotionSkill => ({ key, skillId, title: `s${skillId}`, form, states: [], frame: { sin: 'gloom', slot: 2, attack: 'pierce' } })
    const html = renderToStaticMarkup(<MotionSkillStrip icon={s => `/icon/${s.skillId}.webp`} skills={[skill('a', 1061301, null), skill('b', 1061302, null), skill('c', 1061391, 'awaken')]} selectedKey="b" onPick={() => {}} />)
    expect(html.match(/<button/g)).toHaveLength(3)
    expect(html.match(/skill-frame/gi)?.length).toBeGreaterThanOrEqual(3)
    expect(html).toContain('/icon/1061301.webp')
    expect(html).toMatch(/aria-pressed="true"[^>]*aria-label="s1061302"/)
    expect(html.match(/data-form-divider/g)).toHaveLength(1)
  })
})

describe('REQ-MOTION-041 the timeline', () => {
  const chapters = [{ f: 0, kind: 'skill' as const, key: '<s:1>' }, { f: 100, kind: 'coin' as const, key: '<coin:1>' }]
  const store = { subscribe: () => () => {}, get: () => 150 }

  it('REQ-MOTION-041 splits the track at the chapters, whole when there are none', () => {
    expect(chapterSpans(chapters, 300)).toEqual([{ from: 0, to: 100 }, { from: 100, to: 300 }])
    expect(chapterSpans([], 300)).toEqual([{ from: 0, to: 300 }])
    // A first chapter after frame 0 leaves no gap at the start of the track.
    expect(chapterSpans([{ f: 30, kind: 'skill', key: '' }], 300)).toEqual([{ from: 0, to: 30 }, { from: 30, to: 300 }])
  })

  it('REQ-MOTION-041 finds the chapter of a frame', () => {
    expect(currentChapter(chapters, 0)?.f).toBe(0)
    expect(currentChapter(chapters, 99)?.f).toBe(0)
    expect(currentChapter(chapters, 100)?.f).toBe(100)
    expect(currentChapter([], 10)).toBeUndefined()
  })

  it('REQ-MOTION-041 stands a mark on the track at its frame, higher for a critical hit, and merges the targets of one frame', () => {
    const marks = [{ f: 60, kind: 'hit' as const }, { f: 60, kind: 'hit' as const }, { f: 150, kind: 'hit' as const, critical: true }, { f: 200, kind: 'kill' as const }, { f: 250, kind: 'hit' as const, kill: true }]
    const html = renderToStaticMarkup(<MotionTimeline store={store} frames={300} chapters={chapters} marks={marks} label="frame" onSeek={() => {}} />)
    expect(html.match(/data-mark=/g)).toHaveLength(4)
    expect(html).toContain('data-mark="critical"')
    expect(html).toContain('data-mark="kill"')
    expect(html).toMatch(/<input[^>]*aria-label="frame"/)
  })
})

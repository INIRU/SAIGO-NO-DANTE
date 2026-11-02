import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

const locale = vi.hoisted(() => ({ value: 'ko' }))
vi.mock('next-intl', () => ({ useTranslations: () => (key: string, values?: { n: number }) => (values ? `${key} ${values.n}` : key), useLocale: () => locale.value }))
vi.mock('next/image', () => ({ default: ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} /> }))

import MotionScenarios from '@/components/motion/MotionScenarios'
import MotionSkillStrip from '@/components/motion/MotionSkillStrip'
import MotionTimeline, { chapterSpans, currentChapter } from '@/components/motion/MotionTimeline'
import { pickLinkState, type MotionPartner, type MotionSkill, type MotionState } from '@/lib/motion/catalog'
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

  const buffs = [{ name: '해금 - II', icon: '/k/unlock.webp', stack: '1' }, { name: '대행 [헤르메스]', icon: null, stack: '9' }]

  it('REQ-MOTION-046 writes a scenario from the game values and drops the sentence', () => {
    const html = render('v:base', [state('v:base', '기본'), state('v:form', '가면 벗음', { conditions: buffs, extras: [{ text: '치명타', icon: null }, { text: '색욕 공명 4', icon: '/sins/lust.webp' }] })])
    expect(html).not.toContain('가면 벗음')
    expect(html.indexOf('/k/unlock.webp')).toBeLessThan(html.indexOf('해금 - II'))
    expect(html).toContain('대행 [헤르메스]')
    expect(html).toContain('치명타')
    expect(html.indexOf('/sins/lust.webp')).toBeLessThan(html.indexOf('색욕 공명 4'))
    expect(html).toContain('>normal<')
    expect(html).not.toContain('<h3')
  })

  it('REQ-MOTION-046 keeps a scenario the data says nothing about: its sentence in Korean, a number elsewhere', () => {
    const list = [state('v:base', '기본'), state('v:head', '코인 앞면'), state('v:1', '하나', { conditions: buffs }), state('v:2', '둘', { conditions: buffs })]
    const ko = render('v:base', list)
    expect(ko).toContain('코인 앞면')
    expect(ko).toContain('하나')
    expect(ko).toContain('둘')
    locale.value = 'en'
    try {
      const en = render('v:base', list)
      expect(en).not.toContain('코인 앞면')
      expect(en).toContain('scenarioNumber 2')
      expect(en).toContain('scenarioNumber 4')
    } finally { locale.value = 'ko' }
  })

  it('REQ-MOTION-046 writes a cut-in as the ally\'s face and the buff', () => {
    const list = [states[0], state('v:b', '차원 표류 1', { conditions: [{ name: '차원 표류', icon: '/k/d.webp', stack: '1' }] }), state('v:cutin', '아군 공격 뒤 끼어듦 (차원 표류 1)', { conditions: [{ name: '차원 표류', icon: '/k/d.webp', stack: '1' }] })]
    const html = renderToStaticMarkup(<MotionScenarios states={list} current="v:base" allies={{ 'v:cutin': person('10201', '파우스트') }} onPick={() => {}} voices={[]} onVoice={async () => {}} onVoiceStop={() => {}} />)
    expect(html).not.toContain('끼어듦')
    expect(html.lastIndexOf('/p/10201.webp')).toBeGreaterThan(html.indexOf('data-scenario="v:cutin"'))
  })

  it('REQ-MOTION-046 shows the ally of a formation by its face', () => {
    expect(render('v:base', [states[0], state('v:with-10114', '아군 오', { ally: person('10114', '이상') })])).toContain('/p/10114.webp')
  })

  it('REQ-MOTION-033 shows one row with every partner of a link', () => {
    const duo = [states[0], state('v:link-11216+11009', 'L', link([person('11216', '그레고르'), person('11009', '싱클레어')], false))]
    const html = render('v:link-11216+11009', duo)
    expect(html.match(/data-partner=/g)).toHaveLength(1)
    expect(html).toContain('/p/11216.webp')
    expect(html).toContain('/p/11009.webp')
  })

  it('REQ-MOTION-046 lists the dead allies as rows with their faces', () => {
    const list = [state('v:base', '기본'), state('v:dead-1', '아비 사망', { dead: [person('10115', '이상')] }), state('v:dead-all', '4명 사망', { dead: [person('10115', '이상'), person('10916', '로쟈')] })]
    const html = render('v:dead-all', list)
    expect(html).toMatch(/aria-pressed="true"[^>]*data-scenario="v:dead-all"/)
    expect(html).toContain('/p/10916.webp')
    // A dead ally's face is grey; an ally who plays along is not.
    expect(html).toMatch(/data-dead="true"[^>]*title="[^"]*로쟈/)
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

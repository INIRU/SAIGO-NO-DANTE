import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

const locale = vi.hoisted(() => ({ value: 'ko' }))
vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key, useLocale: () => locale.value }))
vi.mock('next/image', () => ({ default: ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} /> }))

import MotionConditions from '@/components/motion/MotionConditions'
import MotionSkillStrip from '@/components/motion/MotionSkillStrip'
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
const render = (current: string, list = states, voices: VoiceLink[] = []) => renderToStaticMarkup(<MotionConditions states={list} current={current} onPick={() => {}} voices={voices} onVoice={async () => {}} onVoiceStop={() => {}} />)

describe('REQ-MOTION-019 skill strip and conditions', () => {
  it('REQ-MOTION-019 lists the plain states as text choices and each link once as a portrait tile', () => {
    const html = render('v:base')
    expect(html.match(/data-partner=/g)).toHaveLength(2)
    expect(html).toContain('>이상<')
    expect(html).toContain('>파우스트<')
    expect(html).not.toContain('연계: 오')
    expect(html).toMatch(/aria-pressed="true"[^>]*><span>기본<\/span>/)
    expect(html).toContain('>link<')
  })

  it('REQ-MOTION-019 marks the chosen link and sets the max switch from it', () => {
    const normal = render('v:link-10114')
    expect(normal).toMatch(/aria-pressed="true"[^>]*data-partner="10114"/)
    expect(normal).toMatch(/<button[^>]*role="switch"[^>]*aria-checked="false"/)
    expect(render('v:link-10114-max')).toMatch(/<button[^>]*role="switch"[^>]*aria-checked="true"/)
    // A skill without links has no link section and no switch.
    expect(render('v:base', [states[0], states[5]])).not.toContain('role="switch"')
  })

  it('REQ-MOTION-019 finds the video of a link at the chosen max, or its other video when that one is missing', () => {
    expect(pickLinkState(states, '10114', true)?.state).toBe('v:link-10114-max')
    expect(pickLinkState(states, '10212', false)?.state).toBe('v:link-10212')
    expect(pickLinkState(states.slice(0, 2), '10114', true)?.state).toBe('v:link-10114')
    expect(pickLinkState(states, '99999', false)).toBeUndefined()
  })

  it('REQ-MOTION-019 shows the identity skills as icons, a line before another form, the chosen one pressed', () => {
    const skill = (key: string, skillId: number, form: string | null): MotionSkill => ({ key, skillId, title: `s${skillId}`, form, states: [], frame: { sin: 'gloom', slot: 2, attack: 'pierce' } })
    const html = renderToStaticMarkup(<MotionSkillStrip sinnerId="hong-lu" skills={[skill('a', 1061301, null), skill('b', 1061302, null), skill('c', 1061391, 'awaken')]} selectedKey="b" onPick={() => {}} />)
    expect(html.match(/<button/g)).toHaveLength(3)
    // Each sprite sits in the game's skill frame of its sin and slot, with its attack type badge.
    expect(html.match(/skill-frame/gi)?.length).toBeGreaterThanOrEqual(3)
    expect(html).toMatch(/aria-pressed="true"[^>]*aria-label="s1061302"/)
    expect(html.match(/data-form-divider/g)).toHaveLength(1)
  })
})

describe('REQ-MOTION-033 a link with several partners', () => {
  it('REQ-MOTION-033 shows one tile with every partner\'s face and sinner', () => {
    const duo = [states[0], state('v:link-11216+11009', 'L', link([person('11216', '그레고르'), person('11009', '싱클레어')], false))]
    const html = render('v:link-11216+11009', duo)
    expect(html.match(/data-partner=/g)).toHaveLength(1)
    expect(html).toMatch(/data-partner="11216\+11009"/)
    expect(html).toContain('/p/11216.webp')
    expect(html).toContain('/p/11009.webp')
    expect(html).toContain('그레고르 · 싱클레어')
  })
})

describe('REQ-MOTION-034 the 아비 cards of 공간참 - 잔', () => {
  const ids = ['10916', '10115', '11115', '10614']
  const abi = Object.fromEntries(ids.map((id, i) => [id, person(id, ['로쟈', '이상', '오티스', '홍루'][i])]))
  const dead = (...who: string[]) => state(`v:${who.map(id => `dead-${id}`).join('+')}`, 'x', { dead: who.map(id => abi[id]) })
  const list = [state('v:base', '기본'), state('v:best-3', '최고 상태'), dead('10916'), dead('10115'), dead('10916', '10115'), dead(...ids)]

  it('REQ-MOTION-034 shows the four 아비 as cards in the order of the state with the most dead, the dead ones pressed, the other states as text', () => {
    const html = render('v:dead-10916+dead-10115', list)
    expect([...html.matchAll(/data-dead="(\d+)"/g)].map(m => m[1])).toEqual(ids)
    expect(html).toMatch(/aria-pressed="true"[^>]*data-dead="10916"/)
    expect(html).toMatch(/aria-pressed="false"[^>]*data-dead="11115"/)
    expect(html).toContain('>최고 상태<')
    expect(html).not.toMatch(/<span>x<\/span>/)
  })

  it('REQ-MOTION-034 turns a card on or off by opening the state with that set of dead, base with none', () => {
    expect(toggleDeadState(list, 'v:dead-10916', '10115')).toBe('v:dead-10916+dead-10115')
    expect(toggleDeadState(list, 'v:dead-10916+dead-10115', '10916')).toBe('v:dead-10115')
    expect(toggleDeadState(list, 'v:dead-10916', '10916')).toBe('v:base')
    // From a state outside the cards (the best state): that card alone.
    expect(toggleDeadState(list, 'v:best-3', '10115')).toBe('v:dead-10115')
    // A set the index has no video for: nothing.
    expect(toggleDeadState(list, 'v:dead-10916', '10614')).toBeUndefined()
  })
})

describe('REQ-MOTION-035 the sound buttons of the link section', () => {
  const voice = (id: string): VoiceLink => ({ id, identities: ['10315'], main: '10315', partners: [], dead: [], when: 'roundStart', label: `대사 ${id}`, labelEn: `Line ${id}`, cues: [], pools: [], seconds: 3 })

  it('REQ-MOTION-035 puts a button per line in the link section, even for a skill with no link state, in the page language (Japanese reads English)', () => {
    const html = render('v:base', [states[0], states[5]], [voice('a'), voice('b')])
    expect(html).toContain('>link<')
    expect(html.match(/data-voice=/g)).toHaveLength(2)
    expect(html).toContain('대사 a')
    expect(html).not.toContain('role="switch"')
    locale.value = 'ja'
    try { expect(render('v:base', [states[0]], [voice('a')])).toContain('Line a') } finally { locale.value = 'ko' }
  })
})

describe('REQ-MOTION-019 columns without stray scrollbars', () => {
  it('REQ-MOTION-019 leaves the scrollbars to the site style', async () => {
    const { readFileSync } = await import('node:fs')
    // scrollbar-width replaces the site's gold ::-webkit-scrollbar (app/globals.css) with the system bar in Chrome.
    expect(readFileSync('components/motion/SkillMotionViewer.tsx', 'utf8')).not.toContain('scrollbar-width:thin')
  })
})

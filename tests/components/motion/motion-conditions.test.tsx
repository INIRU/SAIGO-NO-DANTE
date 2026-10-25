import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }))
vi.mock('next/image', () => ({ default: ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} /> }))

import MotionConditions from '@/components/motion/MotionConditions'
import MotionSkillStrip from '@/components/motion/MotionSkillStrip'
import { pickLinkState, type MotionSkill, type MotionState } from '@/lib/motion/catalog'

const state = (id: string, label: string, link?: MotionState['link']): MotionState => ({ state: id, label, name: '', video: '', meta: '', bytes: 0, ...(link && { link }) })
const partner = (gameId: string, sinner: string, max: boolean) => ({ gameId, name: `흑수 ${gameId}`, sinner, portrait: `/p/${gameId}.webp`, max })
const states = [
  state('v:base', '기본'),
  state('v:link-10114', '연계: 오', partner('10114', '이상', false)),
  state('v:link-10114-max', '연계: 오 (최대)', partner('10114', '이상', true)),
  state('v:link-10212', '연계: 묘', partner('10212', '파우스트', false)),
  state('v:link-10212-max', '연계: 묘 (최대)', partner('10212', '파우스트', true)),
  state('v:best', '최고 상태'),
]
const render = (current: string) => renderToStaticMarkup(<MotionConditions states={states} current={current} onPick={() => {}} />)

describe('REQ-MOTION-019 skill strip and conditions', () => {
  it('REQ-MOTION-019 lists the plain states as text choices and each link partner once as a portrait tile', () => {
    const html = render('v:base')
    expect(html.match(/data-partner=/g)).toHaveLength(2)
    expect(html).toContain('>이상<')
    expect(html).toContain('>파우스트<')
    expect(html).not.toContain('연계: 오')
    expect(html).toMatch(/aria-pressed="true"[^>]*><span>기본<\/span>/)
    expect(html).toContain('>link<')
  })

  it('REQ-MOTION-019 marks the chosen partner and sets the max switch from the chosen link', () => {
    const normal = render('v:link-10114')
    expect(normal).toMatch(/aria-pressed="true"[^>]*data-partner="10114"/)
    expect(normal).toMatch(/<button[^>]*role="switch"[^>]*aria-checked="false"/)
    expect(render('v:link-10114-max')).toMatch(/<button[^>]*role="switch"[^>]*aria-checked="true"/)
    // A skill without links has no link section and no switch.
    expect(renderToStaticMarkup(<MotionConditions states={[states[0], states[5]]} current="v:base" onPick={() => {}} />)).not.toContain('role="switch"')
  })

  it('REQ-MOTION-019 finds the video of a partner at the chosen max, or its other video when that one is missing', () => {
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

describe('REQ-MOTION-019 columns without stray scrollbars', () => {
  it('REQ-MOTION-019 leaves the scrollbars to the site style', async () => {
    const { readFileSync } = await import('node:fs')
    // scrollbar-width replaces the site's gold ::-webkit-scrollbar (app/globals.css) with the system bar in Chrome.
    expect(readFileSync('components/motion/SkillMotionViewer.tsx', 'utf8')).not.toContain('scrollbar-width:thin')
  })
})

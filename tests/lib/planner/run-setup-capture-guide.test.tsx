import { expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import RunSetup from '@/components/planner/run/RunSetup'
import { createInitialRunState } from '@/lib/planner/run-types'

vi.mock('next-intl', () => ({
  useLocale: () => 'ko',
  useTranslations: () => (key: string, values?: Record<string, string>) => values ? `${key}(${Object.values(values).join(',')})` : key,
}))

it('guides the real order: hold the game before Enter, start here, connect, then enter', () => {
  const html = renderToStaticMarkup(<RunSetup state={createInitialRunState('hard')} dispatch={() => {}} gifts={[]} giftMap={new Map()} identities={[]} sinners={[]} egos={[]} />)
  const guide = html.slice(html.indexOf('data-capture-guide'), html.indexOf('</ol>'))
  const steps = guide.match(/<li\b[\s\S]*?<\/li>/g)!
  expect(steps).toHaveLength(4)
  expect(steps.map(step => /captureGuideStep\d/.exec(step)?.[0])).toEqual(['captureGuideStep1', 'captureGuideStep2', 'captureGuideStep3', 'captureGuideStep4'])
  // This screen is step 2; the button names come from the real controls' labels.
  expect(steps[1]).toContain('aria-current="step"')
  expect(steps[1]).toContain('captureGuideStep2(start)')
  expect(steps[2]).toContain('captureGuideStep3(screenPreview)')
  expect(steps.filter(step => step.includes('aria-current'))).toHaveLength(1)
  expect(html.indexOf('data-capture-guide')).toBeLessThan(html.indexOf('>difficulty<'))
})

it('shows the real pre-entry screenshot with accessible callouts on its 탐사 전 status and 입장 button', () => {
  const html = renderToStaticMarkup(<RunSetup state={createInitialRunState('hard')} dispatch={() => {}} gifts={[]} giftMap={new Map()} identities={[]} sinners={[]} egos={[]} />)
  const guide = html.slice(html.indexOf('data-capture-guide'), html.indexOf('>difficulty<'))
  expect(guide).toContain('mirror-dungeon-pre-entry.webp')
  expect(guide).toContain('alt="captureGuideImageAlt"')
  const callouts = [...guide.matchAll(/data-guide-callout="(\w+)"/g)].map(match => match[1])
  expect(callouts).toEqual(['before', 'enter'])
  // Visible text labels, tied to steps 1 and 4.
  expect(guide).toMatch(/>1<\/span>captureGuideCalloutBefore/)
  expect(guide).toMatch(/>4<\/span>captureGuideCalloutEnter/)
  expect(guide).toContain('captureGuideHere')
  expect(guide).toContain('aspect-ratio:1919 / 1079')
})

import { expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { NextIntlClientProvider } from 'next-intl'
import messages from '@/messages/ko.json'
import CompanionPanel from '@/components/planner/run/CompanionPanel'
import { createInitialRunState, runReducer, type RunState } from '@/lib/planner/run-types'
import type { ThemeData } from '@/lib/planner/types'

vi.mock('@/lib/hooks/useCompanionWindow', () => ({
  useCompanionWindow: () => ({ container: null, open: async () => {}, size: { width: 360, height: 480 }, actualSize: { width: 360, height: 480 }, updateSize: () => {} }),
}))
vi.mock('@/components/ui/GiftArtwork', () => ({ default: () => <span data-test-artwork /> }))
vi.mock('@/components/ui/ImageWithFallback', () => ({ default: () => <span data-test-poster /> }))

const theme = (id: string, floorInfo: ThemeData['floor_info']): ThemeData =>
  ({ id, name: `pack-${id}`, floor_info: floorInfo, dungeon_id: null, ego_gift_ids: [], specific_ego_gift_ids: [], image_url: `https://example.test/${id}.webp`, difficulty: null })
const themes = [theme('1003', { '하드': [1] }), theme('1101', { '하드': [2] }), theme('1102', { '하드': [2, 3] })]

function render(observedFloor: number | null, scene: { label: string; since: number } | null, withPlan = true) {
  const started = runReducer(createInitialRunState('hard'), { type: 'START_RUN' })
  const planned = withPlan ? { ...started, sourcePlanSnapshot: { floorPlan: [{ floor: 1, theme_id: '1003' }, { floor: 2, theme_id: '1101' }] } as RunState['sourcePlanSnapshot'] } : started
  const state = runReducer(planned, { type: 'SET_FLOOR_THEME', themeId: '1003' })
  return renderToStaticMarkup(<NextIntlClientProvider locale="ko" messages={messages} timeZone="Asia/Seoul">
    <CompanionPanel state={state} dispatch={() => {}} themes={themes} giftMap={new Map()} captureRunning scene={scene} observedFloor={observedFloor} />
  </NextIntlClientProvider>)
}

it('renders only the PiP companion button in the page: no inline preview, pack choices or gift list', () => {
  for (const observed of [2, 1, null]) {
    const html = render(observed, { label: 'exploration', since: 1 })
    expect(html).toContain('data-pip-mode="closed"')
    expect(html).toContain(messages.planner.run.pipModeButton)
    expect(html).toContain('aria-pressed="false"')
    for (const inline of ['data-companion-content', 'data-theme-choice', 'data-theme-title', 'data-gift-grid', 'aria-label="현재 층"']) expect(html).not.toContain(inline)
  }
  // Pending-floor view logic is covered by pendingThemeSelectionFloor tests and the real PiP checks.
  expect(render(2, null, false)).toContain('<button')
})

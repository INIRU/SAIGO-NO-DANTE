import { expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { NextIntlClientProvider } from 'next-intl'
import messages from '@/messages/ko.json'
import CompanionPanel from '@/components/planner/run/CompanionPanel'
import { createInitialRunState, runReducer, type RunState } from '@/lib/planner/run-types'
import type { GiftData, ThemeData } from '@/lib/planner/types'

// The PiP window is rendered inline so its content can be read as markup.
vi.mock('react-dom', async importOriginal => ({ ...(await importOriginal<typeof import('react-dom')>()), createPortal: (node: unknown) => node }))
vi.mock('@/lib/hooks/useCompanionWindow', () => ({
  useCompanionWindow: () => ({ container: {}, open: async () => {}, size: { width: 360, height: 480 }, actualSize: { width: 360, height: 480 }, updateSize: () => {} }),
}))
vi.mock('@/components/ui/GiftArtwork', () => ({ default: () => <span data-test-artwork /> }))
vi.mock('@/components/ui/ImageWithFallback', () => ({ default: () => <span data-test-poster /> }))

const theme = (id: string, gifts: number[]): ThemeData =>
  ({ id, name: `pack-${id}`, floor_info: { '하드': [1] }, dungeon_id: null, ego_gift_ids: gifts, specific_ego_gift_ids: [], image_url: `https://example.test/${id}.webp`, difficulty: null })
const gift = (game_id: number) => ({ id: String(game_id), game_id, name: `gift-${game_id}`, keyword: null, grade: null, image_url: null, effect_base: null, effect_plus: null }) as GiftData
const giftMap = new Map([10, 20, 30].map(id => [id, gift(id)]))

function render(state: RunState) {
  return renderToStaticMarkup(<NextIntlClientProvider locale="ko" messages={messages} timeZone="Asia/Seoul">
    <CompanionPanel state={state} dispatch={() => {}} themes={[theme('A', [10, 20, 30])]} giftMap={giftMap} captureRunning scene={{ label: 'exploration', since: 1 }} />
  </NextIntlClientProvider>)
}
const started = () => ({ ...runReducer(createInitialRunState('hard'), { type: 'START_RUN' }),
  sourcePlanSnapshot: { floorPlan: [{ floor: 1, theme_id: 'A', gift_ids: ['20', '30_plus'] }] } as RunState['sourcePlanSnapshot'] })

it('lists the plan gifts under a recommended pack, dimming owned ones', () => {
  const html = render({ ...started(), giftInventory: ['30'] })
  expect(html).toContain('data-theme-choice="A"')
  const list = html.match(/<ul[^>]*data-theme-plan-gifts="A"[^>]*>.*?<\/ul>/)?.[0] ?? ''
  expect(list).toContain(messages.planner.run.pipThemePlanGifts)
  expect(list).toContain('title="gift-20"')
  expect(list).toContain(`title="gift-30 · ${messages.planner.run.owned}" aria-label="gift-30 · ${messages.planner.run.owned}" data-owned="true"`)
  expect(list).not.toContain('gift-10')
})

it('marks the plan gifts among this floor available gifts with the warning triangle', () => {
  const html = render(runReducer(started(), { type: 'SET_FLOOR_THEME', themeId: 'A' }))
  expect(html).toContain('data-gift-grid')
  const button = (id: number) => html.match(new RegExp(`<button[^>]*data-gift-id="${id}".*?</button>`))?.[0] ?? ''
  for (const id of [20, 30]) {
    expect(button(id)).toContain('data-plan-gift="true"')
    expect(button(id)).toContain(`data-gift-warning="true"`)
  }
  expect(button(10)).not.toContain('data-gift-warning')
  expect(render(runReducer({ ...started(), sourcePlanSnapshot: undefined }, { type: 'SET_FLOOR_THEME', themeId: 'A' }))).not.toContain('data-gift-warning')
})

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
for (const [id, grade] of [[40, '4'], [50, '5'], [60, '3']] as const) giftMap.set(id, { ...gift(id), grade })

function render(state: RunState, skillExchange: { sinner: number; current: [number, number, number] | null } | null = null, scene = 'exploration') {
  return renderToStaticMarkup(<NextIntlClientProvider locale="ko" messages={messages} timeZone="Asia/Seoul">
    <CompanionPanel state={state} dispatch={() => {}} themes={[theme('A', [10, 20, 30])]} giftMap={giftMap} captureRunning scene={{ label: scene, since: 1 }} skillExchange={skillExchange} />
  </NextIntlClientProvider>)
}
const started = () => ({ ...runReducer(createInitialRunState('hard'), { type: 'START_RUN' }),
  sourcePlanSnapshot: { floorPlan: [{ floor: 1, theme_id: 'A', gift_ids: ['20', '30_plus'] }] } as RunState['sourcePlanSnapshot'] })

it('lists the plan gifts under a recommended pack, dimming owned ones', () => {
  const html = render({ ...started(), giftInventory: ['30'] })
  expect(html).toContain('data-theme-choice="A"')
  // The pack card of the Mirror Dungeon page, with its name over the poster and the PiP guidance as its accessible name.
  const choice = html.match(/<li[^>]*data-theme-choice="A".*?<\/button>/)?.[0] ?? ''
  expect(choice).toMatch(/aria-label="pack-A · [^"]*"/)
  expect(choice).toMatch(/>pack-A<\/div>/)
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

it('replaces the gift list with the planned skills and the replacements to buy while the skill window is open', () => {
  const ishmael = { identity_id: 'i', sinner_id: 'ishmael', name_kr: '', rarity: 3, keywords: [], game_id: '10808', folder_name: null, slot_order: 8, s1_count: 1, s2_count: 0, s3_count: 5 }
  const planned = runReducer({ ...started(), sourcePlanSnapshot: { ...started().sourcePlanSnapshot, identitySlots: [ishmael] } }, { type: 'SET_FLOOR_THEME', themeId: 'A' })
  const skills = [1, 2, 3].map(order => ({ identity_id: 'i', name: `skill-${order}`, sin_affinity: '분노', skill_type: 'attack', skill_order: order, uptie_level: 4 }))
  const html = renderToStaticMarkup(<NextIntlClientProvider locale="ko" messages={messages} timeZone="Asia/Seoul">
    <CompanionPanel state={planned} dispatch={() => {}} themes={[theme('A', [10, 20, 30])]} giftMap={giftMap} captureRunning scene={{ label: 'shop', since: 1 }}
      skillExchange={{ sinner: 8, current: [3, 2, 1] }} skills={skills} />
  </NextIntlClientProvider>)
  expect(html).toContain('이스마엘 스킬 교체 추천')
  expect(html).not.toContain('data-gift-grid')
  for (const order of [1, 2, 3]) expect(html).toContain(`skill-${order}`)
  expect(html).toMatch(/data-skill-row="3".*?×1 → .*?×5/)
  expect(html).toContain('aria-label="SKILL 1 → SKILL 3 × 2"')
  expect(html).toContain('aria-label="SKILL 2 → SKILL 3 × 2"')
  expect(render(planned, { sinner: 1, current: [3, 2, 1] })).toContain(messages.planner.run.skillExchangeNotInPlan)
  expect(render(planned, { sinner: 8, current: [1, 0, 5] })).toContain(messages.planner.run.skillExchangeDone)
  expect(render(planned)).toContain('data-gift-grid')
})

it('switches the gift list to the plan tier IV+ gifts while the fusion screen is shown', () => {
  const planned = runReducer({ ...started(), targetGifts: ['40'] }, { type: 'SET_FLOOR_THEME', themeId: 'A' })
  const grid = (html: string) => [...html.matchAll(/data-gift-id="(\d+)"/g)].map(match => Number(match[1]))
  const fusion = render(planned, null, 'fusion')
  // Tier V gift 50 is not in the plan, so it is not listed.
  expect(fusion).toContain('합성으로 얻을 플랜 4등급 이상 기프트 (1개)')
  expect(grid(fusion)).toEqual([40])
  expect(fusion.match(/<button[^>]*data-gift-id="40".*?<\/button>/)?.[0]).toContain('data-gift-warning')
  expect(grid(render(planned, null, 'shop'))).toEqual([20, 30, 10])
  // Without a plan the fusion screen keeps the floor list.
  expect(grid(render(runReducer({ ...started(), sourcePlanSnapshot: undefined }, { type: 'SET_FLOOR_THEME', themeId: 'A' }), null, 'fusion'))).toEqual([10, 20, 30])
})

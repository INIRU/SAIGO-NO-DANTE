import { expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { NextIntlClientProvider } from 'next-intl'
import messages from '@/messages/ko.json'
import CompanionStartGifts from '@/components/planner/run/CompanionStartGifts'
import { createInitialRunState, runReducer, type RunState } from '@/lib/planner/run-types'
import { getRunThemeGuidance, pendingThemeSelectionFloor, planStartGiftIds, runStartEnded } from '@/lib/planner/run-theme-guidance'
import type { GiftData, ThemeData } from '@/lib/planner/types'

vi.mock('@/components/ui/GiftArtwork', () => ({ default: () => <span data-test-artwork /> }))

const themes: ThemeData[] = [['A', [1, 2]], ['B', [1, 2]]].map(([id, floors]) =>
  ({ id, name: id, floor_info: { '하드': floors }, dungeon_id: null, ego_gift_ids: [], specific_ego_gift_ids: [], image_url: null, difficulty: null }) as ThemeData)

function playing(): RunState {
  const state = runReducer(createInitialRunState('hard'), { type: 'START_RUN' })
  return { ...state, sourcePlanSnapshot: { floorPlan: [{ floor: 1, theme_id: 'A' }, { floor: 2, theme_id: 'B' }],
    giftInventory: ['start_101', 'start_102', 'observe_201', 'final_300', 'start_101'] } as RunState['sourcePlanSnapshot'] }
}
const scene = (label: string) => ({ label, since: 1000 })
/** The panel's view: start gifts while the start phase is open, otherwise the (unchanged) pack guidance. */
function view(state: RunState, sceneValue: { label: string; since: number } | null, header: { floor: number; observedAt: number } | null = null, ended = false,
  prediction: { label: string; confidence: number } | null = null) {
  const selectionFloor = pendingThemeSelectionFloor(null, { state, running: true, scene: sceneValue, header, chosenInScene: null })
  return runStartEnded(ended, { state, scene: sceneValue, header, selectionFloor, prediction }) ? 'guidance' : 'start'
}

it('reads the plan start and observation gifts in plan order, once each', () => {
  expect(planStartGiftIds(playing())).toEqual({ start: [101, 102], observe: [201] })
  expect(planStartGiftIds(runReducer(createInitialRunState('hard'), { type: 'START_RUN' }))).toEqual({ start: [], observe: [] })
})

it('keeps the first floor on its start gifts until the pack selection screen is recognized', () => {
  const state = playing()
  // Labels the classifier gives the real start screens (video review 2026-09-24): the start gift grid reads as
  // reward_choice, observation as start_gift, confirmation dialogs as sell, popups as gift_acquired or shop.
  for (const label of [null, 'battle_setup', 'run_setup', 'reward_choice', 'start_gift', 'sell', 'gift_acquired', 'shop', 'fusion', 'loading'])
    expect(view(state, label ? scene(label) : null)).toBe('start')
  // One confident selection frame is enough; a weak one or another label is not.
  expect(view(state, null, null, false, { label: 'theme_select', confidence: 0.9 })).toBe('guidance')
  expect(view(state, null, null, false, { label: 'theme_select', confidence: 0.6 })).toBe('start')
  expect(view(state, null, null, false, { label: 'reward_choice', confidence: 0.95 })).toBe('start')
  // The stable selection scene or its OCR floor header (which can arrive first) ends it at once, without delays.
  expect(view(state, scene('theme_select'))).toBe('guidance')
  expect(view(state, null, { floor: 1, observedAt: 900 })).toBe('guidance')
  expect(view(state, scene('start_gift'), { floor: 1, observedAt: 900 })).toBe('guidance')
  // A missed selection screen: any later screen shows the pack guidance so the pack can still be picked.
  expect(view(state, scene('exploration'))).toBe('guidance')
  // Latched: a later loading screen on the first floor does not bring the start gifts back.
  expect(view(state, scene('loading'), null, true)).toBe('guidance')
  // A recorded first-floor pack also ends it; a new run (setup phase) resets it.
  expect(view(runReducer(state, { type: 'SET_FLOOR_THEME', themeId: 'A' }), null)).toBe('guidance')
  expect(runStartEnded(true, { state: { ...state, phase: 'setup' }, scene: null, header: null, selectionFloor: null })).toBe(false)
})

it('leaves floor 2 and later on the existing pack guidance whatever the scene', () => {
  const second = runReducer(runReducer(playing(), { type: 'SET_FLOOR_THEME', themeId: 'A' }), { type: 'NEXT_FLOOR' })
  expect(second.currentFloor).toBe(2)
  for (const label of [null, 'run_setup', 'start_gift', 'gift_acquired', 'loading', 'exploration', 'theme_select']) expect(view(second, label ? scene(label) : null)).toBe('guidance')
  // Guidance for floor 2 is the plain plan result, available before any selection screen as before.
  expect(getRunThemeGuidance(second, themes).map(item => item.theme.id)).toEqual(['B'])
})

it('shows each start and observation gift with its name and marks the ones already acquired', () => {
  const gift = (game_id: number, name: string) => ({ id: String(game_id), game_id, name, keyword: null, grade: null, image_url: null,
    effect_base: null, effect_plus: null }) as GiftData
  const render = (start: GiftData[], observe: GiftData[], owned: number[]) => renderToStaticMarkup(
    <NextIntlClientProvider locale="ko" messages={messages} timeZone="Asia/Seoul">
      <CompanionStartGifts start={start} observe={observe} owned={new Set(owned)} width={320} onAcquire={() => {}} />
    </NextIntlClientProvider>)
  const html = render([gift(101, '시작A'), gift(102, '시작B')], [gift(201, '관측A')], [102])
  const run = messages.planner.run
  expect(html).toContain(run.startingGifts)
  expect(html).toContain(run.pipObserveGifts)
  for (const name of ['시작A', '시작B', '관측A']) expect(html).toContain(name)
  expect(html).toMatch(/data-gift-id="102" data-owned="true" disabled=""/)
  expect(html).not.toMatch(/data-gift-id="101" data-owned/)
  expect(html).toContain(run.pipStartThemeWait)
  const empty = render([], [], [])
  expect(empty).toContain(run.pipStartGiftsEmpty)
  expect(empty).not.toContain('data-start-gifts')
})

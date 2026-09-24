import { expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { createInitialRunState, runReducer, type RunState } from '@/lib/planner/run-types'
import { floorThemeObservationAction } from '@/lib/planner/run-theme-guidance'
import ThemeSection from '@/components/planner/run/ThemeSection'
import type { ThemeData } from '@/lib/planner/types'

vi.mock('next-intl', () => ({
  useLocale: () => 'ko',
  useTranslations: () => (key: string, values?: Record<string, unknown>) => values ? `${key}(${Object.values(values).join(',')})` : key,
}))
vi.mock('@/components/ui/ThemePackCard', () => ({ default: ({ theme }: { theme: ThemeData }) => <button type="button" data-card={theme.id} /> }))

const theme = (id: string, name: string, floorInfo: ThemeData['floor_info']): ThemeData =>
  ({ id, name, floor_info: floorInfo, dungeon_id: null, ego_gift_ids: [], specific_ego_gift_ids: [], image_url: null, difficulty: null })
const themes = [theme('1003', '밤을 헤매는 자들', { '노말': [1, 2], '하드': [1] }), theme('1102', '거미의 방', { '노말': [2], '하드': [2, 3] })]

/** Floor 2 with a recorded pack, gifts on both floors and a source plan, as a run looks mid-way. */
function midRun(): RunState {
  let state = runReducer(createInitialRunState('hard'), { type: 'START_RUN' })
  state = { ...state, sourcePlanSnapshot: { floorPlan: [{ floor: 1, theme_id: '1003' }, { floor: 2, theme_id: '1102' }] } as RunState['sourcePlanSnapshot'] }
  state = runReducer(state, { type: 'SET_FLOOR_THEME', themeId: '1003' })
  state = runReducer(state, { type: 'ACQUIRE_GIFT', giftId: '9001' })
  state = runReducer(state, { type: 'OBSERVE_FLOOR_THEME', floor: 2, themeId: '1102', completedAt: '2026-09-23T00:00:00.000Z' })
  return runReducer(state, { type: 'ACQUIRE_GIFT', giftId: '9108' })
}

it('clears only the current floor pack, keeping the floor, inventory, logs and source plan', () => {
  const before = midRun()
  expect(before.currentFloor).toBe(2)
  const cleared = runReducer(before, { type: 'SET_FLOOR_THEME', themeId: null })
  expect(cleared.currentFloor).toBe(2)
  expect(cleared.phase).toBe('playing')
  expect(cleared.floorLogs[1]).toEqual({ ...before.floorLogs[1], themeId: null })
  expect(cleared.floorLogs[1].acquiredGifts).toEqual(['9108'])
  expect(cleared.floorLogs[0]).toEqual(before.floorLogs[0])
  expect(cleared.giftInventory).toEqual(['9001', '9108'])
  expect(cleared.sourcePlanSnapshot).toEqual(before.sourcePlanSnapshot)
  expect(cleared).toEqual({ ...before, floorLogs: before.floorLogs.map(log => log.floor === 2 ? { ...log, themeId: null } : log) })
  // Clearing again changes nothing, and a new pick fills the empty selection.
  expect(runReducer(cleared, { type: 'SET_FLOOR_THEME', themeId: null })).toEqual(cleared)
  expect(runReducer(cleared, { type: 'SET_FLOOR_THEME', themeId: '1102' }).floorLogs[1].themeId).toBe('1102')
})

it('does not let the banner that set the pack put it straight back after a clear', () => {
  const consumed = new Set<string>()
  const start = runReducer(runReducer(createInitialRunState('hard'), { type: 'START_RUN' }), { type: 'SET_FLOOR_THEME', themeId: '1003' })
  const banner = { floor: 2, themeIds: ['1102'], observedAt: 1000, token: '2:1102' }
  const applied = runReducer(start, floorThemeObservationAction(start, themes, banner, consumed, 1500)!)
  const cleared = runReducer(applied, { type: 'SET_FLOOR_THEME', themeId: null })
  expect(floorThemeObservationAction(cleared, themes, { ...banner, observedAt: 2000 }, consumed, 2500)).toBeNull()
})

it('offers an accessible clear control only while the current floor has a pack', () => {
  const selected = midRun()
  const html = renderToStaticMarkup(<ThemeSection state={selected} themes={themes} onSelect={() => {}} onClear={() => {}} onClose={() => {}} />)
  expect(html).toContain('data-clear-theme')
  expect(html).toContain('aria-label="clearThemeLabel(2,거미의 방)"')
  expect(html).toMatch(/<button type="button" data-clear-theme[^>]*>[\s\S]*?clearTheme<\/button>/)
  const empty = runReducer(selected, { type: 'SET_FLOOR_THEME', themeId: null })
  expect(renderToStaticMarkup(<ThemeSection state={empty} themes={themes} onSelect={() => {}} onClear={() => {}} onClose={() => {}} />)).not.toContain('data-clear-theme')
  expect(renderToStaticMarkup(<ThemeSection state={selected} themes={themes} onSelect={() => {}} onClose={() => {}} />)).not.toContain('data-clear-theme')
})

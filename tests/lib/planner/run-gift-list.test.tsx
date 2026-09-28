import { expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { NextIntlClientProvider } from 'next-intl'
import messages from '@/messages/ko.json'
import GiftCheckSection from '@/components/planner/run/GiftCheckSection'
import { createInitialRunState, runReducer, type RunState } from '@/lib/planner/run-types'
import type { GiftData, ThemeData } from '@/lib/planner/types'

vi.mock('@/components/ui/GiftArtwork', () => ({ default: () => <span data-test-artwork /> }))

const gift = (game_id: number, keyword = '화상') => ({ id: String(game_id), game_id, name: 'gift-' + game_id, keyword, grade: '1', image_url: null, effect_base: null, effect_plus: null }) as GiftData
const all = [10, 20, 30, 40, 50, 60].map(id => gift(id))
const giftMap = new Map(all.map(item => [item.game_id, item]))
const themes = [{ id: 'A', name: 'pack-A', floor_info: { '하드': [1] }, dungeon_id: null, ego_gift_ids: [10, 20, 30, 60], specific_ego_gift_ids: [40], image_url: null, difficulty: null }] as unknown as ThemeData[]

function state(): RunState {
  const started = { ...runReducer(createInitialRunState('hard'), { type: 'START_RUN' }),
    sourcePlanSnapshot: { floorPlan: [{ floor: 1, theme_id: 'A', gift_ids: ['20'] }] } as RunState['sourcePlanSnapshot'] }
  return { ...runReducer(started, { type: 'SET_FLOOR_THEME', themeId: 'A' }), targetGifts: ['30', '50'], giftInventory: ['10'] }
}
const render = (value: RunState) => renderToStaticMarkup(<NextIntlClientProvider locale="ko" messages={messages} timeZone="Asia/Seoul">
  <GiftCheckSection state={value} dispatch={() => {}} gifts={all} giftMap={giftMap} themes={themes} onChooseTheme={() => {}} />
</NextIntlClientProvider>)
const cell = (html: string, id: number) => { const start = html.indexOf('aria-label="gift-' + id); const next = html.indexOf('aria-label="gift-', start + 1); return start < 0 ? '' : html.slice(start, next < 0 ? undefined : next) }

it('REQ-ASSIST-050 lists this floor plan, final targets and floor-only gifts first in one list with the red mark and no neon', () => {
  const html = render(state())
  const run = messages.planner.run
  const headings = [run.groupFloorPlan, run.groupTargets, run.pipFloorOnly].map(label => html.indexOf('>' + label + '<'))
  expect(headings.every(index => index > 0)).toBe(true)
  expect([...headings].sort((a, b) => a - b)).toEqual(headings)
  // This floor's gifts only by default: 50 is a final target from another pool and waits for the floor filter to be off.
  expect(html).not.toContain('gift-50')
  expect(html).not.toContain('data-plan-glow')
  expect(cell(html, 40)).toContain('data-gift-warning')
  // Filters start as: this floor on, plan only off, hide owned off.
  expect(html).toMatch(new RegExp('<input type="checkbox"[^>]*checked=""[^>]*/>.*?' + run.filterFloor))
  expect(html).toContain('gift-10')
})

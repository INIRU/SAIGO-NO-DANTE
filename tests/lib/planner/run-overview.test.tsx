import { readFileSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { NextIntlClientProvider } from 'next-intl'
import messages from '@/messages/ko.json'
import FloorPanel from '@/components/planner/run/FloorPanel'
import { createInitialRunState, runReducer, type RunState } from '@/lib/planner/run-types'
import type { GiftData, ThemeData } from '@/lib/planner/types'

vi.mock('@/lib/i18n/navigation', () => ({ Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a>, useRouter: () => ({ push: () => {} }), usePathname: () => '/planner/run' }))
vi.mock('@/components/ui/GiftArtwork', () => ({ default: ({ displayName }: { displayName: string }) => <span data-test-artwork={displayName} /> }))

const gift = (game_id: number) => ({ id: String(game_id), game_id, name: 'gift-' + game_id, keyword: '화상', grade: '1', image_url: null, effect_base: null, effect_plus: null }) as GiftData
const gifts = [10, 20, 30, 40].map(gift)
const giftMap = new Map(gifts.map(item => [item.game_id, item]))
const themes = [
  { id: 'A', name: 'pack-A', floor_info: { '하드': [1, 2] }, ego_gift_ids: [10, 20, 30], specific_ego_gift_ids: [], image_url: null, difficulty: null },
  { id: 'B', name: 'pack-B', floor_info: { '하드': [1, 2] }, ego_gift_ids: [10, 40], specific_ego_gift_ids: [], image_url: null, difficulty: null },
] as unknown as ThemeData[]

function run(): RunState {
  let state = runReducer(createInitialRunState('hard'), { type: 'START_RUN' })
  state = runReducer(state, { type: 'SET_FLOOR_THEME', themeId: 'A' })
  state = runReducer(state, { type: 'ACQUIRE_GIFT', giftId: '10' })
  state = runReducer(state, { type: 'NEXT_FLOOR' })
  state = runReducer(state, { type: 'SET_FLOOR_THEME', themeId: 'B' })
  return { ...state, targetGifts: ['10', '30'] }
}
const render = (state: RunState, view: 'overview' | 'theme' = 'overview') => renderToStaticMarkup(<NextIntlClientProvider locale="ko" messages={messages} timeZone="Asia/Seoul">
  <FloorPanel state={state} dispatch={() => {}} themes={themes} gifts={gifts} giftMap={giftMap} recipes={[]} identities={[]} sinners={[]} skills={[]} passives={[]} egos={[]}
    events={[]} eventChoices={[]} view={view} onView={() => {}} />
</NextIntlClientProvider>)
const part = (html: string, mark: string) => { const start = html.indexOf(mark); const next = html.indexOf('data-run-', start + mark.length); return html.slice(start, next < 0 ? undefined : next) }

describe('REQ-ASSIST-066 the run page shows the run in three columns', () => {
  it('REQ-ASSIST-066 floors, status and this floor\'s gift record sit side by side, with no tab row or floor banner', () => {
    const html = render(run())
    const order = ['data-run-floors', 'data-run-status', 'data-run-record'].map(mark => html.indexOf(mark))
    expect(order.every(index => index > 0)).toBe(true)
    expect(html).not.toContain('role="tablist"')
    expect(html).not.toContain(messages.planner.run.currentFloor)
    // Status: final gifts with their progress, then held gifts.
    const status = part(html, 'data-run-status')
    expect(status).toContain(messages.planner.run.targetGifts)
    expect(status).toContain('1 / 2')
    expect(status.indexOf(messages.planner.run.targetGifts)).toBeLessThan(status.indexOf('run-held-gifts'))
    // The record column is the gift list of the floor being played.
    expect(part(html, 'data-run-record')).toContain('gift-40')
  })
})

describe('REQ-ASSIST-067 the floor log lists every floor', () => {
  it('REQ-ASSIST-067 visited floors show their pack and gifts, the floor being played offers the pack change and next floor, later floors are marked as not reached', () => {
    const floors = part(render(run()), 'data-run-floors')
    expect(floors.match(/data-floor-row="/g)).toHaveLength(5)
    expect(floors).toMatch(/data-floor-row="2"[^>]*data-floor-state="current"/)
    expect(floors).toContain('pack-A')
    expect(floors).toContain('data-test-artwork="gift-10"')
    expect(floors).toContain('pack-B')
    expect(floors).toContain(messages.planner.run.editTheme)
    expect(floors).toContain(messages.planner.run.nextFloor)
    expect(floors.split(messages.planner.run.floorAhead).length - 1).toBe(3)
  })

  it('REQ-ASSIST-067 the last floor ends the record instead of going on', () => {
    const last = runReducer(run(), { type: 'GO_TO_FLOOR', floor: 5 })
    const floors = part(render(last), 'data-run-floors')
    expect(floors).toContain(messages.planner.run.completeRun)
    expect(floors).not.toContain('>' + messages.planner.run.nextFloor + '<')
  })
})

describe('REQ-ASSIST-066 the overview is where a run starts again', () => {
  it('REQ-ASSIST-066 leaving the run (reset, completion) or loading a saved run returns to the overview, and reset closes the more menu', () => {
    const client = readFileSync('app/[lang]/planner/run/RunClient.tsx', 'utf8')
    expect(client).toContain("if (state.phase !== 'playing') setView('overview')")
    expect(client).toMatch(/const loadRunSlot = [\s\S]{0,200}setView\('overview'\)/)
    expect(client).toMatch(/recognitionRef\.current\.open = false[\s\S]{0,80}setConfirmReset\(true\)/)
  })
})

describe('REQ-ASSIST-067 floor rows are read out with what they hold', () => {
  it('REQ-ASSIST-067 a row is named by its floor and its content, not by a label that hides the pack and gifts', () => {
    const floors = part(render(run()), 'data-run-floors')
    expect(floors).not.toMatch(/data-floor-row="\d+"[^>]*aria-label=/)
    expect(floors).toContain('<span class="sr-only">1층</span>')
  })
})

import { getGiftsFromThemes } from './fusion'
import type { RunState } from './run-types'
import type { GiftData, ThemeData } from './types'

export function giftGameId(value: string): number | null {
  const match = /^(?:final_|observe_|start_)?(\d+)(?:_plusplus|_plus)?$/.exec(value)
  return match ? Number(match[1]) : null
}

/**
 * Gifts the plan sets for a pack: its floor entry for that pack, plus the given floor's entry, in plan order.
 * The pack match keeps a swapped pack's gifts with it.
 */
export function planThemeGiftIds(state: RunState, themeId: string, floor?: number): number[] {
  const entries = (state.sourcePlanSnapshot?.floorPlan ?? []).filter(entry => entry.theme_id === themeId || entry.floor === floor)
  return [...new Set(entries.flatMap(entry => entry.gift_ids ?? []).map(giftGameId).filter((id): id is number => id !== null))]
}

/**
 * Scene labels (lib/vision scene classifier) where gifts on screen are offered or shown outside combat, so a sighting
 * may move a gift forward. battle/battle_setup freeze the promotion; loading, unknown labels or no stable scene leave
 * it as it is.
 */
export const GIFT_PROMOTION_SCENES: ReadonlySet<string> = new Set(['shop', 'reward_choice', 'event', 'exploration',
  'gift_acquired', 'start_gift', 'enhance', 'fusion', 'sell', 'theme_select', 'run_setup', 'run_end'])

/** Gifts seen on confirmed non-combat screens for one floor and theme; `key` ties them to that floor and theme. */
export interface GiftPromotion { key: string; ids: readonly number[] }

/**
 * Next promotion state. Sightings only accumulate within a floor and theme, so a gift missing from one frame is not
 * demoted; combat and uncertain scenes keep the previous state. Returns the same object when nothing changes, and is
 * idempotent for the same inputs.
 */
export function nextGiftPromotion(previous: GiftPromotion | null, { state, running, scene, observedGiftIds }: {
  state: RunState
  running: boolean
  scene: { label: string } | null
  observedGiftIds: readonly number[]
}): GiftPromotion | null {
  if (!running || state.phase !== 'playing') return null
  const key = `${state.currentFloor}:${state.floorLogs[state.currentFloor - 1]?.themeId ?? ''}`
  const base = previous?.key === key ? previous : { key, ids: [] }
  if (!scene || !GIFT_PROMOTION_SCENES.has(scene.label)) return base
  const added = [...new Set(observedGiftIds)].filter(id => Number.isInteger(id) && !base.ids.includes(id))
  return added.length ? { key, ids: [...base.ids, ...added] } : base
}

/**
 * All unowned gifts from the floor's actual theme: this floor's planned gifts and registered targets in registration
 * order, theme exclusives, promoted (seen) gifts, then the rest; exclusives, seen and the rest keep theme catalog order,
 * so the order of sightings never matters. Pass `nextGiftPromotion(...).ids`, not raw per-frame observations.
 */
export function getCurrentFloorPriorityGifts(state: RunState, themes: ThemeData[], giftMap: Map<number, GiftData>,
  promotedGiftIds: readonly number[] = []): GiftData[] {
  const planned = state.sourcePlanSnapshot?.floorPlan?.find(entry => entry.floor === state.currentFloor)
  const themeId = state.floorLogs[state.currentFloor - 1]?.themeId
  if (!themeId) return []

  const themeGifts = getGiftsFromThemes([themeId], themes, giftMap)
  const exclusiveIds = new Set(themes.find(theme => theme.id === themeId)?.specific_ego_gift_ids ?? [])
  const available = new Set(themeGifts.map(gift => gift.game_id))
  if (!available.size) return []
  const owned = new Set(state.giftInventory.map(giftGameId))
  const promoted = new Set(promotedGiftIds)
  const seen = new Set<number>()
  const result: GiftData[] = []
  const add = (gift: GiftData | undefined) => {
    if (!gift || owned.has(gift.game_id) || seen.has(gift.game_id)) return
    seen.add(gift.game_id)
    result.push(gift)
  }
  for (const key of [...(planned?.gift_ids ?? []), ...state.targetGifts]) {
    const id = giftGameId(key)
    if (id !== null && available.has(id)) add(giftMap.get(id))
  }
  for (const gift of themeGifts) if (exclusiveIds.has(gift.game_id)) add(gift)
  for (const gift of themeGifts) if (promoted.has(gift.game_id)) add(gift)
  for (const gift of themeGifts) add(gift)
  return result
}

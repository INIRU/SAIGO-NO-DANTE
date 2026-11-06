/**
 * The player's plan for the prescripts, from the run page's draft in this browser (`md-run-draft`, the planner's plan the
 * run was started from): the gifts it aims for (target gifts and every floor's planned gifts) and its main keywords.
 * A plan shapes the burden of a prescript: a planned gift is never asked to be sold and is the lightest buy; giving up a
 * gift of a main keyword is heavier, gathering one lighter.
 */
/** `identityIds`: the plan's Identity slots (the site's Identity row ids). */
export interface PrescriptPlan { giftIds: ReadonlySet<number>; keywords: readonly string[]; identityIds: readonly string[] }

export const EMPTY_PLAN: PrescriptPlan = { giftIds: new Set(), keywords: [], identityIds: [] }
export const RUN_DRAFT_KEY = 'md-run-draft'

const strings = (value: unknown): string[] => Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []

/** The plan in a stored run draft (zustand's `{ state, version }`), or the empty plan when there is none to read. */
export function planFromRunDraft(text: string | null): PrescriptPlan {
  if (!text) return EMPTY_PLAN
  try {
    const state = (JSON.parse(text) as { state?: Record<string, unknown> }).state ?? {}
    const snapshot = (state.sourcePlanSnapshot ?? {}) as { floorPlan?: unknown; mainKeywords?: unknown }
    const floors = Array.isArray(snapshot.floorPlan) ? snapshot.floorPlan as { gift_ids?: unknown }[] : []
    const ids = [...strings(state.targetGifts), ...floors.flatMap(floor => strings(floor?.gift_ids))]
      .map(id => Number(id.replace(/^final_/, ''))).filter(id => Number.isInteger(id) && id > 0)
    const slots = Array.isArray(state.identitySlots) ? state.identitySlots as { identity_id?: unknown }[] : []
    return { giftIds: new Set(ids), keywords: strings(snapshot.mainKeywords),
      identityIds: slots.map(slot => slot?.identity_id).filter((id): id is string => typeof id === 'string') }
  } catch {
    return EMPTY_PLAN
  }
}

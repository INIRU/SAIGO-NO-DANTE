/** Scene labels that reliably mean the event screen was left (single predictions are debounced by the caller). */
export const EVENT_EXIT_SCENES: ReadonlySet<string> = new Set(['exploration', 'battle', 'battle_setup', 'shop', 'theme_select', 'run_end', 'run_setup'])
/** Any other non-event scene held this long also ends the event, so a missed exit cannot pin it forever. */
export const EVENT_IDLE_EXIT_MS = 15000

/** A classifier label seen in two consecutive confident predictions, and when it was first seen. */
export interface StableScene { label: string; since: number }
/** Screens the PiP shows the formation on: the dungeon entry (run_setup) and the formation itself, read as battle_setup. */
export const FORMATION_SCENES: ReadonlySet<string> = new Set(['run_setup', 'battle_setup'])
export interface EventView { eventId: number; observedAt: number; floor: number | null }

/** When the event screen was left according to the stable scene, or null while it may still be showing. */
export function eventExitAt(scene: StableScene | null, now: number): number | null {
  if (!scene || scene.label === 'event') return null
  if (EVENT_EXIT_SCENES.has(scene.label)) return scene.since
  return now - scene.since >= EVENT_IDLE_EXIT_MS ? scene.since + EVENT_IDLE_EXIT_MS : null
}

/**
 * The event summary to show. A confirmed event stays through OCR misses, expired candidates and its result page, and
 * follows newer evidence for another event (a follow-up branch). It ends only when the scene leaves the event, the floor
 * changes or capture stops; after that, only evidence captured later can open a summary again.
 */
export function nextEventView(view: EventView | null, { running, floor, evidence, scene, now }: {
  running: boolean
  floor: number | null
  evidence: EventView | null
  scene: StableScene | null
  now: number
}): EventView | null {
  if (!running) return null
  const current = view && view.floor === floor ? view : null
  const exitAt = eventExitAt(scene, now)
  const fresh = evidence && evidence.floor === floor && (exitAt === null || evidence.observedAt > exitAt) &&
    (!current || evidence.observedAt > current.observedAt) ? evidence : null
  if (fresh) return current?.eventId === fresh.eventId && current.observedAt === fresh.observedAt ? current : { ...fresh }
  if (current && exitAt !== null && exitAt > current.observedAt) return null
  return current
}

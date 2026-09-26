/** Source graph primitives. IDs and text similarity never establish parenthood. */
export type SourceForm = {
  resultEffect?: string; resultDescId?: string; resultEffectTarget?: string
  resultEffectCondition1?: string; resultEffectCondition2?: string
  itemReward?: { type?: string; rewardId?: number; num?: number }
  [key: string]: unknown
}
export type SourceResult = {
  resultIndex: number; resultCondition?: string; nextEventID?: number
  eventResultDataList?: { resultForm?: SourceForm }[]
}
export type SourceEvent = {
  id: number; illustId?: number; eventType: 'EVENT' | 'COIN_EVENT'
  actionEvent?: { eachOptionList?: { index: number; resultList?: SourceResult[]; cantSelectInThisCase?: string }[] }
  personalityEvent?: {
    eventResults?: { eventResult: string; eventResultDataList?: SourceResult[] }[]
    [key: string]: unknown
  }
}
export function sourceResults(event: SourceEvent) {
  if (event.eventType === 'EVENT') return (event.actionEvent?.eachOptionList ?? []).flatMap(option =>
    (option.resultList ?? []).map(result => ({ optionIndex: option.index, outcome: null, result })))
  return (event.personalityEvent?.eventResults ?? []).flatMap((outcome, index) =>
    (outcome.eventResultDataList ?? []).map(result => ({ optionIndex: index, outcome: outcome.eventResult.toLowerCase(), result })))
}
/** Theme map steps whose numbers are event IDs: a fixed floor's own events, and the curse events that replace random ones. */
const EVENT_STEPS = new Set(['FILL_EMPTY_EVENT', 'OVERRIDE_RANDOM_EVENT_BY_CURSE_EVENT'])
export function sequenceEventIds(sequence: unknown): number[] {
  if (!Array.isArray(sequence)) return []
  return sequence.flatMap(step => step && typeof step === 'object' && EVENT_STEPS.has((step as { type?: unknown }).type as string) &&
    Array.isArray((step as { numberList?: unknown }).numberList)
    ? (step as { numberList: unknown[] }).numberList.filter((id): id is number => Number.isInteger(id) && (id as number) > 0) : [])
}
/** Unit keys of "SpecificUnit_*" judgment corrections (game spelling) → character IDs in *_Characters. */
const SINNER_UNITS: Record<string, number> = { Yisang: 1, Faust: 2, Donquixote: 3, Ryosyu: 4, Meursault: 5, Honglu: 6,
  Heathcliff: 7, Ishmael: 8, Rodion: 9, Sinclair: 10, Outis: 11, Gregor: 12 }
export function sinnerCharacterId(key: string): number {
  const id = SINNER_UNITS[key]
  if (!id) throw Error(`Unknown sinner key ${key}`)
  return id
}
export function walkEventGraph(events: ReadonlyMap<number, SourceEvent>, entries: ReadonlySet<number>) {
  const reachable = new Set<number>(), edges: [number, number][] = []
  const queue = [...entries]
  while (queue.length) {
    const id = queue.pop()!
    if (reachable.has(id)) continue
    const event = events.get(id)
    if (!event) throw Error(`Missing source event ${id}`)
    reachable.add(id)
    for (const { result } of sourceResults(event)) {
      const next = result.nextEventID
      if (next != null && next > 0) { edges.push([id, next]); queue.push(next) }
    }
  }
  return { reachable, edges }
}
export function sourceResultText(texts: string[] | undefined, index: number): string | null {
  if (!texts?.length) return null
  // A single source narrative is shared; indexed alternatives are never concatenated.
  return texts[index] ?? (texts.length === 1 ? texts[0] : null)
}

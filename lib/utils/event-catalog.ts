/** Root encounters shown in the gallery; result/variant nodes are only for traversal. */
export function getRootEvents<T extends { id: number; variant_of: number | null; category?: string | null }>(
  events: readonly T[],
  choicesByEventId: ReadonlyMap<number, readonly { next_event_id: number | null }[]>,
): T[] {
  const children = new Set<number>()
  for (const choices of choicesByEventId.values()) {
    for (const choice of choices) if (choice.next_event_id != null) children.add(choice.next_event_id)
  }
  const ids = new Set(events.map(event => event.id))
  return events.filter(event => event.category === 'entry' || (event.category !== 'continuation' && event.variant_of == null && !children.has(event.id)
    && !(String(event.id).length === 8 && ids.has(Math.floor(event.id / 100)))))
}

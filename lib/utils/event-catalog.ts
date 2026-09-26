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
  // A variant (an exact copy of another event) is never a root, even as an entry.
  return events.filter(event => event.variant_of == null && (event.category === 'entry' || (event.category !== 'continuation' && !children.has(event.id)
    && !(String(event.id).length === 8 && ids.has(Math.floor(event.id / 100))))))
}

/** Events and choices Assist may recognize: copies of another event would make its text match several events at once. */
export function recognizableEvents<E extends { id: number; variant_of: number | null }, C extends { event_id: number }>(events: readonly E[], choices: readonly C[]) {
  const copies = new Set(events.filter(event => event.variant_of != null).map(event => event.id))
  return { events: events.filter(event => !copies.has(event.id)), choices: choices.filter(choice => !copies.has(choice.event_id)) }
}

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

type TitledEvent = {
  id: number
  name?: string | null; name_en?: string | null; name_jp?: string | null
  desc_text?: string | null; desc_text_en?: string | null; desc_text_jp?: string | null
}

/**
 * Plain-text title of an event: its name, or for the entry events the game leaves unnamed (96 of them, e.g. 901001 opens
 * with "아롱거리며 떠다니는 주홍빛 동그라미들이 보인다.") the first line of its text, cut at `max` characters. The mirror
 * dungeon gallery and modal already title them this way. Null when there is neither, so each screen keeps its own fallback.
 */
export function eventTitle(event: TitledEvent, lang: 'ko' | 'en' | 'ja', max = 40): string | null {
  const name = ((lang === 'en' ? event.name_en : lang === 'ja' ? event.name_jp : null) || event.name)?.trim()
  if (name) return name
  const text = (lang === 'en' ? event.desc_text_en : lang === 'ja' ? event.desc_text_jp : null) || event.desc_text
  const line = text?.replace(/<[^>]*>/g, '').split('\n').map(part => part.trim()).find(Boolean)
  if (!line) return null
  return line.length > max ? `${line.slice(0, max).trimEnd()}…` : line
}

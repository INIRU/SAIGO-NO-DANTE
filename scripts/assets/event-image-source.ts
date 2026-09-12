// These story/MD pairs have matching Drive EN/JP introductions; the actual
// scenes were also compared with Dante's rendered event pages. This is an
// explicit allowlist, never a title/suffix-based guess for other events.
export const EVENT_IMAGE_ALIASES: Readonly<Record<number, number>> = {
  971100: 10711,
  971101: 10712,
  971102: 10713,
  971103: 10714,
  971110: 10902,
  971111: 10903,
  971112: 10904,
}

export function eventImageId(eventId: number, illustId?: number): number {
  return illustId ?? EVENT_IMAGE_ALIASES[eventId] ?? eventId
}

export function eventImageIdFromFilename(name: string): number | undefined {
  const id = name.match(/^(?:ChoiceEvent_)?(\d{5,8})(?:\D|$)/)?.[1]
  return id ? Number(id) : undefined
}

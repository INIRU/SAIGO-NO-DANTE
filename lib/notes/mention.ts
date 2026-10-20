/** `@` mentions in a note: an identity or an E.G.O named inside a sentence. */
export const MENTION_KINDS = ['identity', 'ego'] as const
export type MentionKind = typeof MENTION_KINDS[number]
export const isMentionKind = (value: unknown): value is MentionKind => MENTION_KINDS.includes(value as MentionKind)

export function mentionHref(kind: MentionKind, id: string, sinnerId: string): string {
  return kind === 'identity' ? `/sinners/${sinnerId}/identities/${id}` : `/sinners/${sinnerId}/ego/${id}`
}

/** The name being typed after an `@` that starts a word (an e-mail's `@` does not count); `length` includes the `@`. */
export function findMentionQuery(before: string): { query: string; length: number } | null {
  const match = before.match(/(?:^|[\s(（])@([^\s@]{0,30})$/)
  return match ? { query: match[1], length: match[1].length + 1 } : null
}

/** Pool entries whose name (in any language) contains the query, names that start with it first; a bare `@` lists the first ones. */
export function filterMentions<T extends { label: string; aliases?: string[] }>(pool: T[], query: string, limit: number): T[] {
  const q = query.trim().toLowerCase()
  if (!q) return pool.slice(0, limit)
  const ranked: { item: T; rank: number; at: number }[] = []
  pool.forEach((item, at) => {
    const names = [item.label, ...(item.aliases ?? [])].map(name => name.toLowerCase())
    const rank = names[0].startsWith(q) ? 0 : names.some(name => name.startsWith(q)) ? 1 : names.some(name => name.includes(q)) ? 2 : -1
    if (rank >= 0) ranked.push({ item, rank, at })
  })
  return ranked.sort((a, b) => a.rank - b.rank || a.at - b.at).slice(0, limit).map(entry => entry.item)
}

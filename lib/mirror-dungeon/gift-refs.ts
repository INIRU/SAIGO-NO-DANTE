export interface GiftRefTarget {
  id: string
  /** Display name as it appears in the effect text (already localized). */
  name: string
}

export type GiftTextPart = string | { gift: GiftRefTarget; text: string }

const escape = (s: string) => s.replace(/[.*+?^$(){}|[\]\\]/g, '\\$&')

// Short bare names ("믿음", "추억") are ordinary words in effect text; only link them when bracketed.
const MIN_BARE_LENGTH = 3

/**
 * Builds a splitter that finds other gifts named in effect text, e.g. "→ [가능성]" or "…『신검합일』로 변경".
 * Longest names win, so "회중시계 : 타입 L" is not cut short by a shorter prefix name.
 */
export function createGiftRefSplitter(targets: GiftRefTarget[], { selfId, convertToId }: { selfId?: string | null; convertToId?: string | null } = {}) {
  const byName = new Map<string, GiftRefTarget>()
  for (const t of targets) if (t.id !== selfId && t.name.trim() && !byName.has(t.name)) byName.set(t.name, t)
  const names = [...byName.keys()].sort((a, b) => b.length - a.length)
  if (names.length === 0) return (text: string): GiftTextPart[] => [text]
  const all = names.map(escape).join('|')
  const bare = names.filter(n => [...n].length >= MIN_BARE_LENGTH || byName.get(n)!.id === convertToId).map(escape).join('|')
  const pattern = new RegExp('\\[(' + all + ')\\]|『(' + all + ')』|「(' + all + ')」' + (bare ? '|(' + bare + ')' : ''), 'g')

  return (text: string): GiftTextPart[] => {
    const parts: GiftTextPart[] = []
    let last = 0
    for (const m of text.matchAll(pattern)) {
      const name = m[1] ?? m[2] ?? m[3] ?? m[4]
      const gift = byName.get(name)
      if (!gift) continue
      if (m.index > last) parts.push(text.slice(last, m.index))
      parts.push({ gift, text: name })
      last = m.index + m[0].length
    }
    if (last < text.length) parts.push(text.slice(last))
    return parts
  }
}

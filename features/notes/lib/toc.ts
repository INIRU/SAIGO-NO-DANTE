import type { JSONContent } from '@tiptap/core'

/** A note shows a table of contents from this many headings. */
export const NOTE_TOC_MIN = 3

export type NoteHeading = { id: string; text: string; level: 1 | 2; line?: number }

/** `note-` plus the heading's words (any script) joined with `-`: the same words always give the same id. */
export function headingSlug(text: string): string {
  const slug = text.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{M}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '').slice(0, 60).replace(/-+$/, '')
  return 'note-' + (slug || 'section')
}

/** Gives each heading its id, numbering a repeat (`-2`, `-3`) in reading order. */
function withIds<T extends { text: string }>(entries: T[]): (T & { id: string })[] {
  const seen = new Map<string, number>()
  return entries.map(entry => {
    const base = headingSlug(entry.text), count = (seen.get(base) ?? 0) + 1
    seen.set(base, count)
    return { ...entry, id: count === 1 ? base : `${base}-${count}` }
  })
}

const textOf = (n: JSONContent): string => n.type === 'text' ? n.text ?? '' : n.type === 'noteGift' || n.type === 'noteMention' ? String(n.attrs?.name ?? '') : n.type === 'noteKeyword' ? String(n.attrs?.id ?? '') : (n.content ?? []).map(textOf).join('')

/** Headings of a block document in reading order; `node` is the heading node itself, to find its id while drawing. */
export function collectHeadings(doc: JSONContent): (NoteHeading & { node: JSONContent })[] {
  const found: { text: string; level: 1 | 2; node: JSONContent }[] = []
  const visit = (n: JSONContent) => {
    if (n.type === 'heading') {
      const text = textOf(n).trim()
      if (text) found.push({ text, level: n.attrs?.level === 1 ? 1 : 2, node: n })
      return
    }
    n.content?.forEach(visit)
  }
  visit(doc)
  return withIds(found)
}

/** Headings of an old markdown note (`#`, `##`), with the line each one is on. */
export function markdownHeadings(text: string): NoteHeading[] {
  const found: { text: string; level: 1 | 2; line: number }[] = []
  text.replace(/\r\n/g, '\n').split('\n').forEach((line, index) => {
    const match = line.match(/^(#{1,2})\s+(.+)$/)
    if (!match) return
    const plain = match[2].replace(/\[[a-z]:([^\]]*)\]/g, (_, body: string) => body.replace(/:/g, ' ')).replace(/\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/[*_`]/g, '').trim()
    if (plain) found.push({ text: plain, level: match[1].length === 1 ? 1 : 2, line: index })
  })
  return withIds(found)
}

/** The heading being read: the last one whose top has passed `offset` px from the top of the screen, else the first. */
export function activeHeading(positions: { id: string; top: number }[], offset: number): string | null {
  let active = positions[0]?.id ?? null
  for (const { id, top } of positions) if (top <= offset) active = id
  return active
}

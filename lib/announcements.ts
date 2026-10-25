export type RichNode = {
  type: string
  text?: string
  attrs?: Record<string, unknown>
  marks?: { type: string; attrs?: Record<string, unknown> }[]
  content?: RichNode[]
}
const imageRoot = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/limbus-assets/announcements/`
export function safeAnnouncementImage(src: unknown): src is string {
  return (
    typeof src === 'string' &&
    src.startsWith(imageRoot) &&
    /^[a-f0-9-]+\.webp$/.test(src.slice(imageRoot.length))
  )
}
export function safeAnnouncementLink(href: unknown): href is string {
  if (typeof href !== 'string') return false
  try {
    return ['https:', 'http:'].includes(new URL(href).protocol)
  } catch {
    return false
  }
}
export function validAnnouncementDocument(value: unknown): value is RichNode {
  let count = 0,
    images = 0
  function visit(node: unknown, depth: number): boolean {
    if (!node || typeof node !== 'object' || depth > 12 || ++count > 2000)
      return false
    const n = node as RichNode
    if (
      ![
        'doc',
        'paragraph',
        'heading',
        'text',
        'bulletList',
        'orderedList',
        'listItem',
        'blockquote',
        'hardBreak',
        'horizontalRule',
        'image',
      ].includes(n.type)
    )
      return false
    if (
      n.text !== undefined &&
      (typeof n.text !== 'string' || n.text.length > 50000)
    )
      return false
    if (
      n.type === 'image' &&
      (!safeAnnouncementImage(n.attrs?.src) || ++images > 20)
    )
      return false
    if (
      n.marks &&
      (!Array.isArray(n.marks) ||
        n.marks.some(
          (m) =>
            !m ||
            !['bold', 'italic', 'strike', 'underline', 'code', 'link'].includes(
              m.type,
            ) ||
            (m.type === 'link' && !safeAnnouncementLink(m.attrs?.href)),
        ))
    )
      return false
    return (
      !n.content ||
      (Array.isArray(n.content) && n.content.every((c) => visit(c, depth + 1)))
    )
  }
  return Boolean(
    value &&
      typeof value === 'object' &&
      (value as RichNode).type === 'doc' &&
      JSON.stringify(value).length <= 150000 &&
      visit(value, 0),
  )
}
export function announcementText(doc?: RichNode | null): string {
  if (!doc) return ''
  if (doc.type === 'text') return doc.text ?? ''
  return (doc.content ?? [])
    .map(announcementText)
    .join(['doc', 'bulletList', 'orderedList'].includes(doc.type) ? '\n' : '')
}
export function announcementCover(doc?: RichNode | null): string | null {
  if (!doc) return null
  if (doc.type === 'image' && safeAnnouncementImage(doc.attrs?.src))
    return doc.attrs.src
  for (const child of doc.content ?? []) {
    const src = announcementCover(child)
    if (src) return src
  }
  return null
}
export function plainAnnouncementDocument(text: string): RichNode {
  return {
    type: 'doc',
    content: text
      .split('\n')
      .map((line) => ({
        type: 'paragraph',
        content: line ? [{ type: 'text', text: line }] : [],
      })),
  }
}
export type Announcement = {
  id: string
  title: string
  content: string
  content_doc?: RichNode | null
  pinned: boolean
  popup?: boolean
  published: boolean
  lang: 'ko' | 'en' | 'ja'
  created_at: string
  updated_at?: string | null
}

/** What a teaser of an announcement needs (home, popup, list): the body document stays on its own page. */
export type AnnouncementPreview = Pick<Announcement, 'id' | 'title' | 'created_at' | 'pinned'> & { cover: string | null; excerpt: string }

/** Plain text on one line, cut at `max` characters with an ellipsis. */
export function announcementExcerpt(text: string, max = 160): string {
  const flat = text.replace(/\s+/g, ' ').trim()
  return flat.length > max ? `${flat.slice(0, max - 1).trimEnd()}…` : flat
}

export function announcementPreview(row: Pick<Announcement, 'id' | 'title' | 'content' | 'content_doc' | 'pinned' | 'created_at'>, max?: number): AnnouncementPreview {
  return {
    id: row.id, title: row.title, created_at: row.created_at, pinned: row.pinned,
    cover: announcementCover(row.content_doc),
    excerpt: announcementExcerpt(row.content || announcementText(row.content_doc), max),
  }
}

/** The announcements written just before (older) and after (newer) `id`, by creation date. */
export function adjacentAnnouncements<T extends { id: string; created_at: string }>(items: T[], id: string): { older: T | null; newer: T | null } {
  const byDate = [...items].sort((a, b) => b.created_at.localeCompare(a.created_at))
  const at = byDate.findIndex(item => item.id === id)
  if (at < 0) return { older: null, newer: null }
  return { older: byDate[at + 1] ?? null, newer: byDate[at - 1] ?? null }
}

/** 2026-10-21T… → 2026.10.21 */
export const announcementDate = (iso: string) => iso.slice(0, 10).replaceAll('-', '.')

import { z } from 'zod'
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
export const announcementDocumentSchema = z
  .custom<RichNode>(
    validAnnouncementDocument,
    '지원하지 않는 본문 또는 이미지입니다.',
  )
  .nullable()
  .optional()
export const announcementSchema = z
  .object({
    title: z.string().trim().min(1).max(160),
    content: z.string().max(50000).default(''),
    content_doc: announcementDocumentSchema,
    lang: z.enum(['ko', 'en', 'ja']).default('ko'),
    pinned: z.boolean().default(false),
    published: z.boolean().default(false),
    // 저장하지 않는 전송 옵션: 게시되는 순간 디스코드 알림에 @everyone을 붙인다
    discord_everyone: z.boolean().default(false),
  })
  .refine(
    (v) =>
      !v.published ||
      Boolean(
        v.content_doc
          ? announcementText(v.content_doc).trim() ||
              announcementCover(v.content_doc)
          : v.content.trim(),
      ),
    '게시할 본문을 작성해주세요.',
  )
export type Announcement = {
  id: string
  title: string
  content: string
  content_doc?: RichNode | null
  pinned: boolean
  published: boolean
  lang: 'ko' | 'en' | 'ja'
  created_at: string
  updated_at?: string | null
}

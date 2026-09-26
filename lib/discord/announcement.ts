import type { RichNode } from '@/lib/announcements'
import { SITE_URL } from '@/lib/utils/og-image'

// Components V2 limits: 40 components per message (the container counts), 4000 characters of text in total.
const MAX_COMPONENTS = 40
const MAX_CHARS = 4000
const IS_COMPONENTS_V2 = 1 << 15
// The site's --gold, as the container's left accent bar.
const ACCENT = 0xc8900a

type Child =
  | { type: 10; content: string }
  | { type: 12; items: { media: { url: string } }[] }
  | { type: 14; divider: true; spacing: 1 }
export type DiscordMessage = {
  flags: number
  components: [{ type: 17; accent_color: number; components: Child[] }]
  allowed_mentions: { parse: string[] }
}

function inline(node: RichNode): string {
  if (node.type === 'hardBreak') return '\n'
  if (node.type !== 'text') return (node.content ?? []).map(inline).join('')
  let text = node.text ?? ''
  if (!text.trim()) return text
  for (const mark of node.marks ?? []) {
    if (mark.type === 'bold') text = `**${text}**`
    else if (mark.type === 'italic') text = `*${text}*`
    else if (mark.type === 'strike') text = `~~${text}~~`
    else if (mark.type === 'underline') text = `__${text}__`
    else if (mark.type === 'code') text = `\`${text}\``
    else if (mark.type === 'link' && typeof mark.attrs?.href === 'string') text = `[${text}](${mark.attrs.href})`
  }
  return text
}

type Part = { text: string } | { image: string }

/** Walks the announcement document into markdown text blocks, breaking wherever an image appears. */
function parts(node: RichNode, prefix = '', out: Part[] = []): Part[] {
  const push = (text: string) => out.push({ text: prefix + text.replace(/\n/g, '\n' + prefix) })
  switch (node.type) {
    case 'image': if (typeof node.attrs?.src === 'string') out.push({ image: node.attrs.src }); break
    case 'paragraph': push(inline(node)); break
    case 'heading': push(`${'#'.repeat(Math.min(3, Number(node.attrs?.level) || 2))} ${inline(node)}`); break
    case 'horizontalRule': push('───────────'); break
    case 'blockquote': for (const child of node.content ?? []) parts(child, prefix + '> ', out); break
    case 'bulletList':
    case 'orderedList':
      ;(node.content ?? []).forEach((item, index) => {
        const bullet = node.type === 'orderedList' ? `${index + 1}. ` : '- '
        const before = out.length
        for (const child of item.content ?? []) parts(child, prefix + '   ', out)
        const first = out[before]
        if (first && 'text' in first) first.text = prefix + bullet + first.text.slice(prefix.length + 3)
      })
      break
    default: for (const child of node.content ?? []) parts(child, prefix, out)
  }
  return out
}

function chunks(text: string, limit = MAX_CHARS): string[] {
  const result: string[] = []
  let rest = text.trim()
  while (rest.length > limit) {
    const cut = Math.max(rest.lastIndexOf('\n', limit), limit / 2)
    result.push(rest.slice(0, cut).trimEnd())
    rest = rest.slice(cut).trimStart()
  }
  if (rest) result.push(rest)
  return result
}

/**
 * Discord webhook payloads for an announcement, laid out like the site: one gold-accented container holding the title,
 * markdown text and each image in document order. A new message starts only when the Components V2 limits would be passed.
 */
export function announcementDiscordMessages(input: { title: string; doc?: RichNode | null; content?: string; url?: string; everyone?: boolean }): DiscordMessage[] {
  const body: Part[] = input.doc ? parts(input.doc) : [{ text: input.content ?? '' }]
  const groups: Part[] = []
  const title = (input.everyone ? '@everyone\n' : '') + `# ${input.title}`
  for (const part of [{ text: title } as Part, ...body]) {
    const last = groups[groups.length - 1]
    if ('text' in part && last && 'text' in last) last.text += '\n' + part.text
    else groups.push({ ...part })
  }
  const children: Child[] = groups.flatMap((group): Child[] => 'image' in group
    ? [{ type: 12, items: [{ media: { url: group.image } }] }]
    : chunks(group.text.replace(/\n{3,}/g, '\n\n')).map(content => ({ type: 10, content })))
  if (input.url) children.push({ type: 14, divider: true, spacing: 1 }, { type: 10, content: `-# [사이트에서 보기](${input.url})` })

  const messages: DiscordMessage[] = []
  let chars = Infinity
  for (const child of children) {
    const size = 'content' in child ? child.content.length : 0
    const current = messages[messages.length - 1]?.components[0].components
    if (!current || current.length + 2 > MAX_COMPONENTS || chars + size > MAX_CHARS) {
      messages.push({ flags: IS_COMPONENTS_V2, components: [{ type: 17, accent_color: ACCENT, components: [child] }], allowed_mentions: { parse: [] } })
      chars = size
    } else {
      current.push(child)
      chars += size
    }
  }
  if (input.everyone && messages[0]) messages[0].allowed_mentions = { parse: ['everyone'] }
  return messages
}

/** Posts the messages in order; webhooks ignore components unless asked. Returns false when any post fails. */
export async function sendAnnouncementToDiscord(webhook: string, messages: DiscordMessage[]): Promise<boolean> {
  if (messages.length === 0) return false
  const url = new URL(webhook)
  url.searchParams.set('with_components', 'true')
  for (const message of messages) {
    const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(message) }).catch(() => null)
    if (!response?.ok) return false
  }
  return true
}

/** Korean announcements go to the Discord server when they become published. */
export async function postAnnouncementToDiscord(row: { title: string; content: string; content_doc?: RichNode | null; lang: string }, everyone: boolean) {
  if (row.lang !== 'ko') return 'skipped' as const
  const webhook = process.env.DISCORD_ANNOUNCEMENT_WEBHOOK_URL
  if (!webhook) return 'unconfigured' as const
  const messages = announcementDiscordMessages({ title: row.title, doc: row.content_doc, content: row.content, url: new URL('/ko/announcements', SITE_URL).toString(), everyone })
  return (await sendAnnouncementToDiscord(webhook, messages)) ? 'sent' as const : 'failed' as const
}

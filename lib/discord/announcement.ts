import type { RichNode } from '@/lib/announcements'
import { SITE_URL } from '@/lib/utils/og-image'

const LIMIT = 2000

export type DiscordMessage = { content?: string; embeds?: { image: { url: string } }[]; allowed_mentions: { parse: string[] } }

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

function chunks(text: string): string[] {
  const result: string[] = []
  let rest = text.trim()
  while (rest.length > LIMIT) {
    const cut = Math.max(rest.lastIndexOf('\n', LIMIT), LIMIT / 2)
    result.push(rest.slice(0, cut).trimEnd())
    rest = rest.slice(cut).trimStart()
  }
  if (rest) result.push(rest)
  return result
}

/**
 * Discord webhook payloads for an announcement: markdown text, split into separate messages around each image
 * (Discord cannot place an image in the middle of a message) and at the 2000 character limit.
 */
export function announcementDiscordMessages(input: { title: string; doc?: RichNode | null; content?: string; url?: string; everyone?: boolean }): DiscordMessage[] {
  const body: Part[] = input.doc ? parts(input.doc) : [{ text: input.content ?? '' }]
  const groups: Part[] = []
  for (const part of [{ text: `# ${input.title}` } as Part, ...body]) {
    const last = groups[groups.length - 1]
    if ('text' in part && last && 'text' in last) last.text += '\n' + part.text
    else groups.push({ ...part })
  }
  if (input.url) {
    const last = groups[groups.length - 1]
    const link = `\n\n<${input.url}>`
    if (last && 'text' in last) last.text += link
    else groups.push({ text: link })
  }
  const messages: DiscordMessage[] = groups.flatMap((group): DiscordMessage[] => 'image' in group
    ? [{ embeds: [{ image: { url: group.image } }], allowed_mentions: { parse: [] } }]
    : chunks(group.text.replace(/\n{3,}/g, '\n\n')).map(content => ({ content, allowed_mentions: { parse: [] as string[] } })))
  if (input.everyone && messages[0]) {
    const first = messages[0]
    if (first.content && first.content.length + 11 <= LIMIT) first.content = `@everyone\n${first.content}`
    else messages.unshift({ content: '@everyone', allowed_mentions: { parse: [] } })
    messages[0].allowed_mentions = { parse: ['everyone'] }
  }
  return messages
}

/** Posts the messages in order. Returns false when any post fails. */
export async function sendAnnouncementToDiscord(webhook: string, messages: DiscordMessage[]): Promise<boolean> {
  if (messages.length === 0) return false
  for (const message of messages) {
    const response = await fetch(webhook, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(message) }).catch(() => null)
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

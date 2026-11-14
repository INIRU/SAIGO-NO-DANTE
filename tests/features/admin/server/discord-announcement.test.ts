import { afterEach, describe, expect, it, vi } from 'vitest'
import { announcementDiscordMessages, sendAnnouncementToDiscord, type DiscordMessage } from '@/features/admin/server/discord-announcement'

const text = (t: string, marks?: { type: string; attrs?: Record<string, unknown> }[]) => ({ type: 'text', text: t, marks })
const doc = {
  type: 'doc',
  content: [
    { type: 'paragraph', content: [text('업데이트 '), text('안내', [{ type: 'bold' }])] },
    { type: 'bulletList', content: [{ type: 'listItem', content: [{ type: 'paragraph', content: [text('기프트')] }] }] },
    { type: 'image', attrs: { src: 'https://x/a.webp' } },
    { type: 'paragraph', content: [text('링크', [{ type: 'link', attrs: { href: 'https://saigo-no-dante.com' } }])] },
  ],
}
const children = (message: DiscordMessage) => message.components[0].components
const count = (message: DiscordMessage) => 1 + children(message).length
const chars = (message: DiscordMessage) => children(message).reduce((sum, c) => sum + ('content' in c ? c.content.length : 0), 0)

describe('announcementDiscordMessages', () => {
  it('puts title, text and images in one gold container in site order', () => {
    const messages = announcementDiscordMessages({ title: '공지', doc, url: 'https://saigo-no-dante.com/ko/announcements' })
    expect(messages).toHaveLength(1)
    const [message] = messages
    expect(message.flags).toBe(1 << 15)
    expect(message.components).toHaveLength(1)
    expect(message.components[0]).toMatchObject({ type: 17, accent_color: 0xc8900a })
    expect(children(message)).toEqual([
      { type: 10, content: '# 공지\n업데이트 **안내**\n- 기프트' },
      { type: 12, items: [{ media: { url: 'https://x/a.webp' } }] },
      { type: 10, content: '[링크](https://saigo-no-dante.com)' },
      { type: 14, divider: true, spacing: 1 },
      { type: 10, content: '-# [사이트에서 보기](https://saigo-no-dante.com/ko/announcements)' },
    ])
    expect(message.allowed_mentions.parse).toEqual([])
  })

  it('mentions everyone only when asked, on the first message', () => {
    const [first] = announcementDiscordMessages({ title: '공지', doc, everyone: true })
    expect(children(first)[0]).toEqual({ type: 10, content: '@everyone\n# 공지\n업데이트 **안내**\n- 기프트' })
    expect(first.allowed_mentions.parse).toEqual(['everyone'])
  })

  it('starts a new message before 40 components or 4000 characters', () => {
    const many = { type: 'doc', content: Array.from({ length: 50 }, (_, i) => [
      { type: 'paragraph', content: [text('문단 ' + i)] },
      { type: 'image', attrs: { src: 'https://x/' + i + '.webp' } },
    ]).flat() }
    const byCount = announcementDiscordMessages({ title: 't', doc: many, everyone: true })
    expect(byCount.length).toBeGreaterThan(1)
    expect(byCount.every(m => count(m) <= 40)).toBe(true)
    expect(byCount.flatMap(children).filter(c => c.type === 12)).toHaveLength(50)
    expect(byCount.slice(1).every(m => m.allowed_mentions.parse.length === 0)).toBe(true)

    const long = Array.from({ length: 200 }, (_, i) => 'x'.repeat(40) + i).join('\n')
    const byChars = announcementDiscordMessages({ title: 't', content: long })
    expect(byChars.length).toBeGreaterThan(1)
    expect(byChars.every(m => chars(m) <= 4000)).toBe(true)
    expect(byChars.flatMap(children).map(c => ('content' in c ? c.content : '')).join('\n')).toContain('x'.repeat(40) + 199)
  })
})

describe('sendAnnouncementToDiscord', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('asks the webhook to accept components, keeping its existing query', async () => {
    const fetch = vi.fn(async () => new Response(null, { status: 204 }))
    vi.stubGlobal('fetch', fetch)
    const messages = announcementDiscordMessages({ title: '공지', doc })
    expect(await sendAnnouncementToDiscord('https://discord.com/api/webhooks/1/abc?thread_id=9', messages)).toBe(true)
    const url = new URL(String((fetch.mock.calls[0] as unknown[])[0]))
    expect(url.searchParams.get('with_components')).toBe('true')
    expect(url.searchParams.get('thread_id')).toBe('9')
  })
})

import { describe, expect, it } from 'vitest'
import { announcementDiscordMessages } from '@/lib/discord/announcement'

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

describe('announcementDiscordMessages', () => {
  it('keeps markdown and splits around images', () => {
    const messages = announcementDiscordMessages({ title: '공지', doc })
    expect(messages).toHaveLength(3)
    expect(messages[0].content).toBe('# 공지\n업데이트 **안내**\n- 기프트')
    expect(messages[1].embeds?.[0].image.url).toBe('https://x/a.webp')
    expect(messages[2].content).toBe('[링크](https://saigo-no-dante.com)')
    expect(messages.every(m => m.allowed_mentions.parse.length === 0)).toBe(true)
  })

  it('mentions everyone only when asked, on the first message', () => {
    const [first, second] = announcementDiscordMessages({ title: '공지', doc, everyone: true })
    expect(first.content?.startsWith('@everyone\n# 공지')).toBe(true)
    expect(first.allowed_mentions.parse).toEqual(['everyone'])
    expect(second.allowed_mentions.parse).toEqual([])
  })

  it('splits long text at the 2000 character limit', () => {
    const long = Array.from({ length: 80 }, (_, i) => 'x'.repeat(40) + i).join('\n')
    const messages = announcementDiscordMessages({ title: 't', content: long })
    expect(messages.length).toBeGreaterThan(1)
    expect(messages.every(m => (m.content ?? '').length <= 2000)).toBe(true)
  })
})

import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import {
  announcementSchema,
  plainAnnouncementDocument,
  validAnnouncementDocument,
  announcementText,
  safeAnnouncementLink,
} from '@/lib/announcements'
import { inquirySchema, inquiryReplySchema } from '@/lib/support'
import AnnouncementBody from '@/components/announcements/AnnouncementBody'

describe('announcement content boundary', () => {
  it('keeps new announcements as drafts and prevents empty publication', () => {
    expect(announcementSchema.parse({ title: '초안' }).published).toBe(false)
    expect(
      announcementSchema.safeParse({ title: '공지', published: true }).success,
    ).toBe(false)
    expect(
      announcementSchema.safeParse({
        title: '공지',
        content: 'stale plain text',
        content_doc: plainAnnouncementDocument(''),
        published: true,
      }).success,
    ).toBe(false)
  })
  it('retains paragraphs, emphasis, and safely escapes source text', () => {
    const doc = plainAnnouncementDocument(
      '<script>alert(1)</script>\n두 번째 문단',
    )
    doc.content![1].content![0].marks = [{ type: 'italic' }, { type: 'bold' }]
    expect(validAnnouncementDocument(doc)).toBe(true)
    expect(announcementText(doc)).toContain('\n두 번째 문단')
    const html = renderToStaticMarkup(<AnnouncementBody doc={doc} text="" />)
    expect(html).not.toContain('<script>')
    expect(html).toContain('&lt;script&gt;')
    expect(html).toContain('<strong><em>두 번째 문단</em></strong>')
  })
  it('rejects HTML nodes, remote images, executable links and excessive nesting', () => {
    for (const child of [
      { type: 'html', text: '<script/>' },
      { type: 'image', attrs: { src: 'https://example.com/image.webp' } },
      {
        type: 'text',
        text: 'click',
        marks: [{ type: 'link', attrs: { href: 'javascript:alert(1)' } }],
      },
    ])
      expect(validAnnouncementDocument({ type: 'doc', content: [child] })).toBe(
        false,
      )
    let node: unknown = { type: 'paragraph' }
    for (let i = 0; i < 15; i++) node = { type: 'doc', content: [node] }
    expect(validAnnouncementDocument(node)).toBe(false)
    expect(safeAnnouncementLink('https://example.com')).toBe(true)
    expect(safeAnnouncementLink('data:text/html,test')).toBe(false)
  })
  it('renders existing plain notices without interpreting HTML', () => {
    expect(
      renderToStaticMarkup(
        <AnnouncementBody text="<img src=x onerror=alert(1)>" />,
      ),
    ).toContain('&lt;img')
  })
})
describe('inquiry validation', () => {
  it('never accepts user-provided owner or reply fields when creating', () => {
    expect(
      inquirySchema.parse({
        title: ' 테스트 ',
        content: '본문',
        category: 'bug',
        user_id: 'another-user',
        reply: 'forged',
        status: 'answered',
      }),
    ).toEqual({ title: '테스트', content: '본문', category: 'bug' })
  })
  it('requires a real reply before marking answered', () => {
    expect(
      inquiryReplySchema.safeParse({ reply: ' ', status: 'answered' }).success,
    ).toBe(false)
    expect(
      inquiryReplySchema.safeParse({ reply: '', status: 'closed' }).success,
    ).toBe(true)
  })
})

import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { announcementSchema } from '@/lib/announcement-schema'
import {
  plainAnnouncementDocument,
  validAnnouncementDocument,
  announcementText,
  safeAnnouncementLink,
  announcementExcerpt,
  announcementPreview,
  adjacentAnnouncements,
  announcementDate,
} from '@/lib/announcements'
import { inquirySchema, supportMessageSchema } from '@/lib/support'
import AnnouncementBody from '@/components/announcements/AnnouncementBody'
import AnnouncementPopupDialog from '@/components/announcements/AnnouncementPopupDialog'

vi.mock('next/navigation', () => ({ usePathname: () => '/en' }))
vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key, useLocale: () => 'en' }))
vi.mock('@/lib/i18n/navigation', () => ({ Link: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a> }))

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
  it('keeps popup off unless set, and opens a popup announcement only in the browser after its check', () => {
    expect(announcementSchema.parse({ title: '초안' }).popup).toBe(false)
    expect(announcementSchema.parse({ title: '공지', popup: true }).popup).toBe(true)
    // Server markup stays closed: whether the visitor already closed it is read from localStorage after hydration.
    const html = renderToStaticMarkup(
      <AnnouncementPopupDialog announcement={{ id: 'a', title: 'Assist', created_at: '2026-10-21T00:00:00Z', pinned: false, cover: null, excerpt: 'text' }} />,
    )
    expect(html).not.toContain('data-announcement-popup')
  })
})
const image = (name: string) => `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/limbus-assets/announcements/${name}.webp`
describe('announcement previews', () => {
  it('REQ-ADMIN-012 collapses whitespace and cuts the excerpt with an ellipsis', () => {
    expect(announcementExcerpt('  안녕하세요.\n\n  새   기능입니다.  ')).toBe('안녕하세요. 새 기능입니다.')
    expect(announcementExcerpt('가'.repeat(10), 6)).toBe('가가가가가…')
    expect(announcementExcerpt('')).toBe('')
  })
  it('REQ-ADMIN-012 keeps only id, title, date, pin, cover and excerpt', () => {
    const doc = { type: 'doc', content: [
      { type: 'paragraph', content: [{ type: 'text', text: '본문 첫 줄' }] },
      { type: 'image', attrs: { src: 'https://evil.example/x.webp' } },
      { type: 'image', attrs: { src: image('abc-1') } },
    ] }
    const preview = announcementPreview({ id: 'a1', title: '제목', content: '', content_doc: doc, pinned: true, created_at: '2026-10-21T09:00:00Z' })
    expect(preview).toEqual({ id: 'a1', title: '제목', created_at: '2026-10-21T09:00:00Z', pinned: true, cover: image('abc-1'), excerpt: '본문 첫 줄' })
    expect(announcementPreview({ id: 'b', title: 't', content: '평문', content_doc: null, pinned: false, created_at: '2026-10-01T00:00:00Z' }).excerpt).toBe('평문')
  })
  it('REQ-ADMIN-010 finds the older and newer announcement by creation date, whatever the pin order', () => {
    const items = [
      { id: 'pinned-old', created_at: '2026-09-01T00:00:00Z' },
      { id: 'new', created_at: '2026-10-20T00:00:00Z' },
      { id: 'mid', created_at: '2026-10-10T00:00:00Z' },
    ]
    expect(adjacentAnnouncements(items, 'mid')).toEqual({ older: items[0], newer: items[1] })
    expect(adjacentAnnouncements(items, 'new')).toEqual({ older: items[2], newer: null })
    expect(adjacentAnnouncements(items, 'missing')).toEqual({ older: null, newer: null })
    expect(announcementDate('2026-10-21T09:00:00Z')).toBe('2026.10.21')
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
  it('rejects blank thread messages', () => {
    expect(supportMessageSchema.safeParse({ body: ' ' }).success).toBe(false)
    expect(supportMessageSchema.safeParse({ body: 'Fixed' }).success).toBe(true)
  })
})

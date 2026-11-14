import { describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { renderToStaticMarkup } from 'react-dom/server'

vi.mock('next-intl', () => ({
  useTranslations: (namespace?: string) => (key: string) => [namespace, key].filter(Boolean).join('.'),
  useLocale: () => 'ko',
}))
// eslint-disable-next-line @next/next/no-img-element
vi.mock('next/image', () => ({ default: ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} />, getImageProps: ({ src, alt }: { src: string; alt: string }) => ({ props: { src, alt } }) }))
vi.mock('@/lib/i18n/navigation', () => ({ Link: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => <a href={href} {...rest}>{children}</a> }))

import AnnouncementList from '@/features/admin/components/AnnouncementList'
import AnnouncementBanner from '@/app/[lang]/(home)/_components/AnnouncementBanner'
import type { AnnouncementPreview } from '@/lib/announcements'

const item = (id: string, extra: Partial<AnnouncementPreview> = {}): AnnouncementPreview => ({
  id, title: `제목 ${id}`, created_at: '2026-10-21T09:00:00Z', pinned: false, cover: null, excerpt: `앞부분 ${id}`, ...extra,
})
const labels = { pinned: 'announcements.pinned', readMore: 'announcements.readMore', empty: 'announcements.empty' }
const source = (path: string) => readFileSync(resolve(__dirname, '../../../..', path), 'utf8')

describe('announcement list', () => {
  it('features the first announcement with its cover and links every row to its own page', () => {
    const html = renderToStaticMarkup(<AnnouncementList lang="ko" items={[item('a1', { pinned: true, cover: 'https://x/cover.webp' }), item('a2', { cover: 'https://x/thumb.webp' }), item('a3')]} labels={labels} />)
    for (const id of ['a1', 'a2', 'a3']) expect(html).toContain(`href="/ko/announcements/${id}"`)
    expect(html).toContain('src="https://x/cover.webp"')
    expect(html).toContain('src="https://x/thumb.webp"')
    expect(html).toContain('앞부분 a1')
    expect(html).toContain('2026.10.21')
    expect(html).toContain('announcements.pinned')
    expect(html.indexOf('제목 a1')).toBeLessThan(html.indexOf('제목 a2'))
    expect(html).not.toMatch(/uppercase/)
  })

  it('shows an empty state without announcements', () => {
    expect(renderToStaticMarkup(<AnnouncementList lang="ko" items={[]} labels={labels} />)).toContain('announcements.empty')
  })

  it('renders on the server without the old client list', () => {
    const page = source('app/[lang]/announcements/page.tsx')
    expect(page).toContain('AnnouncementList')
    expect(page).not.toContain('AnnouncementsClient')
  })

  it('has a cached detail page that 404s on a missing announcement', () => {
    const detail = source('app/[lang]/announcements/[id]/page.tsx')
    expect(detail).toContain('notFound()')
    expect(detail).toContain('adjacentAnnouncements')
    expect(detail).toContain('AnnouncementBody')
  })
})

describe('home announcement', () => {
  it('shows a preview with a link to the announcement, kept out of focus while folded', () => {
    const html = renderToStaticMarkup(<AnnouncementBanner announcement={item('a1', { cover: 'https://x/cover.webp' })} />)
    expect(html).toContain('aria-expanded="false"')
    expect(html).toContain('href="/announcements/a1"')
    expect(html).toContain('href="/announcements"')
    expect(html).toContain('앞부분 a1')
    expect(html).toMatch(/<div[^>]*inert=""[^>]*id="home-announcement-body"|id="home-announcement-body"[^>]*inert=""/)
  })
})

describe('popup announcement', () => {
  it('sends only the preview to the page, not the document', () => {
    const popup = source('features/admin/components/AnnouncementPopup.tsx')
    expect(popup).toContain('announcementPreview')
    expect(popup).not.toContain('content_doc')
    const dialog = source('features/admin/components/AnnouncementPopupDialog.tsx')
    expect(dialog).toContain('sheet')
    expect(dialog).toContain('/announcements/${announcement.id}')
  })

  it('fetches the cover at once and first, being the largest picture of the page when it opens', () => {
    const cover = source('features/admin/components/AnnouncementPopupDialog.tsx').match(/<QuietImage src=\{announcement\.cover\}[^>]*\/>/)?.[0]
    expect(cover).toContain('loading="eager"')
    expect(cover).toContain('fetchPriority="high"')
  })
})

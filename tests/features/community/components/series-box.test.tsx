import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

vi.mock('next-intl', () => ({
  useTranslations: (namespace?: string) => (key: string) => [namespace, key].filter(Boolean).join('.'),
  useLocale: () => 'ko',
}))
vi.mock('@/lib/i18n/navigation', () => ({ Link: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => <a href={href} {...rest}>{children}</a> }))

import SeriesBox from '@/features/community/components/SeriesBox'
import PostAuthorName from '@/features/community/components/PostAuthorName'
import type { SeriesView } from '@/features/community/lib/series-order'

const series: SeriesView = {
  id: 's1', title: '화상 입문', user_id: 'u1',
  items: [
    { kind: 'deck', id: 'a', title: '첫 덱', position: 0 },
    { kind: 'plan', id: 'b', title: '둘째 플랜', position: 1 },
    { kind: 'deck', id: 'c', title: '셋째 덱', position: 2 },
  ],
}

describe('REQ-COMMUNITY-041 series box', () => {
  const html = renderToStaticMarkup(<SeriesBox series={series} kind="plan" postId="b" />)
  it('shows the title, the position and the link to the whole series', () => {
    expect(html).toContain('화상 입문')
    expect(html).toContain('2/3')
    expect(html).toContain('href="/series/s1"')
  })
  it('links to the previous and next posts of either kind', () => {
    expect(html).toContain('href="/decks/a"')
    expect(html).toContain('href="/decks/c"')
  })
  it('lists every post in order and marks the current one', () => {
    const list = html.slice(html.indexOf('<ol'))
    expect(list.indexOf('첫 덱')).toBeLessThan(list.indexOf('둘째 플랜'))
    expect(list.indexOf('둘째 플랜')).toBeLessThan(list.indexOf('셋째 덱'))
    expect(html).toContain('href="/planner/community/b"')
    expect(html).toMatch(/aria-current="page"[^>]*>[\s\S]*?둘째 플랜/)
  })
  it('has no previous link on the first post', () => {
    const first = renderToStaticMarkup(<SeriesBox series={series} kind="deck" postId="a" />)
    expect(first).toContain('1/3')
    expect(first).not.toContain('series.prev')
  })
  it('renders nothing when the post is not in the series', () => {
    expect(renderToStaticMarkup(<SeriesBox series={series} kind="deck" postId="zzz" />)).toBe('')
  })
})

describe('REQ-COMMUNITY-043 post author name', () => {
  it('links to the profile when it is public', () => {
    const html = renderToStaticMarkup(<PostAuthorName userId="u1" username="작성자" profilePublic={true} className="x" />)
    expect(html).toContain('href="/users/u1"')
    expect(html).toContain('작성자')
  })
  it('treats a missing flag as public, as the deck card does', () => {
    expect(renderToStaticMarkup(<PostAuthorName userId="u1" username="작성자" className="x" />)).toContain('href="/users/u1"')
  })
  it('shows the name without a link when the profile is private or the author is a guest', () => {
    const hidden = renderToStaticMarkup(<PostAuthorName userId="u1" username="작성자" profilePublic={false} className="x" />)
    expect(hidden).toContain('작성자')
    expect(hidden).not.toContain('/users/')
    expect(renderToStaticMarkup(<PostAuthorName userId={null} username="익명 #1a2b" className="x" />)).not.toContain('/users/')
  })
})

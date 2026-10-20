import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it, vi } from 'vitest'

vi.mock('next-intl', () => ({ useLocale: () => 'ko', useTranslations: () => (key: string) => key }))
vi.mock('@/lib/i18n/navigation', () => ({ Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a> }))
vi.mock('@/components/board/BoardCard', () => ({
  default: ({ post, compactOnPhone }: { post: { id: string }; compactOnPhone?: boolean }) => <article data-card={post.id} data-compact={compactOnPhone ? '1' : '0'} />,
  RankPlate: () => null,
}))

import { BoardResults, BrowseBar } from '@/components/board/Browse'
import { BoardCardSkeleton, BoardShelfSkeleton, CardGridSkeleton, RailSkeleton } from '@/components/board/BoardShelfSkeleton'
import { Rail } from '@/components/board/shared'

const count = (html: string, needle: string) => html.split(needle).length - 1
const results = (props: Partial<React.ComponentProps<typeof BoardResults>> = {}) => renderToStaticMarkup(
  <BoardResults kind="deck" posts={[{ id: 'a', title: 'A' }, { id: 'b', title: 'B' }]} loading={false} hasMore={false} loadingMore={false} sentinelRef={() => {}} empty={<p data-empty>none</p>} {...props} />,
)

it('REQ-COMMUNITY-082 lists the posts as one card column on a phone, two from md and three from xl, with one row of portraits on a phone', () => {
  const html = results()
  expect(html).toContain('grid-cols-1')
  expect(html).toContain('md:grid-cols-2')
  expect(html).toContain('xl:grid-cols-3')
  expect(count(html, 'data-card=')).toBe(2)
  expect(count(html, 'data-compact="1"')).toBe(2)
})

it('REQ-COMMUNITY-082 shows the empty state when nothing matches and the loading shapes while loading', () => {
  expect(results({ posts: [] })).toContain('data-empty')
  const loading = results({ loading: true })
  expect(loading).not.toContain('data-card')
  expect(count(loading, 'overflow-hidden rounded-lg border'), 'six card shapes').toBe(6)
})

it('REQ-COMMUNITY-082 adds two card shapes under the list while the next page loads', () => {
  const html = results({ loadingMore: true, hasMore: true })
  expect(count(html, 'overflow-hidden rounded-lg border')).toBe(2)
})

it('REQ-COMMUNITY-082 puts the search field and the filters button on top of a phone list, with the result count and the sort', () => {
  const html = renderToStaticMarkup(
    <BrowseBar search={{ value: 'q', onChange: () => {}, onClear: () => {}, placeholder: 'search', label: 'label' }}
      sort={{ value: 'latest', options: [{ key: 'latest', label: 'L' }, { key: 'popular', label: 'P' }], onChange: () => {} }}
      filterCount={3} onOpenFilters={() => {}} summary="12" />,
  )
  expect(html).toContain('sticky-under-nav')
  expect(html).toContain('<input')
  expect(html).toContain('aria-label="filters"')
  expect(html).toContain('>3</span>')
  expect(html).toContain('aria-pressed="true"')
  expect(count(html, 'aria-pressed')).toBe(2)
  expect(html).toContain('lg:hidden')
})

it('REQ-COMMUNITY-083 draws the loading card with the same parts as the real card: twelve portraits, title and tags, a footer 44px high', () => {
  const html = renderToStaticMarkup(<BoardCardSkeleton />)
  expect(count(html, 'aspect-ratio:3 / 4')).toBe(12)
  expect(html).toContain('h-[1.375rem]')
  expect(html).toContain('h-6')
  expect(html).toContain('h-11')
  const list = renderToStaticMarkup(<BoardCardSkeleton phoneRows={1} />)
  expect(count(list, 'max-md:hidden')).toBe(6)
})

it('REQ-COMMUNITY-083 draws the loading shelves on the same rail and grid as the real shelves', () => {
  const real = renderToStaticMarkup(<Rail>{[<i key="a" />, <i key="b" />, <i key="c" />]}</Rail>)
  const shape = renderToStaticMarkup(<RailSkeleton />)
  for (const needle of ['md:grid-cols-2', 'xl:grid-cols-3', 'w-[78vw] max-w-[21rem]', '-mx-4 flex']) {
    expect(real).toContain(needle)
    expect(shape).toContain(needle)
  }
  const shelves = renderToStaticMarkup(<BoardShelfSkeleton />)
  expect(count(shelves, '<section')).toBe(2)
  expect(count(shelves, 'data-board-skeleton')).toBe(1)
  expect(renderToStaticMarkup(<CardGridSkeleton count={4} />).match(/overflow-hidden rounded-lg border/g)).toHaveLength(4)
})

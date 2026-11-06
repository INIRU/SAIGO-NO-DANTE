import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it, vi } from 'vitest'

vi.mock('next-intl', () => ({ useLocale: () => 'ko', useTranslations: () => (key: string) => key }))
vi.mock('next/image', () => ({ default: () => <img alt="" /> }))
vi.mock('@/lib/i18n/navigation', () => ({ Link: ({ children }: { children?: React.ReactNode }) => <a>{children}</a> }))
vi.mock('@/features/decks/components/FormationThumbnail', () => ({ Portrait: () => <span /> }))
vi.mock('@/components/ui/RelativeTime', () => ({ default: ({ date }: { date: string }) => <span data-relative={date} /> }))

import BoardCard from '@/features/community/components/BoardCard'

it('REQ-COMMUNITY-088 a deck or plan card shows how long ago it was posted, next to the author', () => {
  for (const kind of ['deck', 'planner'] as const) {
    const post = { id: 'a', title: 'A', created_at: '2026-10-20T03:00:00Z', vote_count: 1, view_count: 2, difficulty: 'normal', ...(kind === 'deck' ? { username: '단테' } : { profiles: { username: '단테' } }) }
    const html = renderToStaticMarkup(<BoardCard kind={kind} post={post} />)
    expect(html).toContain('data-relative="2026-10-20T03:00:00Z"')
    // In the footer, after the author and before the counts.
    expect(html.indexOf('단테')).toBeGreaterThan(-1)
    expect(html.indexOf('data-relative')).toBeGreaterThan(html.indexOf('단테'))
  }
  expect(renderToStaticMarkup(<BoardCard kind="deck" post={{ id: 'b', title: 'B' }} />)).not.toContain('data-relative')
})

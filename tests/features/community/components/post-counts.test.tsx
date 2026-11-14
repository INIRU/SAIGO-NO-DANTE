import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it, vi } from 'vitest'

vi.mock('next-intl', () => ({ useLocale: () => 'ko', useTranslations: () => (key: string) => key }))

import { PostCounts, PostSummary } from '@/features/community/components/BoardParts'

it('a board card shows its comment count next to votes and views when it has comments', () => {
  const html = renderToStaticMarkup(<PostCounts post={{ id: 'a', title: 'A', vote_count: 3, view_count: 40, comment_count: 7 }} />)
  expect(html).toContain('>3<')
  expect(html).toContain('>40<')
  expect(html).toContain('>7<')
  expect(html).toContain('data-count="comments"')
  expect(renderToStaticMarkup(<PostCounts post={{ id: 'b', title: 'B', vote_count: 0, view_count: 2, comment_count: 0 }} />)).not.toContain('data-count="comments"')
})

it('a board card shows the first line of the memo, and an empty line of the same height without one', () => {
  const html = renderToStaticMarkup(<PostSummary post={{ id: 'a', title: 'A', description: '## 운용\n[k:화상] 덱은 **강해요**' }} />)
  expect(html).toContain('운용 화상 덱은 강해요')
  expect(html).toContain('truncate')
  const empty = renderToStaticMarkup(<PostSummary post={{ id: 'b', title: 'B', description: null }} />)
  expect(empty).toContain('h-5')
  expect(empty).not.toContain('운용')
})

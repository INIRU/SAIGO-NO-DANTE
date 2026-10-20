import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it, vi } from 'vitest'

vi.mock('next-intl', () => ({ useLocale: () => 'ko', useTranslations: () => (key: string) => key }))

import { PostCounts } from '@/components/board/parts'

it('REQ-COMMUNITY-082 a board card shows its comment count next to votes and views when it has comments', () => {
  const html = renderToStaticMarkup(<PostCounts post={{ id: 'a', title: 'A', vote_count: 3, view_count: 40, comment_count: 7 }} />)
  expect(html).toContain('>3<')
  expect(html).toContain('>40<')
  expect(html).toContain('>7<')
  expect(html).toContain('data-count="comments"')
  expect(renderToStaticMarkup(<PostCounts post={{ id: 'b', title: 'B', vote_count: 0, view_count: 2, comment_count: 0 }} />)).not.toContain('data-count="comments"')
})

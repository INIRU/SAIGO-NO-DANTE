import { expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import BoardHeader from '@/components/discovery/BoardHeader'

vi.mock('@/lib/i18n/navigation', () => ({
  Link: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => <a href={href} {...rest}>{children}</a>,
}))
vi.mock('@/features/notes/components/NoteEditorGuide', () => ({ default: () => null }))

const header = (kind: 'deck' | 'planner', assist?: string) => renderToStaticMarkup(
  <BoardHeader kind={kind} title="플랜 게시판" action="새 플랜 만들기" viewAll="전체 플랜 보기" back="플랜 게시판으로" assist={assist} />,
)

it('opens Assist Mode setup from the planner board without any plan handoff', () => {
  const html = header('planner', '어시스트 모드')
  const link = /<a href="([^"]+)" data-board-assist[^>]*>(.*?)<\/a>/.exec(html)
  expect(link).not.toBeNull()
  expect(link![1]).toBe('/planner/run?entry=board')
  expect(link![1]).not.toMatch(/from-plan|plan=/)
  expect(link![2]).toContain('어시스트 모드')
  // Next to, not instead of, the board's own create action.
  expect(html).toContain('href="/planner"')
})

it('leaves the deck board header without an Assist Mode entry', () => {
  expect(header('deck')).not.toContain('data-board-assist')
})

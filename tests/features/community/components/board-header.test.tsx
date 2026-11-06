import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it, vi } from 'vitest'

vi.mock('@/lib/i18n/navigation', () => ({
  Link: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => <a href={href} {...rest}>{children}</a>,
}))
vi.mock('@/features/notes/components/NoteEditorGuide', () => ({ default: () => <div data-guide /> }))

import BoardHeader from '@/features/community/components/BoardHeader'

const header = (kind: 'deck' | 'planner', assist?: string) => renderToStaticMarkup(
  <BoardHeader kind={kind} title={kind === 'deck' ? '덱 게시판' : '플랜 게시판'} action={kind === 'deck' ? '새 덱 만들기' : '새 플랜 만들기'}
    viewAll={kind === 'deck' ? '전체 덱 보기' : '전체 플랜 보기'} back={kind === 'deck' ? '덱 게시판으로' : '플랜 게시판으로'} assist={assist} />,
)
const link = (html: string, label: string) => {
  const found = new RegExp(`<a href="([^"]+)"[^>]*aria-label="${label}"[^>]*class="([^"]*)"`).exec(html)
  return found && [found[0], found[1], found[2].replaceAll('&amp;', '&')]
}

it('REQ-COMMUNITY-081 puts the title, the guide, the all-posts button and the create button in one row, with no search field', () => {
  const html = header('deck')
  expect(html).toContain('>덱 게시판</h1>')
  expect(html).toContain('data-guide')
  expect(link(html, '전체 덱 보기')![1]).toBe('/decks?browse=all')
  expect(link(html, '새 덱 만들기')![1]).toBe('/decks/new')
  expect(html).not.toContain('<input')
  expect(html).not.toMatch(/<p[ >]/)
})

it('REQ-COMMUNITY-081 names the plan board buttons for plans and keeps the Assist Mode entry beside them', () => {
  const html = header('planner', '어시스트 모드')
  expect(link(html, '전체 플랜 보기')![1]).toBe('/planner/community?browse=all')
  expect(link(html, '새 플랜 만들기')![1]).toBe('/planner')
  expect(link(html, '어시스트 모드')![1]).toBe('/planner/run?entry=board')
})

it('REQ-COMMUNITY-081 swaps the all-posts button for the way back while the full list is open', () => {
  const html = header('deck')
  expect(link(html, '전체 덱 보기')![2]).toContain('[.community-board:has([data-board-browse])_&]:hidden')
  const back = link(html, '덱 게시판으로')!
  expect(back[1]).toBe('/decks')
  expect(back[2]).toMatch(/^hidden /)
  expect(back[2]).toContain('[.community-board:has([data-board-browse])_&]:flex')
})

it('REQ-COMMUNITY-081 shows only icons on a phone and labels from md up', () => {
  const html = header('deck')
  expect(html.match(/<span class="hidden [^"]*md:inline">[^<]+<\/span>/g)?.length).toBe(2)
  expect(html).toContain('hidden whitespace-nowrap text-[1rem] font-semibold sm:inline">새 덱 만들기')
})

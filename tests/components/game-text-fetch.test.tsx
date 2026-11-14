import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { GameTextRefNames } from '@/lib/game-text/ref-names'

const REFS: GameTextRefNames = { Combustion: { k: 'keyword', n: '화상', kw: '화상' } }
const requestedKeys: (string | null)[] = []

vi.mock('next-intl', () => ({ useLocale: () => 'ko', useTranslations: () => (key: string) => key }))
vi.mock('@/lib/i18n/navigation', () => ({ Link: 'a' }))
vi.mock('swr', () => ({
  default: (key: string | null) => (requestedKeys.push(key), { data: key?.startsWith('/api/game-text-refs/') ? REFS : undefined }),
  preload: () => Promise.resolve(),
}))

const refsRequests = () => requestedKeys.filter(key => key?.startsWith('/api/game-text-refs/'))

// The "wanted" flag of the reference table lives in a module: reload the modules so each test starts without it.
async function load() {
  vi.resetModules()
  const { KeywordProvider, useFormatSkillDesc } = await import('@/components/providers/KeywordProvider')
  type Options = Parameters<ReturnType<typeof useFormatSkillDesc>>[4]
  const Formatter = ({ text, options }: { text: string; options?: Options }) => <>{useFormatSkillDesc()(text, '#abcdef', undefined, undefined, options)}</>
  return (text: string, options?: Options) =>
    renderToStaticMarkup(<KeywordProvider keywords={{}}><Formatter text={text} options={options} /></KeywordProvider>)
}

describe('reference table is fetched only when a text needs it', () => {
  beforeEach(() => { requestedKeys.length = 0 })

  it('does not request the table for older stored text or plain text', async () => {
    const render = await load()
    render('[사용시] 화상 3 부여')
    render('[On Hit] Inflict 3 Burn {0}')
    render('')
    expect(refsRequests()).toEqual([])
  })

  // Game text always goes through GameText now, so a text with only styling tags (no ref, link or
  // sprite) has nothing to look up in the table; the client asks for it later through wantGameTextRefs, which a
  // server render cannot observe.
  it('requests the table once a text holds a ref, and not for plain or only styled text', async () => {
    const render = await load()
    render('화상 3 부여')
    render('<b>굵게</b>')
    expect(refsRequests()).toEqual([])
    render('<b>굵게</b> [Combustion]')
    expect(refsRequests()).toContain('/api/game-text-refs/ko')
  })
})

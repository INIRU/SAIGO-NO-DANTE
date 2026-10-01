import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { GameTextRefNames } from '@/lib/db/game-text-refs'

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

describe('REQ-SHARED-019 reference table is fetched only when a text needs it', () => {
  beforeEach(() => { requestedKeys.length = 0 })

  it('REQ-SHARED-019 does not request the table for older stored text or plain text', async () => {
    const render = await load()
    render('[사용시] 화상 3 부여')
    render('[On Hit] Inflict 3 Burn {0}')
    render('')
    expect(refsRequests()).toEqual([])
  })

  it('REQ-SHARED-019 does not request the table for user notes, even with game markers (they keep the previous path)', async () => {
    const render = await load()
    render('<b>굵게</b> [Combustion]', { escapeKeywords: true })
    expect(refsRequests()).toEqual([])
  })

  it('REQ-SHARED-019 requests the table once a text holds a Unity tag', async () => {
    const render = await load()
    render('<b>굵게</b>')
    expect(refsRequests()).toContain('/api/game-text-refs/ko')
  })
})

import { readFileSync } from 'node:fs'
import { renderToString } from 'react-dom/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { KeywordProvider, useFormatSkillDesc, type KeywordInfo } from '@/components/providers/KeywordProvider'
import { GameTextRefsProvider } from '@/components/providers/GameTextRefsProvider'
import { compactGameTextRefNames } from '@/lib/game-text/ref-names-wire'
import { usePlainGameText } from '@/hooks/usePlainGameText'
import type { GameTextRefNames } from '@/lib/game-text/ref-names'

const REFS: GameTextRefNames = {
  Combustion: { k: 'keyword', n: '화상', kw: '화상' },
  OnSucceedAttack: { k: 'skilltag', n: '[적중시]' },
}
const KEYWORDS: Record<string, KeywordInfo> = { 화상: { desc: '', iconSlug: 'burn', effectType: 'negative' } }
const RAW = '[OnSucceedAttack] [Combustion] 3 부여'

let pageLocale = 'ko'
vi.mock('next-intl', () => ({ useLocale: () => pageLocale, useTranslations: () => (key: string) => key }))
vi.mock('@/lib/i18n/navigation', () => ({ Link: 'a' }))

const fetchMock = vi.fn()
beforeEach(() => {
  pageLocale = 'ko'
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
})
afterEach(() => { vi.unstubAllGlobals() })

function Formatter({ text }: { text: string }) {
  return <>{useFormatSkillDesc()(text, '#abcdef')}</>
}
function Plain({ text }: { text: string }) {
  return <>{usePlainGameText()(text)}</>
}
const withRefs = (node: React.ReactNode, locale = 'ko') => (
  <GameTextRefsProvider locale={locale} names={compactGameTextRefNames(REFS)}><KeywordProvider keywords={KEYWORDS}>{node}</KeywordProvider></GameTextRefsProvider>
)

describe('the first paint already has the reference names', () => {
  it('server render resolves [Id] to names and condition labels with no request', () => {
    const html = renderToString(withRefs(<Formatter text={RAW} />))
    expect(html).toContain('>화상<')
    expect(html).toContain('>[적중시]<')
    expect(html).toContain('data-game-ref="Combustion"')
    expect(html).not.toContain('[Combustion]')
    expect(html).not.toContain('OnSucceedAttack')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('draws the same markup whether or not the page has started asking for the table (hydration agrees)', async () => {
    const server = renderToString(withRefs(<Formatter text={RAW} />))
    // The client side of the lazy request flag: set once a text that may hold a ref was formatted in the browser.
    vi.stubGlobal('window', {})
    vi.resetModules()
    const hook = await import('@/hooks/useGameTextRefs')
    hook.wantGameTextRefs()
    const { KeywordProvider: Keywords, useFormatSkillDesc: useFormat } = await import('@/components/providers/KeywordProvider')
    const { GameTextRefsProvider: Refs } = await import('@/components/providers/GameTextRefsProvider')
    const Inner = () => <>{useFormat()(RAW, '#abcdef')}</>
    const client = renderToString(<Refs locale="ko" names={compactGameTextRefNames(REFS)}><Keywords keywords={KEYWORDS}><Inner /></Keywords></Refs>)
    expect(client).toBe(server)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('lazy readers (plain text) have the names on the first render too', () => {
    const html = renderToString(withRefs(<Plain text="[Combustion] 3 부여" />))
    expect(html).toBe('화상 3 부여')
  })

  it('ignores names of another language than the page (the table is requested instead)', () => {
    pageLocale = 'en'
    const html = renderToString(withRefs(<Formatter text={RAW} />, 'ko'))
    expect(html).toContain('[Combustion]')
    expect(html).not.toContain('>화상<')
  })

  it('without a provider the first render still shows the raw id (the request fills it in later)', () => {
    const html = renderToString(<KeywordProvider keywords={KEYWORDS}><Formatter text={RAW} /></KeywordProvider>)
    expect(html).toContain('[Combustion]')
  })

  it('the root [lang] layout feeds the provider from the cached server read, outside the keyword provider', () => {
    const source = readFileSync('app/[lang]/layout.tsx', 'utf8')
    expect(source).toContain("getGameTextRefNamesWireOrNull(validLang)")
    const provider = source.indexOf('<GameTextRefsProvider')
    expect(provider).toBeGreaterThan(-1)
    expect(provider).toBeLessThan(source.indexOf('<KeywordProvider'))
  })
})

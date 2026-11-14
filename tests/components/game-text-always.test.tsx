import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { KeywordProvider, useFormatSkillDesc, type KeywordInfo } from '@/components/providers/KeywordProvider'
import type { GameTextRefNames } from '@/lib/db/game-text-refs'

const REFS: GameTextRefNames = { Combustion: { k: 'keyword', n: '화상', kw: '화상' } }

vi.mock('next-intl', () => ({ useLocale: () => 'ko', useTranslations: () => (key: string) => key }))
vi.mock('@/lib/i18n/navigation', () => ({ Link: 'a' }))
vi.mock('swr', () => ({
  default: (key: string | null) => ({ data: key?.startsWith('/api/game-text-refs/') ? REFS : undefined }),
  preload: () => Promise.resolve(),
}))

const KEYWORDS: Record<string, KeywordInfo> = { 화상: { desc: '', iconSlug: 'burn', effectType: 'negative' } }

type Format = ReturnType<typeof useFormatSkillDesc>
type FormatArgs = Parameters<Format> extends [unknown, unknown, ...infer Rest] ? Rest : never
function Formatter({ text, args }: { text: string; args: FormatArgs }) {
  const format = useFormatSkillDesc()
  return <>{format(text, '#abcdef', ...args)}</>
}
const render = (text: string, ...args: FormatArgs) =>
  renderToStaticMarkup(<KeywordProvider keywords={KEYWORDS}><Formatter text={text} args={args} /></KeywordProvider>)

describe('game text is always drawn by the game text renderer', () => {
  it('does not turn a plain game string with "화상" into a keyword', () => {
    const html = render('화상 3 부여')
    expect(html).toContain('화상 3 부여')
    expect(html).not.toContain('keyword-token')
    expect(html).not.toContain('<img')
    expect(html).not.toContain('color:#ff4f42')
  })

  it('does not colour [사용시]-style old brackets or search plain words in a tagged string either', () => {
    const html = render('<b>화상</b> [사용시]')
    expect(html).not.toContain('keyword-token')
    expect(html).toContain('[사용시]')
    expect(html).not.toContain('color:#26cfff')
  })

  it('still renders [Id] refs of a raw string as keywords', () => {
    const html = render('[Combustion] 3 부여, 화상')
    expect(html.match(/keyword-token/g)).toHaveLength(1)
    expect(html).toContain('data-game-ref="Combustion"')
  })

  it('ignores allowedKeywords for game text (only tagged refs render) and keeps skill-name colours', () => {
    const html = render('화상 후 벼락치기 사용', { '벼락치기': '#ff0000' }, new Set(['화상']))
    expect(html).not.toContain('keyword-token')
    expect(html).toMatch(/<span style="color:#ff0000;font-weight:600">벼락치기<\/span>/)
  })

  it('highlights numbers and Potency/Count terms in tooltips, also inside the tags whose colour is dropped', () => {
    const html = render('위력 +3 증가 <style="highlight">5</style>', undefined, undefined, { highlightValues: '#123456' })
    expect(html).toMatch(/<b style="color:#e8b030;font-weight:700">\+3<\/b>/)
    expect(html).toContain('color:#123456;font-weight:600">위력<')
    expect(html).toMatch(/<b style="color:#e8b030;font-weight:700">5<\/b>/)
  })
})

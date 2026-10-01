import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { KeywordProvider, useFormatSkillDesc, type KeywordInfo } from '@/components/providers/KeywordProvider'
import type { GameTextRefNames } from '@/lib/db/game-text-refs'

const REFS: GameTextRefNames = {
  Combustion: { k: 'keyword', n: '화상', kw: '화상' },
  OnSucceedAttack: { k: 'skilltag', n: '[적중시]' },
}

vi.mock('next-intl', () => ({ useLocale: () => 'ko', useTranslations: () => (key: string) => key }))
vi.mock('@/lib/i18n/navigation', () => ({ Link: 'a' }))
vi.mock('swr', () => ({
  default: (key: string | null) => ({ data: key?.startsWith('/api/game-text-refs/') ? REFS : undefined }),
  preload: () => Promise.resolve(),
}))

const KEYWORDS: Record<string, KeywordInfo> = { 화상: { desc: '', iconSlug: 'burn', effectType: 'negative' } }

function Formatter({ text }: { text: string }) {
  const format = useFormatSkillDesc()
  return <>{format(text, '#abcdef')}</>
}
const render = (text: string) => renderToStaticMarkup(<KeywordProvider keywords={KEYWORDS}><Formatter text={text} /></KeywordProvider>)

describe('REQ-KEYWORDS-005 keywords of game text are underlined', () => {
  it('REQ-KEYWORDS-005 underlines a [Id] keyword in its own colour, not a condition tag', () => {
    const html = render('[OnSucceedAttack] [Combustion] 3 부여')
    const keyword = html.slice(html.indexOf('화상') - 400, html.indexOf('화상'))
    expect(keyword).toContain('text-decoration-line:underline')
    expect(keyword).toContain('currentColor')
    const tag = html.slice(0, html.indexOf('[적중시]'))
    expect(tag.slice(tag.lastIndexOf('<span'))).not.toContain('underline')
  })
})

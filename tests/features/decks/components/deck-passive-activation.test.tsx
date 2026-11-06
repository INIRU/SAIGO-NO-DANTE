import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import DeckInsights, { type DeckInsightIdentity, type DeckInsightPassive } from '@/features/decks/components/DeckInsights'

vi.mock('next-intl', () => ({
  useLocale: () => 'ko',
  useTranslations: () => (key: string, values?: Record<string, number>) => (values ? `${key}:${Object.values(values).join(',')}` : key),
}))
vi.mock('next/image', () => ({ default: ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} /> }))
vi.mock('@/components/providers/KeywordProvider', () => ({ useKeywordData: () => ({ keywords: {} }) }))
vi.mock('@/components/planner/KeywordChart', () => ({ default: () => null }))
vi.mock('@/features/catalog/components/SkillDescription', () => ({ default: () => null }))

const passive = (id: string, passive_type: string, active_cond: string | null, sin: string, count: number): DeckInsightPassive => ({
  id, name: id, description: null, passive_type, sin_affinity: sin, sin_count: count, sin_requirements: [{ sin, count }], active_cond,
})
const identity = (id: string, passives: DeckInsightPassive[], deck?: DeckInsightIdentity['deck']): DeckInsightIdentity => ({
  id, name: id, sinnerName: '수인', imageUrl: '', keywords: [], passives, deck,
})

const fielded = identity('fielded', [
  passive('stock-wrath', 'battle', 'stock', 'wrath', 1),
  passive('stock-envy', 'battle', 'stock', 'envy', 1),
  passive('res-wrath', 'battle', 'resonance', 'wrath', 3),
  passive('plain', 'battle', null, 'wrath', 1),
  passive('support-of-fielded', 'support', 'stock', 'wrath', 1),
], { wrath: 6 })
const bench = identity('bench', [
  passive('support-of-bench', 'support', 'stock', 'wrath', 1),
  passive('battle-of-bench', 'battle', 'stock', 'wrath', 1),
], { pride: 6 })

// The static markup shows the battle tab; who a support passive is rated for is REQ-DECKS-025 (rateIdentityPassive).
const render = (identities: DeckInsightIdentity[], deployedIds?: Set<string>) =>
  renderToStaticMarkup(<DeckInsights identities={identities} sinCounts={{ wrath: 6 }} deployedIds={deployedIds} />)
const names = (html: string) => [...html.matchAll(/class="deck-passive__name">([^<]*)</g)].map(match => match[1])
const rate = (html: string, name: string) => {
  const from = html.indexOf(`class="deck-passive__name">${name}<`)
  const row = html.slice(from, html.indexOf('</div>', from))
  return row.match(/class="deck-passive__rate" data-level="(\w+)"(?: title="([^"]*)")?>([^<]*)</)
}

describe('REQ-DECKS-026 passive activation marker', () => {
  const html = render([fielded, bench], new Set(['fielded']))

  it('REQ-DECKS-026 marks stock and resonance passives with their level in the viewer\'s language and the value as a tooltip', () => {
    expect(rate(html, 'stock-wrath')?.slice(1)).toEqual(['easy', 'stats.activationTurns:1', 'stats.activation.easy'])
    expect(rate(html, 'res-wrath')?.[1]).toBe('easy')
    expect(rate(html, 'res-wrath')?.[2]).toMatch(/^stats\.activationChance:\d+$/)
    expect(rate(html, 'stock-envy')?.slice(1)).toEqual(['impossible', undefined, 'stats.activation.impossible'])
  })

  it('REQ-DECKS-026 puts impossible and hard first in an identity\'s list and leaves unconditional passives unmarked', () => {
    expect(names(html)).toEqual(['stock-envy', 'stock-wrath', 'res-wrath', 'plain', 'battle-of-bench'])
    expect(rate(html, 'plain')).toBeNull()
  })

  it('REQ-DECKS-026 leaves a battle passive of a benched identity unmarked', () => {
    expect(rate(html, 'battle-of-bench')).toBeNull()
  })

  it('REQ-DECKS-026 rates every placed identity while nobody is deployed, and nothing without skill decks', () => {
    const building = render([fielded, bench])
    // The bench identity's own deck is pride, but every placed identity fields wrath through the other one.
    expect(rate(building, 'battle-of-bench')?.[1]).toBe('easy')
    const noDeck = render([{ ...fielded, deck: undefined }], new Set(['fielded']))
    expect(noDeck).not.toContain('class="deck-passive__rate"')
  })
})

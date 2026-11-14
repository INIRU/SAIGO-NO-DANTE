import { renderToStaticMarkup } from 'react-dom/server'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import DeckInsights, { type DeckInsightIdentity, type DeckInsightPassive } from '@/features/decks/components/DeckInsights'

vi.mock('next-intl', () => ({
  useLocale: () => 'ko',
  useTranslations: () => (key: string, values?: Record<string, number>) => (values ? `${key}:${Object.values(values).join(',')}` : key),
}))
vi.mock('next/image', () => ({ default: ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} /> }))
vi.mock('@/components/providers/KeywordProvider', () => ({ useKeywordData: () => ({ keywords: {} }) }))
vi.mock('@/features/planner/components/KeywordChart', () => ({ default: () => null }))
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

// The static markup shows the battle tab; who a support passive is rated for is tested with rateIdentityPassive in tests/features/decks/lib/passive-activation.test.ts.
const render = (identities: DeckInsightIdentity[], deployedIds?: Set<string>) =>
  renderToStaticMarkup(<DeckInsights identities={identities} sinCounts={{ wrath: 6 }} deployedIds={deployedIds} />)
const names = (html: string) => [...html.matchAll(/class="deck-passive" data-name="([^"]*)"/g)].map(match => match[1])
const rate = (html: string, name: string) => {
  const from = html.indexOf(`data-name="${name}"`)
  const next = html.indexOf('class="deck-passive"', from + 1)
  const row = html.slice(from, next < 0 ? undefined : next)
  return row.match(/class="deck-passive__rate" data-level="(\w+)"(?: title="([^"]*)")?>([^<]*)</)
}

describe('passive activation marker', () => {
  const html = render([fielded, bench], new Set(['fielded']))

  it('marks stock and resonance passives with their level in the viewer\'s language and the value as a tooltip', () => {
    expect(rate(html, 'stock-wrath')?.slice(1)).toEqual(['easy', 'stats.activationTurns:1', 'stats.activation.easy'])
    expect(rate(html, 'res-wrath')?.[1]).toBe('easy')
    expect(rate(html, 'res-wrath')?.[2]).toMatch(/^stats\.activationChance:\d+$/)
    expect(rate(html, 'stock-envy')?.slice(1)).toEqual(['impossible', undefined, 'stats.activation.impossible'])
  })

  it('puts impossible and hard first in an identity\'s list and leaves unconditional passives unmarked', () => {
    expect(names(html)).toEqual(['stock-envy', 'stock-wrath', 'res-wrath', 'plain', 'battle-of-bench'])
    expect(rate(html, 'plain')).toBeNull()
  })

  it('leaves a battle passive of a benched identity unmarked', () => {
    expect(rate(html, 'battle-of-bench')).toBeNull()
  })

  it('rates every placed identity while nobody is deployed, and nothing without skill decks', () => {
    const building = render([fielded, bench])
    // The bench identity's own deck is pride, but every placed identity fields wrath through the other one.
    expect(rate(building, 'battle-of-bench')?.[1]).toBe('easy')
    const noDeck = render([{ ...fielded, deck: undefined }], new Set(['fielded']))
    expect(noDeck).not.toContain('class="deck-passive__rate"')
  })
})

describe('passive list', () => {
  const html = render([fielded], new Set(['fielded']))

  it('names each passive with the identity page\'s passive name plate, so passives in a group stand apart', () => {
    const plates = [...html.matchAll(/class="deck-passive" data-name="([^"]*)"[\s\S]*?data-skill-name-banner[\s\S]*?<span[^>]*>([^<]*)<\/span>/g)]
    expect(plates.map(match => match[2])).toEqual(names(html))
    expect(plates.length).toBe(4)
  })

  it('lets a page scroll pass through the passive list (wheel intent, native chaining at its ends)', () => {
    const source = readFileSync(resolve(__dirname, '../../../../features/decks/components/DeckInsights.tsx'), 'utf8')
    expect(source).toMatch(/useWheelIntent\(scrollRef\)/)
    expect(source).toMatch(/className="deck-insights__scroll" ref=\{scrollRef\}/)
    expect(source).not.toMatch(/overscroll-behavior: contain/)
  })
})

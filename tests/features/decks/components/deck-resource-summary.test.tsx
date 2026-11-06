import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import DeckResourceSummary from '@/features/decks/components/DeckResourceSummary'
import type { DeckResources } from '@/features/decks/lib/deck-analysis'

vi.mock('next-intl', () => ({ useTranslations: () => (key: string, values?: { count?: number }) => values?.count === undefined ? key : `${key}:${values.count}` }))

const sins = (values: Partial<DeckResources['production']>) => ({ wrath: 0, lust: 0, sloth: 0, gluttony: 0, gloom: 0, pride: 0, envy: 0, ...values })
const resources: DeckResources = {
  identities: 7, deployedOnly: true,
  attack: { skills: { slash: 24, pierce: 12, blunt: 6 }, defense: { evade: 5, defense: 2, counter: 0 }, ego: { slash: 2, pierce: 0, blunt: 3 } },
  production: sins({ wrath: 7, lust: 4 }),
  egoCost: sins({ wrath: 2, lust: 5, envy: 1 }),
}
const section = (html: string, from: string, to?: string) => html.slice(html.indexOf(from), to ? html.indexOf(to) : undefined)

describe('deck resource summary', () => {
  it('REQ-DECKS-018 REQ-PLANNER-023 draws the deployed identities\' attack types and sin production in the keyword chart\'s bars', () => {
    const html = renderToStaticMarkup(<DeckResourceSummary resources={resources} />)
    // Whose numbers these are, beside both titles.
    expect(html.match(/stats\.keywordDeployed:7/g)).toHaveLength(2)
    // One bar and one number a row: nothing of the bench is drawn.
    expect(html).not.toContain('opacity:0.32')
    const attack = section(html, 'deck-attack-types', 'data-deck-defense')
    expect(attack).toContain('>24<')
    expect(attack).toContain('>12<')
    const produced = section(html, 'deck-sin-resources', 'data-deck-ego-cost')
    expect(produced).toContain('>7<')
    expect(produced).toContain('>4<')
    // A sin the deck does not produce has no bar.
    expect(produced).not.toContain('envy')
  })

  it('REQ-DECKS-018 lists defensive skills, EGO skill types and EGO costs under the bars instead of in them', () => {
    const html = renderToStaticMarkup(<DeckResourceSummary resources={resources} />)
    const defense = section(html, 'data-deck-defense', 'data-deck-ego-attack')
    expect(defense).toMatch(/evade <strong>5<\/strong>/)
    expect(defense).not.toContain('counter')
    const ego = section(html, 'data-deck-ego-attack', 'deck-sin-resources')
    expect(ego).toMatch(/slash <strong>2<\/strong>/)
    expect(ego).toMatch(/blunt <strong>3<\/strong>/)
    expect(ego).not.toContain('pierce')
    // A cost the deployed identities cannot pay is marked: lust costs 5 of 4 produced, envy 1 of none.
    const cost = section(html, 'data-deck-ego-cost')
    expect(cost).toMatch(/data-sin="wrath" title="wrath">.*?<strong>2<\/strong>/)
    expect(cost).toMatch(/data-sin="lust" data-short="true"[^>]*>.*?<strong>5<\/strong>/)
    expect(cost).toMatch(/data-sin="envy" data-short="true"/)
  })

  it('REQ-DECKS-018 says so when nobody is deployed and every placed identity is counted', () => {
    const html = renderToStaticMarkup(<DeckResourceSummary resources={{ ...resources, identities: 12, deployedOnly: false, attack: { ...resources.attack, ego: { slash: 0, pierce: 0, blunt: 0 } }, egoCost: sins({}) }} />)
    expect(html).toContain('stats.keywordAll:12')
    expect(html).not.toContain('data-deck-ego-attack')
    expect(html).not.toContain('data-deck-ego-cost')
  })
})

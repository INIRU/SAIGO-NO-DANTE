import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it, vi } from 'vitest'
import DeckInsights, { type DeckInsightIdentity } from '@/features/decks/components/DeckInsights'

vi.mock('next-intl', () => ({ useLocale: () => 'ko', useTranslations: () => (key: string) => key }))
vi.mock('next/image', () => ({ default: ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} /> }))
vi.mock('@/components/providers/KeywordProvider', () => ({ useKeywordData: () => ({ keywords: {} }) }))
vi.mock('@/features/planner/components/KeywordChart', () => ({ default: () => null }))
vi.mock('@/features/catalog/components/SkillDescription', () => ({ default: () => null }))

const identity = (sin_requirements: { sin: string; count: number }[]): DeckInsightIdentity => ({
  id: 'i1',
  name: '인격',
  sinnerName: '수인',
  imageUrl: '',
  keywords: [],
  passives: [{
    id: 'p1',
    name: '검은 언약',
    description: null,
    passive_type: 'battle',
    sin_affinity: '오만',
    sin_count: 1,
    sin_requirements,
    active_cond: 'stock',
  }],
})

const render = (sinCounts: Record<string, number>, requirements = [{ sin: 'pride', count: 1 }, { sin: 'envy', count: 2 }]) =>
  renderToStaticMarkup(<DeckInsights identities={[identity(requirements)]} sinCounts={sinCounts} baseSinCounts={{ pride: 3, envy: 3 }} />)

const costIcons = (html: string) => html.match(/<img[^>]*>/g)?.filter(tag => tag.includes('pride') || tag.includes('envy')) ?? []

it('REQ-CATALOG-016 draws every sin of a passive with its own count', () => {
  const html = render({ pride: 1, envy: 2 })
  expect(costIcons(html)).toHaveLength(2)
  expect(html).toContain('1/1')
  expect(html).toContain('2/2')
  expect(html).not.toContain('data-unmet="true"')
})

it('REQ-CATALOG-016 marks the passive unmet when only one sin falls short and warns about the distribution', () => {
  const html = render({ pride: 5, envy: 1 })
  expect(costIcons(html)).toHaveLength(2)
  expect(html).toContain('5/1')
  expect(html).toContain('1/2')
  expect(html).toContain('data-unmet="true"')
  expect(html).toContain('class="deck-passive__warn"')
})

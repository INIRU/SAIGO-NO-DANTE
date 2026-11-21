import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import ko from '@/messages/ko.json'
import en from '@/messages/en.json'
import ja from '@/messages/ja.json'
import { copy as LUNACY_COPY } from '@/features/tools/lib/lunacy/copy'

// DESIGN.md "하지 않는 것": sentences that introduce a feature, spell out a rule, or hint before any click.
const REMOVED = [
  'experience.subtitle', 'experience.inventoryHelp', 'experience.planHelp', 'experience.excessHelp', 'experience.skipHelp', 'experience.fixed',
  'damage.subtitle', 'clash.subtitle',
  'decks.detail.boardHint', 'decks.detail.boardHintShort',
  'decks.recommendations.otherOpinionsDescription', 'decks.recommendations.similarDecksDescription',
  'planner.detail.floorPlanCaption', 'planner.deckTab.identity.openDetailHint',
]

const at = (catalog: unknown, path: string) =>
  path.split('.').reduce<unknown>((node, key) => (node as Record<string, unknown> | undefined)?.[key], catalog)

describe.each([['ko', ko], ['en', en], ['ja', ja]])('%s catalog', (_, catalog) => {
  it.each(REMOVED)('has no %s', path => {
    expect(at(catalog, path)).toBeUndefined()
  })
})

describe.each(Object.entries(LUNACY_COPY))('lunacy copy (%s)', (_, copy) => {
  it('has no intro or notice paragraph, and one sentence of assumption', () => {
    expect(copy).not.toHaveProperty('intro')
    expect(copy).not.toHaveProperty('notice')
    expect(copy.assumption.match(/[.。]/g)).toHaveLength(1)
  })
})

// DESIGN.md "글꼴": numbers use the number face; monospace is for code and keys only.
it('the experience calculator sets no number in monospace', () => {
  expect(readFileSync('features/tools/components/ExperienceCalculator.module.css', 'utf8')).not.toContain('--font-mono')
  expect(readFileSync('features/tools/components/ExperienceCalculator.tsx', 'utf8')).not.toContain('--font-mono')
})

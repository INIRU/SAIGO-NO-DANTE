import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = (path: string) => readFileSync(join(process.cwd(), path), 'utf8')

describe('deck notes open the gift a label names', () => {
  it('the deck detail page provides the note gift click handler and the gift modal of the plan detail page', () => {
    const deck = source('app/[lang]/decks/[id]/DeckDetailClient.tsx')
    // Without the provider NoteGiftLabel renders a plain <span>: the label cannot be pressed.
    expect(deck).toMatch(/<NoteGiftClickContext value=\{openNoteGift\}>/)
    expect(deck).toContain('/api/ego-gifts?key=')
    expect(deck).toContain('<PlannerGiftModal')
    expect(source('app/[lang]/planner/community/[id]/PlanDetailClient.tsx')).toContain('findNoteGift(')
  })
})

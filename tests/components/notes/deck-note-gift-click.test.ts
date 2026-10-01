import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = (path: string) => readFileSync(join(process.cwd(), path), 'utf8')

describe('REQ-DECKS-014 deck notes open the gift a label names', () => {
  it('REQ-DECKS-014 the deck detail page provides the note gift click handler and a gift detail modal, like the plan detail page', () => {
    const deck = source('app/[lang]/decks/[id]/DeckDetailClient.tsx')
    // Without the provider NoteGiftLabel renders a plain <span>: the label cannot be pressed.
    expect(deck).toMatch(/<NoteGiftClickContext value=\{openNoteGift\}>/)
    expect(deck).toContain('findNoteGift(')
    expect(deck).toContain('<GiftDetailModal')
    expect(source('app/[lang]/planner/community/[id]/PlanDetailClient.tsx')).toContain('findNoteGift(')
  })
})

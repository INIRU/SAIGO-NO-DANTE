import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const detail = readFileSync(join(process.cwd(), 'app/[lang]/decks/[id]/DeckDetailClient.tsx'), 'utf8')
const reactions = readFileSync(join(process.cwd(), 'features/decks/hooks/useDeckReactions.ts'), 'utf8')

describe('REQ-DECKS-057 the vote count starts from the server value', () => {
  it('REQ-DECKS-057 the count state starts at the server deck vote_count', () => {
    expect(detail).toMatch(/initialVoteCount: initialDeck\?\.vote_count \?\? 0/)
    expect(reactions).toMatch(/useState\(initialVoteCount\)/)
  })

  it('REQ-DECKS-057 undoing a vote never goes below zero', () => {
    expect(reactions).toMatch(/Math\.max\(0, c - 1\)/)
    expect(reactions).not.toMatch(/data\.voted \? c \+ 1 : c - 1/)
  })
})

import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'

// A `fill` image is absolutely placed in its nearest positioned box. Styles written with styled-jsx can arrive after the
// first paint (Safari, streamed pages), so the box that holds a fill image must be positioned and sized with global classes.
const frames = [
  ['features/decks/components/DeckInsights.tsx', 'deck-passives__thumb'],
  ['features/planner/components/SkillExchangePanel.tsx', 'skx__thumb'],
  ['features/planner/components/SuggestionNote.tsx', 'aria-expanded={open}'],
] as const

it('keeps the passive, skill exchange and partner thumbnails in their box before their scoped styles arrive', () => {
  for (const [file, marker] of frames) {
    const line = readFileSync(file, 'utf8').split('\n').find(text => text.includes(marker) && text.includes('className='))
    expect(line, `${file}: ${marker}`).toMatch(/className="[^"]*\brelative\b[^"]*\bh-\S+[^"]*\bw-\S+/)
  }
})

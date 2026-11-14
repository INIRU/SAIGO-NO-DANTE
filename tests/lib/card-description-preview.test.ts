import { describe, expect, it } from 'vitest'
import { NOTE_PREFIX, notePlainText, notePreviewText, noteSummaryText } from '@/lib/notes/blocks'
import { formatDiscoveryPosts } from '@/features/community/lib/recommend'
import { stripPlanForList } from '@/lib/planner/strip-plan-for-list'

const note = NOTE_PREFIX + JSON.stringify({
  type: 'doc',
  content: [
    { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: '개요' }] },
    { type: 'paragraph', content: [
      { type: 'text', text: '침잠을 쌓고 ' },
      { type: 'noteKeyword', attrs: { id: 'Sinking' } },
      { type: 'text', text: ' 위에 ' },
      { type: 'noteGift', attrs: { name: '우울한 기프트' } },
      { type: 'text', text: '를 얹는다' },
    ] },
  ],
})

describe('list cards carry the one-line preview instead of the note document', () => {
  it('discovery deck posts send the preview text', () => {
    const [deck] = formatDiscoveryPosts('deck', [{ id: 'd1', description: note, profiles: null }])
    expect(deck.description).toBe(notePreviewText(note))
    expect(deck.description).not.toContain('"type"')
  })

  it('plan list summaries send the preview text', () => {
    const plan = stripPlanForList({ id: 'p1', description: note, deck: null, egos: null, floor_plan: [], tags: [] })
    expect(plan.description).toBe(notePreviewText(note))
  })

  it('the preview gives the card, the board row, search and the info score what the note gave', () => {
    const preview = notePreviewText(note)
    expect(notePreviewText(preview)).toBe(preview)
    expect(noteSummaryText(preview)).toBe(noteSummaryText(note))
    for (const word of ['침잠', 'Sinking', '우울한 기프트']) expect(notePlainText(preview)).toContain(word)
    expect(notePlainText(preview).length >= 20).toBe(notePlainText(note).length >= 20)
  })

  it('an empty or missing description stays as it was', () => {
    const [empty, missing] = formatDiscoveryPosts('deck', [{ id: 'd1', description: null }, { id: 'd2' }])
    expect(empty.description).toBeNull()
    expect('description' in missing).toBe(false)
  })
})

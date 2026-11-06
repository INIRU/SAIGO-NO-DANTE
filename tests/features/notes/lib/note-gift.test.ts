import { describe, expect, it } from 'vitest'
import { findNoteGift } from '@/features/notes/lib/note-gift'

const gifts = [{ id: '9001', name: '녹슨 기념 주화' }, { id: '9250', name: '불꽃놀이' }]

describe('REQ-DECKS-014 the gift a note label points at', () => {
  it('REQ-DECKS-014 finds a gift by its id (note blocks) or its name (older note tokens)', () => {
    expect(findNoteGift(gifts, '9250')).toBe(gifts[1])
    expect(findNoteGift(gifts, '녹슨 기념 주화')).toBe(gifts[0])
  })

  it('REQ-DECKS-014 gives nothing for an unknown key or before the list has loaded', () => {
    expect(findNoteGift(gifts, '없는 기프트')).toBeUndefined()
    expect(findNoteGift([], '9250')).toBeUndefined()
  })
})

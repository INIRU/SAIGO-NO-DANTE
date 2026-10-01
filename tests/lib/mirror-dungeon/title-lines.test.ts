import { describe, expect, it } from 'vitest'
import { splitTitleInTwo, titleBreakPoints } from '@/lib/mirror-dungeon/title-lines'

const byLength = (s: string) => s.length

describe('REQ-MIRROR-DUNGEON-012 long theme pack names wrap onto two balanced lines', () => {
  it('REQ-MIRROR-DUNGEON-012 breaks English and Korean names at spaces, picking the most balanced pair', () => {
    expect(splitTitleInTwo('Yield My Flesh to Claim Their Bones', 'en', byLength)).toEqual(['Yield My Flesh to', 'Claim Their Bones'])
    expect(splitTitleInTwo('어느 도서관의 어떤 책 속으로', 'ko', byLength)).toEqual(['어느 도서관의', '어떤 책 속으로'])
  })

  it('REQ-MIRROR-DUNGEON-012 breaks Japanese between characters but not before small kana or inside a Latin word', () => {
    const points = titleBreakPoints('ラ・マンチャランドの主 BokGak', 'ja')
    const text = 'ラ・マンチャランドの主 BokGak'
    expect(points.some(i => text[i] === 'ー' || text[i] === '・')).toBe(false)
    expect(points.some(i => /[A-Za-z]/.test(text[i - 1]) && /[A-Za-z]/.test(text[i]))).toBe(false)
    expect(splitTitleInTwo('とある図書館の、ある本の中へ', 'ja', byLength)?.join('|')).toBe('とある図書館の、|ある本の中へ')
  })

  it('REQ-MIRROR-DUNGEON-012 leaves names without a break point on one line', () => {
    expect(splitTitleInTwo('육참골단', 'ko', byLength)).toBeNull()
  })
})

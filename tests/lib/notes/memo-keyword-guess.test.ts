import { describe, expect, it } from 'vitest'
import { getLocalizedKeywordIndex } from '@/lib/keywords/catalog'
import { guessKeywordParts, type KeywordGuessPart } from '@/lib/keywords/keyword-guess'
import { CATALOG, MATCH_CASES } from '../../fixtures/memo-keywords/cases'

const guess = (text: string, locale: string, options?: Parameters<typeof guessKeywordParts>[3]) => {
  const { localKeywords, localToKr } = getLocalizedKeywordIndex(CATALOG, locale)
  return guessKeywordParts(text, localKeywords, localToKr, { escapes: true, ...options })
}
const inside = (part: KeywordGuessPart) => part.text.replace(/^[\[【]|[\]】]$/g, '')
const keywordsOf = (parts: KeywordGuessPart[]) => parts.filter(p => p.type === 'keyword' || (p.type === 'bracket' && p.krKey)).map(p => (p.type === 'bracket' ? inside(p) : p.text))
const visibleOf = (parts: KeywordGuessPart[]) => parts.map(p => (p.type === 'bracket' && p.krKey ? inside(p) : p.text)).join('')

describe('REQ-DECKS-011 the keyword matcher picks what the old renderer showed as keywords', () => {
  for (const item of MATCH_CASES) {
    it(`REQ-DECKS-011 ${item.name} (${item.locale}: ${JSON.stringify(item.text)})`, () => {
      const parts = guess(item.text, item.locale)
      expect(keywordsOf(parts)).toEqual(item.keywords)
      if (item.visible !== null) expect(visibleOf(parts)).toBe(item.visible)
    })
  }

  it('REQ-DECKS-011 gives each part its source range; only a dropped escape backslash is in no range', () => {
    const text = '흑수 \\못 넣고 \\\\\\화상 화상 3'
    const parts = guess(text, 'ko')
    let end = 0
    const dropped: number[] = []
    for (const part of parts) {
      for (let i = end; i < part.from; i++) dropped.push(i)
      expect(text.slice(part.from, part.to)).toBe(part.text)
      end = part.to
    }
    expect(dropped).toEqual([text.indexOf('\\못'), text.indexOf('\\\\\\화상')])
    expect(parts.filter(p => p.type === 'keyword').map(p => text.slice(p.from, p.to))).toEqual(['화상'])
    expect(parts.find(p => p.type === 'number')).toMatchObject({ text: ' 3' })
  })

  it('REQ-DECKS-011 maps names and bracket ids of another language to the Korean keyword', () => {
    const parts = guess('[Combustion] and Burn', 'en')
    expect(parts.filter(p => p.type === 'bracket' || p.type === 'keyword').map(p => [p.type, p.krKey])).toEqual([['bracket', '화상'], ['keyword', '화상']])
  })

  it('REQ-DECKS-011 treats a backslash as text when escapes are off', () => {
    const parts = guess('\\못 박기', 'ko', { escapes: false })
    expect(visibleOf(parts)).toBe('\\못 박기')
    expect(keywordsOf(parts)).toEqual(['못'])
  })

  it('REQ-DECKS-011 looks at the neighbours of a text that continues around a chip (boundary rules still hold)', () => {
    // "못" alone would match; right after a Korean syllable (the chip's last letter) or before one (the chip's first) it must not.
    expect(keywordsOf(guess('못', 'ko'))).toEqual(['못'])
    expect(keywordsOf(guess('못', 'ko', { before: '화상' }))).toEqual([])
    expect(keywordsOf(guess('못', 'ko', { after: '화상' }))).toEqual([])
    expect(keywordsOf(guess('못', 'ko', { after: ' 화상' }))).toEqual(['못'])
    expect(keywordsOf(guess('이못', 'ko', { before: '화상' }))).toEqual([])
  })
})

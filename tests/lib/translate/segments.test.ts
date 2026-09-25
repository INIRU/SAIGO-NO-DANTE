import { describe, expect, it } from 'vitest'
import { NOTE_PREFIX } from '@/lib/notes/blocks'
import { applyTranslations, segmentsOf, textLanguage, uniqueSegments } from '@/lib/translate/segments'

describe('post translation segments', () => {
  const doc = NOTE_PREFIX + JSON.stringify({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: '화상 덱' }, { type: 'noteAsset', attrs: { kind: 'gift', id: '1' } }, { type: 'text', text: '추천', marks: [{ type: 'bold' }] }] }] })
  it('collects text nodes of block notes and whole markdown texts', () => {
    expect(segmentsOf(doc)).toEqual(['화상 덱', '추천'])
    expect(segmentsOf('**1층** 화상')).toEqual(['**1층** 화상'])
    expect(segmentsOf('  ')).toEqual([])
    expect(uniqueSegments(['a', 'a', null])).toEqual(['a'])
  })
  it('replaces only translated text and keeps blocks and marks', () => {
    const out = applyTranslations(doc, new Map([['화상 덱', 'Burn deck']]))
    const parsed = JSON.parse(out.slice(NOTE_PREFIX.length))
    expect(parsed.content[0].content.map((n: { text?: string; type: string }) => n.text ?? n.type)).toEqual(['Burn deck', 'noteAsset', '추천'])
    expect(parsed.content[0].content[2].marks).toEqual([{ type: 'bold' }])
    expect(applyTranslations('제목', new Map([['제목', 'Title']]))).toBe('Title')
  })
  it('guesses the source language', () => {
    expect(textLanguage('화상 덱')).toBe('ko')
    expect(textLanguage('やけど')).toBe('ja')
    expect(textLanguage('Burn team')).toBe('en')
    expect(textLanguage('123')).toBeNull()
  })
})

import { describe, expect, it } from 'vitest'
import { NOTE_TOC_MIN, activeHeading, collectHeadings, headingSlug, markdownHeadings } from '@/features/notes/lib/toc'
import { normalizeDocument } from '@/lib/notes/blocks'

const h = (level: number, ...content: object[]) => ({ type: 'heading', attrs: { level }, content })
const t = (text: string, marks: object[] = []) => ({ type: 'text', text, marks })
const doc = (...content: object[]) => normalizeDocument({ type: 'doc', content })!

describe('REQ-COMMUNITY-057 heading ids', () => {
  it('REQ-COMMUNITY-057 makes the same id from the same words, in any script', () => {
    expect(headingSlug('운용 순서')).toBe('note-운용-순서')
    expect(headingSlug('  Key  Gifts! ')).toBe('note-key-gifts')
    expect(headingSlug('重要ギフト')).toBe('note-重要ギフト')
    expect(headingSlug('A/B – 테스트 (v2)')).toBe('note-a-b-테스트-v2')
    expect(headingSlug('!!!')).toBe('note-section')
    expect(headingSlug('가'.repeat(100)).length).toBeLessThanOrEqual('note-'.length + 60)
  })
  it('REQ-COMMUNITY-057 numbers a repeated heading and reads text inside marks and chips', () => {
    const d = doc(h(1, t('핵심')), h(2, t('핵심')), h(2, t('굵은', [{ type: 'bold' }]), t(' 제목'), { type: 'noteGift', attrs: { id: 'g', name: '기프트이름' } }), h(2, t('핵심')))
    expect(collectHeadings(d).map(x => x.id)).toEqual(['note-핵심', 'note-핵심-2', 'note-굵은-제목기프트이름', 'note-핵심-3'])
    expect(collectHeadings(d).map(x => x.level)).toEqual([1, 2, 2, 2])
  })
  it('REQ-COMMUNITY-057 skips an empty heading and finds headings inside accordions', () => {
    const d = doc(h(1), { type: 'noteAccordion', content: [{ type: 'noteTitle', content: [t('접이')] }, { type: 'noteBody', content: [h(2, t('안쪽 제목'))] }] })
    expect(collectHeadings(d).map(x => x.text)).toEqual(['안쪽 제목'])
  })
  it('REQ-COMMUNITY-057 reads headings of an old markdown note, without its inline marks and tokens', () => {
    const text = '# 첫째 **굵게**\n본문\n## 둘째 [k:화상] 설명\n\n# [링크](https://example.com) 셋째'
    expect(markdownHeadings(text).map(x => [x.id, x.level, x.line])).toEqual([['note-첫째-굵게', 1, 0], ['note-둘째-화상-설명', 2, 2], ['note-링크-셋째', 1, 4]])
  })
  it('REQ-COMMUNITY-057 shows a table of contents from three headings', () => {
    expect(NOTE_TOC_MIN).toBe(3)
  })
})

describe('REQ-COMMUNITY-057 the heading being read', () => {
  const tops = (...values: number[]) => values.map((top, i) => ({ id: 'h' + i, top }))
  it('REQ-COMMUNITY-057 is the last heading that passed the line near the top of the screen', () => {
    expect(activeHeading(tops(-400, -50, 90, 600), 120)).toBe('h2')
    expect(activeHeading(tops(-400, -50, 300), 120)).toBe('h1')
  })
  it('REQ-COMMUNITY-057 is the first heading before the reader reaches any', () => {
    expect(activeHeading(tops(500, 900), 120)).toBe('h0')
    expect(activeHeading([], 120)).toBeNull()
  })
})

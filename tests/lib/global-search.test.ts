import { describe, expect, it } from 'vitest'
import { committedQuery, groupHits, markParts } from '@/lib/utils/global-search'
import type { Hit, IndexEntry } from '@/lib/search/engine'

const hit = (type: IndexEntry['type'], score: number, label: string = type): Hit =>
  ({ entry: { type, href: '/' + label, label, names: {} }, score, reasons: [] })

describe('global search helpers', () => {
  it('markParts cuts text into marked and plain parts by the reason ranges (REQ-SHARED-051)', () => {
    expect(markParts('LCB 수감자', [[0, 3]])).toEqual([{ text: 'LCB', marked: true }, { text: ' 수감자', marked: false }])
    expect(markParts('검계 살수', [[0, 1], [3, 4]])).toEqual([
      { text: '검', marked: true }, { text: '계 ', marked: false }, { text: '살', marked: true }, { text: '수', marked: false },
    ])
    expect(markParts('이상', [])).toEqual([{ text: '이상', marked: false }])
  })
  it('groupHits orders groups by their best hit and counts every type (REQ-SHARED-053)', () => {
    const groups = groupHits([hit('keyword', 900), hit('identity', 500), hit('keyword', 400), hit('identity', 300, 'b')], 1)
    expect(groups.map(g => [g.type, g.total, g.hits.length])).toEqual([['keyword', 2, 1], ['identity', 2, 1]])
  })
  it('committedQuery keeps the previous query while an IME is composing', () => {
    expect(committedQuery('이', '이ㅅ', true)).toBe('이')
    expect(committedQuery('이', '이상', false)).toBe('이상')
  })
})

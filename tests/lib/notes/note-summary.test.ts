import { expect, it } from 'vitest'
import { NOTE_PREFIX, noteSummaryText } from '@/lib/notes/blocks'

it('reads an old markdown memo as one plain line: tokens by their names, no markdown marks or cards', () => {
  const memo = '## 운용\n- [k:화상] 덱은 **강해요** [g:달아오른 흉터]\n{{gift:9001}}\n> [링크](https://example.com) 참고'
  expect(noteSummaryText(memo)).toBe('운용 화상 덱은 강해요 달아오른 흉터 링크 참고')
})

it('reads a block memo as its words, and nothing for an empty one', () => {
  const doc = { type: 'doc', content: [{ type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: '개요' }] }, { type: 'paragraph', content: [{ type: 'text', text: '첫 턴은 방어' }] }] }
  expect(noteSummaryText(NOTE_PREFIX + JSON.stringify(doc))).toBe('개요 첫 턴은 방어')
  expect(noteSummaryText('')).toBe('')
})

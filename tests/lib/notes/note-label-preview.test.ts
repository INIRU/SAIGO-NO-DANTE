import { describe, expect, it } from 'vitest'
import { NOTE_PREFIX, noteLabelPreview } from '@/lib/notes/blocks'

const names: Record<string, string> = { '9001': '녹슨 기념 주화', '9250': '불꽃놀이' }
const giftName = (id: string) => names[id]
const doc = (content: unknown[]) => NOTE_PREFIX + JSON.stringify({ type: 'doc', content })

describe('REQ-ASSIST-083 plan memo as one line with gift labels', () => {
  it('REQ-ASSIST-083 turns gift blocks and inline gifts of a block note into gift tokens and drops other blocks', () => {
    const memo = doc([
      { type: 'paragraph', content: [{ type: 'text', text: '보스 전에 ' }, { type: 'noteGift', attrs: { id: '9250', name: '불꽃놀이' } }, { type: 'text', text: ' 챙기기' }] },
      { type: 'noteAsset', attrs: { kind: 'gift', id: '9001' } },
      { type: 'noteAsset', attrs: { kind: 'gift', id: '404' } },
      { type: 'noteVideo', attrs: { videoId: 'abcdefghijk' } },
      { type: 'paragraph', content: [{ type: 'noteKeyword', attrs: { id: '화상' } }, { type: 'text', text: ' 위주' }] },
    ])
    expect(noteLabelPreview(memo, giftName)).toBe('보스 전에 [g:불꽃놀이] 챙기기 [g:녹슨 기념 주화] [k:화상] 위주')
  })

  it('REQ-ASSIST-083 turns gift block tokens of a text memo into gift tokens and drops card tokens and markdown marks', () => {
    expect(noteLabelPreview('## 1층\n- {{gift:녹슨 기념 주화:true}} 먼저\n{{skill:10101:1}}\n**[g:불꽃놀이]** 사기', giftName))
      .toBe('1층 [g:녹슨 기념 주화] 먼저 [g:불꽃놀이] 사기')
  })

  it('REQ-ASSIST-083 gives nothing for an empty memo', () => {
    expect(noteLabelPreview('', giftName)).toBe('')
    expect(noteLabelPreview(doc([{ type: 'paragraph' }]), giftName)).toBe('')
  })
})

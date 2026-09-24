import { describe, expect, it } from 'vitest'
import { createGiftRefSplitter } from './gift-refs'

const gifts = [
  { id: 'a', name: '가능성' },
  { id: 'b', name: '신검합일' },
  { id: 'c', name: '믿음' },
  { id: 'd', name: '회중시계 : 타입 L' },
  { id: 'e', name: '회중시계' },
  { id: 'self', name: '그날의 기록' },
]

describe('createGiftRefSplitter', () => {
  it('links the upgrade target written as → [name]', () => {
    const split = createGiftRefSplitter(gifts, { selfId: 'self' })
    expect(split('전투를 6회 승리할 시 해당 E.G.O 기프트가 변경됨\n→ [가능성]')).toEqual([
      '전투를 6회 승리할 시 해당 E.G.O 기프트가 변경됨\n→ ',
      { gift: gifts[0], text: '가능성' },
    ])
  })

  it('matches bare names and corner brackets, longest first', () => {
    const split = createGiftRefSplitter(gifts)
    expect(split('회중시계 : 타입 L로 바뀜, 『신검합일』(으)로 변경')).toEqual([
      { gift: gifts[3], text: '회중시계 : 타입 L' },
      '로 바뀜, ',
      { gift: gifts[1], text: '신검합일' },
      '(으)로 변경',
    ])
  })

  it('leaves short everyday words and the gift itself unlinked unless bracketed or the convert target', () => {
    expect(createGiftRefSplitter(gifts, { selfId: 'self' })('믿음을 잃은 그날의 기록')).toEqual(['믿음을 잃은 그날의 기록'])
    expect(createGiftRefSplitter(gifts)('[믿음] 획득')).toEqual([{ gift: gifts[2], text: '믿음' }, ' 획득'])
    expect(createGiftRefSplitter(gifts, { convertToId: 'c' })('믿음으로 변경')).toEqual([{ gift: gifts[2], text: '믿음' }, '으로 변경'])
  })
})

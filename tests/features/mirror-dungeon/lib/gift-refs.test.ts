import { describe, expect, it } from 'vitest'
import { createGiftRefSplitter } from '@/features/mirror-dungeon/lib/gift-refs'
import { parseGameText } from '@/lib/game-text/rich-text'

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

describe('REQ-SHARED-021 gift names in effect text', () => {
  const en = [
    { id: '9764', name: 'Gift' },
    { id: 'long', name: 'Hourglass of Fate' },
    { id: 'five', name: 'Cross' },
    { id: 'word', name: 'Mirrorwalker' },
    { id: 'common', name: 'Weapons' },
  ]

  it('REQ-SHARED-021 does not link the gift "Gift" inside "E.G.O Gift owned"', () => {
    const split = createGiftRefSplitter(en)
    expect(split('E.G.O Gift owned')).toEqual(['E.G.O Gift owned'])
    expect(split('Gifts and gift effects')).toEqual(['Gifts and gift effects'])
  })

  it('REQ-SHARED-021 still links a real long gift name, but only as a whole word', () => {
    const split = createGiftRefSplitter(en)
    expect(split('Obtain Hourglass of Fate now')).toEqual(['Obtain ', { gift: en[1], text: 'Hourglass of Fate' }, ' now'])
    expect(split('Obtain Mirrorwalker.')).toEqual(['Obtain ', { gift: en[3], text: 'Mirrorwalker' }, '.'])
    expect(split('Hourglass of Fates')).toEqual(['Hourglass of Fates'])
    expect(split('SuperMirrorwalker')).toEqual(['SuperMirrorwalker'])
  })

  it('REQ-SHARED-021 does not link short Latin names or a single common word bare, but keeps bracket and arrow forms', () => {
    const split = createGiftRefSplitter(en)
    expect(split('Cross the line, Weapons ready')).toEqual(['Cross the line, Weapons ready'])
    expect(split('→ [Gift]')).toEqual(['→ ', { gift: en[0], text: 'Gift' }])
    expect(split('[Cross] obtained')).toEqual([{ gift: en[2], text: 'Cross' }, ' obtained'])
  })

  it('REQ-SHARED-021 keeps the Hangul and Kana bare-name rules (3 characters and more)', () => {
    const ja = [{ id: 'j', name: '時計の針' }, { id: 'k', name: '指輪' }]
    const split = createGiftRefSplitter(ja)
    expect(split('時計の針を得る')).toEqual([{ gift: ja[0], text: '時計の針' }, 'を得る'])
    expect(split('指輪を得る')).toEqual(['指輪を得る'])
  })

  it('REQ-SHARED-021 keeps the style of a tagged line when a gift name inside it is split out', () => {
    const split = createGiftRefSplitter(gifts)
    const parts = split('<style="highlight">획득: 신검합일 사용</style>')
    expect(parts).toHaveLength(3)
    expect(parts[1]).toEqual({ gift: gifts[1], text: '신검합일' })
    for (const index of [0, 2]) {
      const nodes = parseGameText(parts[index] as string)
      expect(nodes).toHaveLength(1)
      expect(nodes[0]).toMatchObject({ type: 'element', tag: 'style', value: 'highlight' })
    }
    expect(parts.map(p => (typeof p === 'string' ? p.replace(/<[^>]*>/g, '') : p.text)).join('')).toBe('획득: 신검합일 사용')
  })

  it('REQ-SHARED-021 never matches a gift name across a tag and leaves tag-only text intact', () => {
    const split = createGiftRefSplitter(gifts)
    expect(split('<b>신검</b>합일')).toEqual(['<b>신검</b>합일'])
    expect(split('<color=#ff0000>가능성 없음</color>')).toEqual([{ gift: gifts[0], text: '가능성' }, '<color=#ff0000> 없음</color>'])
  })
})

import { describe, expect, it } from 'vitest'
import type { EgoGift, EgoGiftTheme, MdEvent, MdEventChoice, Recipe } from '@/features/mirror-dungeon'
import {
  buildGiftSlotMap, countChoicesByEvent, groupChoicesByEvent, indexEventsById, indexGiftImages, indexGiftNames, indexGiftNamesByGameId,
  indexGiftsByGameId, indexRecipesByResult, localizeChoices, localizeEvents, themeGiftNameSet,
} from '@/features/mirror-dungeon/lib/md-data'

const gift = (id: string, game_id: number | null, over: Record<string, unknown> = {}) => ({ id, game_id, name: `이름${id}`, name_en: `Name${id}`, name_jp: null, image_url: `img${id}`, effect_base: null, effect_plus: null, effect_plusplus: null, ...over }) as unknown as EgoGift
const event = (id: number, over: Record<string, unknown> = {}) => ({ id, name: `이벤트${id}`, name_en: `Event${id}`, name_jp: `イベント${id}`, desc_text: '설명', desc_text_en: 'desc', desc_text_jp: '説明', ...over }) as unknown as MdEvent
const choice = (id: number, event_id: number, over: Record<string, unknown> = {}) => ({
  id, event_id, message: '메시지', message_en: 'msg', message_jp: 'メッセージ', message_desc: '풀이', message_desc_en: 'desc', message_desc_jp: null, result_text: '결과', result_text_en: null, result_text_jp: '結果', ...over,
}) as unknown as MdEventChoice

describe('localizeEvents', () => {
  const events = [event(1), event(2, { name: null, desc_text_en: null, desc_text_jp: null })]

  it('keeps Korean for ko', () => {
    expect(localizeEvents(events, 'ko').map(e => [e.name, e.desc_text])).toEqual([['이벤트1', '설명'], [null, '설명']])
  })

  it('uses the English or Japanese text and falls back to Korean when it is missing', () => {
    expect(localizeEvents(events, 'en').map(e => [e.name, e.desc_text])).toEqual([['Event1', 'desc'], [null, '설명']])
    expect(localizeEvents(events, 'ja').map(e => [e.name, e.desc_text])).toEqual([['イベント1', '説明'], [null, '설명']])
  })

  it('keeps every other field and the input untouched', () => {
    const out = localizeEvents(events, 'en')
    expect(out[0].id).toBe(1)
    expect(events[0].name).toBe('이벤트1')
    expect(localizeEvents([], 'en')).toEqual([])
  })
})

describe('localizeChoices', () => {
  const choices = [choice(1, 10)]
  it('picks each text by language with the Korean one as the fallback', () => {
    expect(localizeChoices(choices, 'ko')[0]).toMatchObject({ message: '메시지', message_desc: '풀이', result_text: '결과' })
    expect(localizeChoices(choices, 'en')[0]).toMatchObject({ message: 'msg', message_desc: 'desc', result_text: '결과' })
    expect(localizeChoices(choices, 'ja')[0]).toMatchObject({ message: 'メッセージ', message_desc: '풀이', result_text: '結果' })
  })
})

describe('event indexes', () => {
  const choices = [choice(1, 10), choice(2, 20), choice(3, 10)]

  it('indexes events by id', () => {
    const map = indexEventsById([event(1), event(2)])
    expect([...map.keys()]).toEqual([1, 2])
    expect(map.get(2)?.name).toBe('이벤트2')
  })

  it('groups choices by event in order and counts them', () => {
    const grouped = groupChoicesByEvent(choices)
    expect(grouped.get(10)?.map(c => c.id)).toEqual([1, 3])
    expect(grouped.get(20)?.map(c => c.id)).toEqual([2])
    expect([...countChoicesByEvent(grouped)]).toEqual([[10, 2], [20, 1]])
    expect(groupChoicesByEvent([]).size).toBe(0)
  })
})

describe('gift indexes', () => {
  const gifts = [gift('a', 1), gift('b', null), gift('c', 3, { image_url: null, name_en: null })]

  it('indexes by game id, skipping gifts without one', () => {
    expect([...indexGiftsByGameId(gifts).keys()]).toEqual([1, 3])
  })

  it('names by game id and by Korean name in the page language, Korean as the fallback', () => {
    expect([...indexGiftNamesByGameId(gifts, 'en')]).toEqual([[1, 'Namea'], [3, '이름c']])
    expect([...indexGiftNames(gifts, 'en')]).toEqual([['이름a', 'Namea'], ['이름b', 'Nameb'], ['이름c', '이름c']])
    expect([...indexGiftNames(gifts, 'ko')].map(([, v]) => v)).toEqual(['이름a', '이름b', '이름c'])
  })

  it('maps names to images, skipping gifts without one', () => {
    expect([...indexGiftImages(gifts)]).toEqual([['이름a', 'imga'], ['이름b', 'imgb']])
  })

  it('indexes recipes by their result, the last one winning', () => {
    const map = indexRecipesByResult([{ id: 1, result_name: 'x' }, { id: 2, result_name: 'x' }, { id: 3, result_name: 'y' }] as unknown as Recipe[])
    expect([...map.keys()]).toEqual(['x', 'y'])
    expect((map.get('x') as unknown as { id: number }).id).toBe(2)
  })
})

describe('themeGiftNameSet', () => {
  const themes = [{ id: 5, ego_gift_ids: [1, 3, 99] }] as unknown as EgoGiftTheme[]
  const byId = indexGiftsByGameId([gift('a', 1), gift('c', 3)])

  it('is null without a pick or for an unknown pack', () => {
    expect(themeGiftNameSet(null, themes, byId)).toBeNull()
    expect(themeGiftNameSet(0, themes, byId)).toBeNull()
    expect(themeGiftNameSet(6, themes, byId)).toBeNull()
  })

  it('holds the names of the known gifts of the pack', () => {
    expect([...themeGiftNameSet(5, themes, byId)!]).toEqual(['이름a', '이름c'])
  })
})

describe('buildGiftSlotMap', () => {
  it('reads formation-only slot numbers across the three effect texts and merges them', () => {
    const out = buildGiftSlotMap([
      gift('a', 1, { effect_base: '[편성 1, 2번 전용 효과]', effect_plus: '[3번 편성 전용 효과]', effect_plusplus: '<color=#fff>[편성 순서 4번 전용 효과]</color>' }),
      gift('b', 2, { effect_base: '보통 효과' }),
      gift('c', 3, { effect_base: '[편성 5 인격 전용 효과] 그리고 [편성 6번 전용 효과]' }),
      gift('d', 4),
    ])
    expect([...out.keys()]).toEqual(['a', 'c'])
    expect([...out.get('a')!].sort()).toEqual([1, 2, 3, 4])
    expect([...out.get('c')!].sort()).toEqual([5, 6])
  })

  it('is empty for no gifts', () => {
    expect(buildGiftSlotMap([]).size).toBe(0)
  })
})

import { gameTextToPlain } from '@/lib/game-text/rich-text'
import type { GiftData, IdentitySlot, RecipeData } from '@/lib/planner/types'
import type { MdEventChoice } from '@/features/mirror-dungeon'
import type { NoteEgoGiftEntry } from '@/features/notes/components/NoteChips'

export type FinalGift = { gift: GiftData; enhance: number }

// 편성 N번 전용 효과 슬롯 파싱
export function parseFormationSlots(text: string | null): number[] {
  if (!text) return []
  // Game text may put colour tags (digits and all) inside the bracket label; read the text as shown.
  const label = gameTextToPlain(text).match(/\[편성[^\]]*전용\s*효과\]|\[\d[^\]]*편성\s*전용\s*효과\]/)
  if (!label) return []
  return [...label[0].matchAll(/(\d+)/g)].map(r => parseInt(r[1]))
}

export function buildGiftByName(gifts: readonly GiftData[]) {
  const map = new Map<string, GiftData>()
  for (const g of gifts) map.set(g.name, g)
  return map
}

/** Each recipe's result gift (by game id) with its materials; a recipe whose result is unknown is skipped, unknown materials dropped. */
export function buildRecipeMap(recipes: readonly RecipeData[], giftByName: ReadonlyMap<string, GiftData>) {
  const map = new Map<number, { materials: GiftData[]; result: GiftData }>()
  for (const r of recipes) {
    const result = giftByName.get(r.result_name)
    if (!result) continue
    const mats = r.ingredients.map((name: string) => giftByName.get(name)).filter(Boolean) as GiftData[]
    map.set(result.game_id, { materials: mats, result })
  }
  return map
}

/** The gifts a note can name: those with a name and a keyword, by name. */
export function buildEgoGiftLookup(gifts: readonly GiftData[]) {
  const map: Record<string, NoteEgoGiftEntry> = {}
  for (const g of gifts) {
    if (g.name && g.keyword) {
      map[g.name] = { name: g.name, keyword: g.keyword, grade: g.grade ?? '1', image_url: g.image_url, effect_base: g.effect_base }
    }
  }
  return map
}

export function groupChoicesByEventId(eventChoices: readonly MdEventChoice[]) {
  const map = new Map<number, MdEventChoice[]>()
  for (const choice of eventChoices) map.set(choice.event_id, [...(map.get(choice.event_id) ?? []), choice])
  return map
}

/** The gifts in the inventory under one prefix (observe_ or start_), in inventory order; unknown ids are dropped. */
export function pickInventoryGifts(giftInventory: readonly string[], prefix: 'observe_' | 'start_', giftMap: ReadonlyMap<number, GiftData>) {
  return giftInventory.filter(id => id.startsWith(prefix)).map(id => giftMap.get(parseInt(id.replace(prefix, '')))).filter(Boolean) as GiftData[]
}

/** The final gifts (final_ID, final_ID_plus, final_ID_plusplus) with their enhance level 0-2. */
export function pickFinalGifts(giftInventory: readonly string[], giftMap: ReadonlyMap<number, GiftData>) {
  const list: FinalGift[] = []
  for (const id of giftInventory) {
    if (!id.startsWith('final_')) continue
    let enhance = 0, gid: number
    if (id.endsWith('_plusplus')) { gid = parseInt(id.replace('final_', '').replace('_plusplus', '')); enhance = 2 }
    else if (id.endsWith('_plus')) { gid = parseInt(id.replace('final_', '').replace('_plus', '')); enhance = 1 }
    else { gid = parseInt(id.replace('final_', '')) }
    const gift = giftMap.get(gid)
    if (gift) list.push({ gift, enhance })
  }
  return list
}

/** 편성 슬롯 → 최종 기프트 이미지 매핑: the final gifts whose effect is for formation slot N. */
export function buildSlotGiftMap(finalGifts: readonly FinalGift[]) {
  const map = new Map<number, string[]>()
  for (const { gift, enhance } of finalGifts) {
    const txt = enhance === 2 ? gift.effect_plusplus : enhance === 1 ? gift.effect_plus : gift.effect_base
    const slots = parseFormationSlots(txt)
    if (!gift.image_url || !slots.length) continue
    for (const s of slots) {
      if (!map.has(s)) map.set(s, [])
      map.get(s)!.push(gift.image_url)
    }
  }
  return map
}

type DeckSlotLike = {
  identity_id?: string
  sinner_id?: string
  name_kr?: string
  rarity?: number
  keywords?: string[]
  skill_keyword_list?: string[] | null
  game_id?: string | null
  folder_name?: string | null
  slot_order?: number
}

/** The plan's identities as the gift condition check reads them (a slot without an identity or sinner is left out). */
export function buildConditionSlots(deck: readonly DeckSlotLike[]): IdentitySlot[] {
  return deck
    .filter(slot => slot.identity_id && slot.sinner_id)
    .map(slot => ({
      identity_id: slot.identity_id!,
      sinner_id: slot.sinner_id!,
      name_kr: slot.name_kr ?? '',
      rarity: slot.rarity ?? 1,
      keywords: slot.keywords ?? [],
      skill_keyword_list: slot.skill_keyword_list,
      game_id: slot.game_id ?? null,
      folder_name: slot.folder_name ?? null,
      slot_order: slot.slot_order ?? 99,
    }))
}

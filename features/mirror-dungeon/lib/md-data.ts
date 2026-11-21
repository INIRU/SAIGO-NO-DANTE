import { getLocalizedName } from '@/lib/i18n/localize'
import type { SupportedLang } from '@/lib/i18n/types'
import { gameTextToPlain } from '@/lib/game-text/rich-text'
import type { EgoGift, EgoGiftTheme, MdEvent, MdEventChoice, Recipe } from '../types'

/** The events with the name and description in the page language (a missing translation falls back to Korean). */
export function localizeEvents(events: readonly MdEvent[], lang: SupportedLang) {
  return events.map(ev => {
    const name = ev.name
      ? getLocalizedName({ name_kr: ev.name, name_en: ev.name_en, name_jp: ev.name_jp }, lang)
      : ev.name
    const descText = lang === 'en'
      ? ev.desc_text_en ?? ev.desc_text
      : lang === 'ja'
        ? ev.desc_text_jp ?? ev.desc_text
        : ev.desc_text

    return {
      ...ev,
      name,
      desc_text: descText,
    }
  })
}

/** The choices with the message, its description and the result text in the page language. */
export function localizeChoices(choices: readonly MdEventChoice[], lang: SupportedLang) {
  return choices.map(choice => {
    const message = lang === 'en'
      ? choice.message_en ?? choice.message
      : lang === 'ja'
        ? choice.message_jp ?? choice.message
        : choice.message
    const messageDesc = lang === 'en'
      ? choice.message_desc_en ?? choice.message_desc
      : lang === 'ja'
        ? choice.message_desc_jp ?? choice.message_desc
        : choice.message_desc
    const resultText = lang === 'en'
      ? choice.result_text_en ?? choice.result_text
      : lang === 'ja'
        ? choice.result_text_jp ?? choice.result_text
        : choice.result_text

    return {
      ...choice,
      message,
      message_desc: messageDesc,
      result_text: resultText,
    }
  })
}

export function indexEventsById(events: readonly MdEvent[]) {
  const map = new Map<number, MdEvent>()
  for (const ev of events) map.set(ev.id, ev)
  return map
}

export function groupChoicesByEvent(choices: readonly MdEventChoice[]) {
  const map = new Map<number, MdEventChoice[]>()
  for (const c of choices) {
    const arr = map.get(c.event_id)
    if (arr) arr.push(c)
    else map.set(c.event_id, [c])
  }
  return map
}

export function countChoicesByEvent(choicesByEventId: ReadonlyMap<number, readonly MdEventChoice[]>) {
  const map = new Map<number, number>()
  for (const [id, arr] of choicesByEventId) map.set(id, arr.length)
  return map
}

/** game_id → EgoGift (gifts without a game id are left out). */
export function indexGiftsByGameId(gifts: readonly EgoGift[]) {
  const map = new Map<number, EgoGift>()
  for (const g of gifts) {
    if (g.game_id) map.set(g.game_id, g)
  }
  return map
}

/** The names of the gifts one theme pack holds, for the gift list's pack filter; null with no pack picked or an unknown one. */
export function themeGiftNameSet(selectedThemeId: number | null, themes: readonly EgoGiftTheme[], giftByGameId: ReadonlyMap<number, EgoGift>) {
  if (!selectedThemeId) return null
  const theme = themes.find(t => t.id === selectedThemeId)
  if (!theme) return null
  const names = new Set<string>()
  for (const gid of theme.ego_gift_ids) {
    const g = giftByGameId.get(gid)
    if (g) names.add(g.name)
  }
  return names
}

/** result_name → Recipe */
export function indexRecipesByResult(recipes: readonly Recipe[]) {
  const map = new Map<string, Recipe>()
  recipes.forEach(r => map.set(r.result_name, r))
  return map
}

/** Korean gift name → image URL. */
export function indexGiftImages(gifts: readonly EgoGift[]) {
  const map = new Map<string, string>()
  gifts.forEach(g => { if (g.image_url) map.set(g.name, g.image_url) })
  return map
}

/** Korean gift name → the name in the page language. */
export function indexGiftNames(gifts: readonly EgoGift[], lang: SupportedLang) {
  const map = new Map<string, string>()
  gifts.forEach(g => {
    map.set(g.name, getLocalizedName({ name_kr: g.name, name_en: g.name_en, name_jp: g.name_jp }, lang))
  })
  return map
}

/** 편성 전용 효과 슬롯 번호 파싱 (gift.id → Set<number>) */
export function buildGiftSlotMap(gifts: readonly EgoGift[]) {
  const map = new Map<string, Set<number>>()
  const regex = /\[(?:편성\s*(?:순서\s*)?)?([\d번\s,]+?)(?:\s*인격\s*)?(?:편성\s*)?전용\s*효과\]/g
  for (const g of gifts) {
    const slots = new Set<number>()
    for (const text of [g.effect_base, g.effect_plus, g.effect_plusplus]) {
      if (!text) continue
      // Game text may put colour tags (digits and all) inside the bracket label; read the text as shown.
      const plain = gameTextToPlain(text)
      regex.lastIndex = 0
      let m: RegExpExecArray | null
      while ((m = regex.exec(plain)) !== null) {
        const nums = m[1].match(/\d+/g)
        if (nums) nums.forEach(n => slots.add(Number(n)))
      }
    }
    if (slots.size > 0) map.set(g.id, slots)
  }
  return map
}

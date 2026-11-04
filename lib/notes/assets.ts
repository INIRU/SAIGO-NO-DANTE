import type { Identity, Skill } from '@/lib/types'
import type { AssetKind } from './blocks'
export type NoteFormationMember = { identityId: string; sinnerId: string; name: string }
export type NoteAssetData = {
  id: string; kind: AssetKind; name: string; name_en?: string | null; name_jp?: string | null
  description_en?: string | null; description_jp?: string | null;
  image_url?: string | null; grade?: string | null; keyword?: string | null; description?: string | null
  ego?: {grade:string; image_url?:string|null; sin_affinity?:string|null; max_construe_level?:number}; sinnerId?:string
  identity?: Identity; skill?: Skill; skills?: Skill[]; sinnerName?: string
}
export function assetName(a: NoteAssetData, lang: string) {
  return (lang === 'en' ? a.name_en : lang === 'ja' ? a.name_jp : a.name) || a.name
}

/** A gift row (the planner's GiftData) as a preview card's asset: its name, art, grade, keyword and base effect. */
export function giftPreviewAsset(gift: { game_id: number; name: string; name_en?: string | null; name_jp?: string | null; image_url?: string | null
  grade?: string | null; keyword?: string | null; effect_base?: string | null; effect_base_en?: string | null; effect_base_jp?: string | null }): NoteAssetData {
  return { id: String(gift.game_id), kind: 'gift', name: gift.name, name_en: gift.name_en, name_jp: gift.name_jp, image_url: gift.image_url,
    grade: gift.grade, keyword: gift.keyword, description: gift.effect_base, description_en: gift.effect_base_en, description_jp: gift.effect_base_jp }
}

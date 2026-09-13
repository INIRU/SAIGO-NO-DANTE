import type { Identity, Skill } from '@/lib/types'
import type { AssetKind } from './blocks'
export type NoteAssetData = {
  id: string; kind: AssetKind; name: string; name_en?: string | null; name_jp?: string | null
  image_url?: string | null; grade?: string | null; keyword?: string | null; description?: string | null
  ego?: {grade:string; image_url?:string|null; sin_affinity?:string|null; max_construe_level?:number}; sinnerId?:string
  identity?: Identity; skill?: Skill; skills?: Skill[]; sinnerName?: string
}
export function assetName(a: NoteAssetData, lang: string) {
  return (lang === 'en' ? a.name_en : lang === 'ja' ? a.name_jp : a.name) || a.name
}

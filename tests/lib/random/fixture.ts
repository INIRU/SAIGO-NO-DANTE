import type { EGO, Identity, Sinner } from '@/lib/types'

const pad2 = (value: number) => String(value).padStart(2, '0')

export const SINNERS: Sinner[] = Array.from({ length: 12 }, (_, i) => ({
  id: `s${i + 1}`, name: `Sinner ${i + 1}`, name_kr: `수감자 ${i + 1}`, order_num: i + 1, description: '', literary_source: '',
}))

const RARITIES = [1, 2, 3, 3, 2]
const KEYWORDS: string[][] = [[], ['화상'], ['화상', '출혈'], ['출혈'], ['진동']]

export const IDENTITIES: Identity[] = SINNERS.flatMap((sinner, s) => RARITIES.map((rarity, k) => ({
  id: `i-${s + 1}-${k + 1}`, sinner_id: sinner.id, name: `I ${s + 1}-${k + 1}`, name_kr: `인격 ${s + 1}-${k + 1}`,
  tier: 0, hp: 0, speed_min: 0, speed_max: 0, def_level: 0, keywords: KEYWORDS[k], rarity,
  game_id: `1${pad2(s + 1)}${pad2(k + 1)}`, folder_name: `Folder ${k + 1}`,
}) as Identity))

const GRADES = ['ZAYIN', 'ZAYIN', 'TETH', 'TETH', 'HE', 'HE', 'WAW', 'ALEPH']

export const EGOS: EGO[] = SINNERS.flatMap((sinner, s) => GRADES.map((grade, k) => ({
  id: `e-${s + 1}-${k + 1}`, sinner_id: sinner.id, name: `EGO ${s + 1}-${k + 1}`, name_kr: `에고 ${s + 1}-${k + 1}`, grade,
  sin_affinity: null, description: null, corrosion_risk: null, folder_name: null, image_url: null, passive_name: null,
  passive_content: null, ego_skills: null, game_id: `2${pad2(s + 1)}${pad2(k + 1)}`,
}) as unknown as EGO))

export const BASE_OPTIONS = {
  identityEnabled: true,
  egoEnabled: true,
  keywords: [],
  ownedIds: null,
  rarityFilter: null,
}

export const sinnerIds = (list: Sinner[] = SINNERS) => list.map(sinner => sinner.id)

import { IDENTITY_STAT_BASE_LEVEL, MAX_IDENTITY_LEVEL } from '@/lib/constants/game'
import { normalizeSin } from '@/lib/constants/sin'
import { skillSlot } from '@/lib/identity/skill-model'
import { computeSkillImageIndices, getSkillIconUrl } from '@/lib/utils/images'
import type { SinType } from '@/lib/types'
import type { ATTACK_TYPES, SIN_ATTRIBUTES } from './damage-abilities'

type Lang = 'ko' | 'en' | 'ja'
type Atk = 'slash' | 'pierce' | 'blunt'
type CoinRow = { scale: number; operator: string }

/** A skill as the clash and damage calculators load it: what its game frame shows and what the numbers start from. */
export type ToolSkill = {
  key: string; name: string; sin: SinType | null; slot: 1 | 2 | 3 | 4; atk: Atk | null; defense: boolean; corrosion: boolean; icon: string
  coins: number; base_power: number; coin_power: number; coin_list: CoinRow[] | null; offense_level: number | null
}

export type IdentitySkillRow = {
  id: string; name: string; name_en: string | null; name_jp: string | null; skill_type: string | null; atk_type: string | null; sin_affinity: string | null
  coins: number | null; base_power: number | null; coin_power: number | null; coin_list?: CoinRow[] | null
  skill_order: number; variant_order: number | null; uptie_level: number | null; offense_level: number | null; image_id: string | null
}
export type EgoSkillRow = {
  id: string; category: string | null; construe_level: number | null; name: string; name_en: string | null; name_jp: string | null
  skill_type: string | null; sin_affinity: string | null; coins: number | null; base_power: number | null; coin_power: number | null
  coin_list?: CoinRow[] | null; offense_level: number | null
}

const DEFENSE = new Set(['defense', 'evade', 'counter'])
const ATK = new Set<string>(['slash', 'pierce', 'blunt'])
const inLanguage = (lang: Lang, ko: string, en: string | null, ja: string | null) => (lang === 'en' ? en : lang === 'ja' ? ja : null) || ko
const atkOf = (value: string | null) => (value && ATK.has(value) ? value as Atk : null)
const numbers = (row: { coins: number | null; base_power: number | null; coin_power: number | null; coin_list?: CoinRow[] | null; offense_level: number | null }) => ({
  coins: row.coins ?? 0, base_power: row.base_power ?? 0, coin_power: row.coin_power ?? 0, coin_list: row.coin_list?.length ? row.coin_list : null, offense_level: row.offense_level,
})

/** An identity's skills at their highest uptie (one per slot and variant), in slot order, each with its game frame and sprite. */
export function buildIdentitySkills(identity: { sinner_id: string; game_id: string | null }, rows: readonly IdentitySkillRow[], lang: Lang): ToolSkill[] {
  const best = new Map<string, IdentitySkillRow>()
  for (const row of rows) {
    const key = `${row.skill_order}:${row.variant_order ?? 0}`
    if ((best.get(key)?.uptie_level ?? -1) < (row.uptie_level ?? 0)) best.set(key, row)
  }
  const kept = [...best.values()].sort((a, b) => skillSlot(a) - skillSlot(b) || a.skill_order - b.skill_order || (a.variant_order ?? 0) - (b.variant_order ?? 0))
  const indices = computeSkillImageIndices(kept)
  return kept.map(row => ({
    key: row.id, name: inLanguage(lang, row.name, row.name_en, row.name_jp), sin: normalizeSin(row.sin_affinity), slot: skillSlot(row),
    atk: atkOf(row.atk_type ?? row.skill_type), defense: DEFENSE.has(row.skill_type ?? ''), corrosion: false,
    icon: identity.game_id ? getSkillIconUrl({ sinner_id: identity.sinner_id, game_id: identity.game_id }, indices[row.id] ?? skillSlot(row), row) : '',
    ...numbers(row),
  }))
}

/** An E.G.O's awakening and corrosion skills at their highest threadspin; the sprite is the E.G.O's own portrait, as on its page. */
export function buildEgoSkills(ego: { image_url: string | null }, rows: readonly EgoSkillRow[], lang: Lang): ToolSkill[] {
  const best = new Map<string, EgoSkillRow>()
  for (const row of rows) {
    const key = row.category ?? 'awakening'
    if ((best.get(key)?.construe_level ?? -1) < (row.construe_level ?? 0)) best.set(key, row)
  }
  return ['awakening', 'corrosion'].flatMap(category => {
    const row = best.get(category)
    if (!row) return []
    const corrosion = category === 'corrosion'
    return [{
      key: row.id, name: inLanguage(lang, row.name, row.name_en, row.name_jp), sin: normalizeSin(row.sin_affinity), slot: 3 as const,
      atk: atkOf(row.skill_type), defense: false, corrosion,
      icon: corrosion ? (ego.image_url ?? '').replace('_awaken_profile', '_erosion_profile') : ego.image_url ?? '',
      ...numbers(row),
    }]
  })
}

const SIN_KEYS: Record<SinType, keyof typeof SIN_ATTRIBUTES> = { wrath: 'CRIMSON', lust: 'SCARLET', sloth: 'AMBER', gluttony: 'SHAMROCK', gloom: 'AZURE', pride: 'INDIGO', envy: 'VIOLET' }
const ATK_KEYS: Record<Atk, keyof typeof ATTACK_TYPES> = { slash: 'SLASH', pierce: 'PENETRATE', blunt: 'HIT' }

/** The damage calculator's skill fields from a loaded skill: the attack level is the level-65 one, as the identity page shows it. */
export function toDamageSkill(skill: ToolSkill, maxCoins: number) {
  return {
    basePower: skill.base_power, coinPower: skill.coin_power, coinCount: Math.min(maxCoins, Math.max(1, skill.coins)),
    offenseLevel: (skill.offense_level ?? IDENTITY_STAT_BASE_LEVEL) + MAX_IDENTITY_LEVEL - IDENTITY_STAT_BASE_LEVEL,
    skillSin: skill.sin ? SIN_KEYS[skill.sin] as string : '', skillAtk: skill.atk ? ATK_KEYS[skill.atk] as string : '',
  }
}

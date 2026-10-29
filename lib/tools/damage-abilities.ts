// Keyword and gift effects read from the game's own values (keyword_meta.abilities, ego_gifts.modifiers) instead of from
// the effect sentences. An ability is a name plus a value; this table says what each known name does to a skill's damage.

import type { Modifier, SavedModifier } from './damage'

/** One entry of keyword_meta.abilities: the game's buff `list` row. attribute (a sin), atk (an attack type) and coinOperator narrow when it applies. */
export type KeywordAbility = { ability: string; value?: number | null; attribute?: string | null; atk?: string | null; coinOperator?: string | null }

/** damage: dealt by the carrier (self) or taken by it (target); power: the skill's power; coin_power: the heads coin's added power; physical, sin: resistance of the target. */
export type EffectTarget = 'damage' | 'power' | 'coin_power' | 'physical' | 'sin'
export type EffectSide = 'self' | 'target'

/**
 * value: percent for damage (10 = +10%), a whole number for power and coin_power, a resistance amount for physical and sin.
 * scaled: the value is per stack (or per held item), flat otherwise. attribute, atk: kept in the game's English names; the effect applies only to a skill of that sin / attack type.
 */
export type AbilityEffect = { target: EffectTarget; side: EffectSide; value: number; scaled: boolean; attribute?: string; atk?: string }

type Rule = { target: EffectTarget; side: EffectSide; scaled: boolean }

// What each ability does. "ByStack" / "AsStack" abilities multiply their value by the stack count (AsStack: (int)value × stack);
// the others add it once. Fragile, Protection and Damage Up are the ByStack kind with ±0.1 and a maximum of 10 in the game data.
export const ABILITY_RULES: Readonly<Record<string, Rule>> = {
  AtkDamageMultiplier: { target: 'damage', side: 'self', scaled: false },
  AtkDamageMultiplierByStack: { target: 'damage', side: 'self', scaled: true },
  TakeAtkDamageMultiplier: { target: 'damage', side: 'target', scaled: false },
  TakeAtkDamageMultiplierByStack: { target: 'damage', side: 'target', scaled: true },
  SkillPowerAdder: { target: 'power', side: 'self', scaled: false },
  SkillPowerAdderAsStack: { target: 'power', side: 'self', scaled: true },
  SkillPowerResultAdder: { target: 'power', side: 'self', scaled: false },
  SkillPowerResultAdderAsStack: { target: 'power', side: 'self', scaled: true },
  AtkSkillPowerResultAdderAsStack: { target: 'power', side: 'self', scaled: true },
  CoinScaleAdderByStack: { target: 'coin_power', side: 'self', scaled: true },
  PlusCoinScaleAdder: { target: 'coin_power', side: 'self', scaled: false },
  AtkResistAdderByStack: { target: 'physical', side: 'target', scaled: true },
  AttributeResistAdderByStack: { target: 'sin', side: 'target', scaled: true },
}

// An ability that is none of the above may still touch damage; those are reported as not calculated, the rest (turn logic, buff giving) are not of interest.
const DAMAGE_RELATED = /Damage|Power|Resist|CoinScale|Multiplier/

/** The game's sin and attack type names as the calculator's skill choices. */
export const SIN_ATTRIBUTES = { CRIMSON: '분노', SCARLET: '색욕', AMBER: '나태', SHAMROCK: '탐식', AZURE: '우울', INDIGO: '오만', VIOLET: '질투' } as const
export const ATTACK_TYPES = { SLASH: '참격', PENETRATE: '관통', HIT: '타격' } as const
export type SkillTraits = { sin?: keyof typeof SIN_ATTRIBUTES; atk?: keyof typeof ATTACK_TYPES }

const roundTo = (value: number, places = 4) => Math.round(value * 10 ** places) / 10 ** places

/**
 * The effects of a keyword's abilities. A subtracting or multiplying coin's adder (coinOperator other than ADD) is not
 * one the calculator's heads coins can use, so it counts as not calculated, like every unknown damage-related ability.
 */
export function readAbilities(abilities: readonly KeywordAbility[] | null | undefined): { effects: AbilityEffect[]; unsupported: number } {
  const effects: AbilityEffect[] = []
  let unsupported = 0
  for (const entry of abilities ?? []) {
    const rule = ABILITY_RULES[entry?.ability]
    if (!rule) { if (typeof entry?.ability === 'string' && DAMAGE_RELATED.test(entry.ability)) unsupported++; continue }
    const value = entry.value
    if (typeof value !== 'number' || !Number.isFinite(value) || (entry.coinOperator && entry.coinOperator !== 'ADD')) { unsupported++; continue }
    effects.push({
      ...rule, value: rule.target === 'damage' ? roundTo(value * 100, 2) : value,
      ...(entry.attribute ? { attribute: entry.attribute } : {}), ...(entry.atk ? { atk: entry.atk } : {}),
    })
  }
  return { effects, unsupported }
}

export type GiftModifier = { target: string; value: number; per?: string | null; keyword?: string | null; sinner?: string | null; source?: string | null }

/**
 * The effects of a gift's ego_gifts.modifiers. A gift counts what the attacker deals, so a damage-taken entry is left
 * out, and so is an entry of a target the calculator has no place for. value: a fraction (0.1 = 10%), as the game data writes it. per "stack"/"coin": the value is per
 * stack of its keyword / per held coin, the count being the modifier's `stacks`.
 */
export function readGiftModifiers(modifiers: readonly GiftModifier[] | null | undefined): AbilityEffect[] {
  const effects: AbilityEffect[] = []
  for (const entry of modifiers ?? []) {
    if (!entry || typeof entry.value !== 'number' || !Number.isFinite(entry.value)) continue
    const scaled = entry.per === 'stack' || entry.per === 'coin'
    if (entry.target === 'damage') effects.push({ target: 'damage', side: 'self', value: roundTo(entry.value * 100, 2), scaled })
    else if (entry.target === 'power' || entry.target === 'coin_power') effects.push({ target: entry.target, side: 'self', value: entry.value, scaled })
  }
  return effects
}

/** The effects a skill meets: those not narrowed to another sin or attack type. */
export const appliesTo = (effect: Pick<AbilityEffect, 'attribute' | 'atk'>, skill: SkillTraits = {}) =>
  (!effect.attribute || effect.attribute === skill.sin) && (!effect.atk || effect.atk === skill.atk)

/** The sum shown on a tile: the first kind of effect the keyword has, counted at `stacks`. */
export function effectSummary(effects: readonly AbilityEffect[], stacks = 1): { target: EffectTarget; value: number } {
  const first = effects[0]
  if (!first) return { target: 'damage', value: 0 }
  const same = effects.filter(effect => effect.target === first.target)
  return { target: first.target, value: roundTo(same.reduce((sum, effect) => sum + effect.value * (effect.scaled ? stacks : 1), 0), 2) }
}

/** The damage and resistance modifiers of the saved modifiers' effects, for one skill (power effects are in `abilityPower`). */
export function effectModifiers(effects: readonly AbilityEffect[], stacks: number | undefined, skill: SkillTraits): Modifier[] {
  return effects.filter(effect => appliesTo(effect, skill) && (effect.target === 'damage' || effect.target === 'physical' || effect.target === 'sin'))
    .map(effect => {
      const value = effect.value * (effect.scaled ? stacks ?? 1 : 1)
      return { target: effect.target as 'damage' | 'physical' | 'sin', value: effect.target === 'damage' ? roundTo(value / 100, 6) : roundTo(value) }
    })
}

/** What the saved modifiers add to the skill's power and to the heads coin's power. */
export function abilityPower(saved: readonly SavedModifier[], skill: SkillTraits = {}): { power: number; coinPower: number } {
  let power = 0, coinPower = 0
  for (const modifier of saved) {
    for (const effect of modifier.effects ?? []) {
      if (!appliesTo(effect, skill)) continue
      const value = effect.value * (effect.scaled ? modifier.stacks ?? 1 : 1)
      if (effect.target === 'power') power += value
      else if (effect.target === 'coin_power') coinPower += value
    }
  }
  return { power, coinPower }
}

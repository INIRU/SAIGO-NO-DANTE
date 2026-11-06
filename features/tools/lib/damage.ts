// Community-derived skill damage formula (wikiwiki.jp/lcbwiki damage page and Korean write-ups); the game publishes none.
// The special flat addition of one skill (Ryōshū's "I Can Cook Anything") and the sin resonance bonus are left out.

import { STORAGE_BASE } from '@/lib/constants/game'
import { effectModifiers, type AbilityEffect, type EffectTarget, type SkillTraits } from './damage-abilities'

/** Physical resistance while staggered, by stage: none, stagger, stagger+, stagger++ (2 + (stage − 1) × 0.5). A weakening is added on top. */
export const STAGGER_RESIST = [null, 2, 2.5, 3] as const
/** A sin resistance is held between 0 and this after every buff and weakening. */
export const SIN_RESIST_MAX = 2
/** Outside stagger the physical resistance is held between −2 and 2 after every buff and weakening. */
export const PHYSICAL_RESIST_LIMIT = 2
/** The least a hit does: this share of the coin's power, rounded down, and at least 1. */
export const MIN_DAMAGE_RATE = 0.05
export type StaggerStage = 0 | 1 | 2 | 3

export const CRITICAL_BONUS = 0.2
export const CLASH_BONUS = 0.03
export const OBSERVATION_BONUS = 0.03

/**
 * damage: summed with buffs, passives, gifts and skill effects. resist: summed with resistances and the level difference.
 * final: multiplies the finished damage. physical, sin: added to that resistance itself (a weakening of 0.1 a stack).
 */
export type FormulaTarget = 'damage' | 'resist' | 'final' | 'physical' | 'sin'
/** power, coin_power: added to the skill's power / the heads coin's power before the damage is figured (a keyword's or gift's effect, never typed in). */
export type ModifierTarget = FormulaTarget | Extract<EffectTarget, 'power' | 'coin_power'>
/** value: a fraction for damage and resist (0.25 = +25%), a multiplier for final (2 = double), a resistance amount for physical and sin (0.3). */
export type Modifier = { target: FormulaTarget; value: number }

export type DamageInput = {
  /** The coin's final power when it hits. */
  power: number
  offenseLevel: number
  defenseLevel: number
  /** Resistance multipliers as the game shows them: 0.5, 1, 2 … */
  physicalResist: number
  sinResist: number
  stagger?: StaggerStage
  critical?: boolean
  /** Added to the critical hit's 0.2 (a fraction). */
  critAdder?: number
  /** The critical passives' sum (a fraction): the critical bonus is multiplied by 1 + this. */
  critPassive?: number
  clashCount?: number
  observationLevel?: number
  /** Flat damage added by both sides, weighed by the resistances and the level difference alone. */
  damageAdder?: number
  /** Flat damage added straight to the hit. */
  hpAdder?: number
  modifiers?: Modifier[]
}

function amount(value: number, name: string) {
  if (!Number.isFinite(value) || value < 0) throw new RangeError(`${name} must be zero or more`)
  return value
}
function count(value: number, name: string) {
  if (!Number.isInteger(value)) throw new RangeError(`${name} must be a whole number`)
  return amount(value, name)
}
function finite(value: number, name: string) {
  if (!Number.isFinite(value)) throw new RangeError(`${name} must be a number`)
  return value
}

// The game figures a hit in 32-bit floats, step by step in this order (game values), then floors it.
const f = Math.fround
// Below normal only half of the reduction counts; below 0 it stays at −0.5, the same as 0.
const resistTerm = (resist: number) => resist >= 1 ? f(resist - 1) : resist >= 0 ? f(f(resist - 1) * 0.5) : -0.5
// (defense − offense) over (|that| + 25): a higher defense takes from the hit.
const levelTerm = (offense: number, defense: number) => f(f(defense - offense) / f(Math.abs(defense - offense) + 25))

export function coinDamage(input: DamageInput) {
  const power = amount(input.power, 'power')
  const offense = count(input.offenseLevel, 'offenseLevel')
  const defense = count(input.defenseLevel, 'defenseLevel')
  const stagger = input.stagger ?? 0
  if (![0, 1, 2, 3].includes(stagger)) throw new RangeError('stagger must be 0 to 3')
  let physical = STAGGER_RESIST[stagger] ?? amount(input.physicalResist, 'physicalResist')
  let sin = amount(input.sinResist, 'sinResist')
  const clash = count(input.clashCount ?? 0, 'clashCount')
  const observation = count(input.observationLevel ?? 0, 'observationLevel')

  let damageSum = 0, resistSum = 0, finalMultiplier = 1
  for (const modifier of input.modifiers ?? []) {
    finite(modifier.value, 'modifier value')
    if (modifier.target === 'damage') damageSum += modifier.value
    else if (modifier.target === 'resist') resistSum += modifier.value
    else if (modifier.target === 'physical') physical += modifier.value
    else if (modifier.target === 'sin') sin += modifier.value
    else finalMultiplier *= amount(modifier.value, 'final multiplier')
  }
  // Staggered, the resistance is the stage's value plus the weakening, uncapped; otherwise it stays within ±2.
  if (!stagger) physical = Math.min(PHYSICAL_RESIST_LIMIT, Math.max(-PHYSICAL_RESIST_LIMIT, physical))
  sin = Math.min(SIN_RESIST_MAX, Math.max(0, sin))

  const base = f(f(f(resistTerm(sin) + resistTerm(physical)) - levelTerm(offense, defense)) + f(resistSum))
  const critical = input.critical
    ? f(f(f(finite(input.critAdder ?? 0, 'critAdder')) + f(CRITICAL_BONUS)) * Math.max(0, f(1 + f(finite(input.critPassive ?? 0, 'critPassive')))))
    : 0
  const resistFactor = Math.max(0, f(f(f(f(base + critical) + f(clash * f(CLASH_BONUS))) + f(observation * f(OBSERVATION_BONUS))) + 1))
  // The flat adder is weighed without the critical, clash and observation bonuses.
  const flat = f(Math.max(0, base) + 1)
  // The game does not stop the damage sum at 0: past −100% the least damage below takes over.
  const damageFactor = f(f(damageSum) + 1)
  const hit = f(f(f(finite(input.hpAdder ?? 0, 'hpAdder')) + f(flat * f(finite(input.damageAdder ?? 0, 'damageAdder')))) + f(f(power * resistFactor) * damageFactor))
  const minimum = Math.max(1, Math.floor(f(power * f(MIN_DAMAGE_RATE))))
  // The final multiplier stands for the abilities that change a hit after it is figured: it meets the floored value.
  const damage = Math.max(1, Math.floor(f(Math.max(minimum, Math.floor(hit)) * f(finalMultiplier))))
  return { damage, damageFactor, resistFactor, finalMultiplier }
}

/** A modifier the user typed in or picked. value: percent for damage and resist (25 = +25%), a multiplier for final, a resistance amount for physical and sin. */
export type SavedModifier = {
  id: number; name: string; value: number; target: ModifierTarget
  /** Picked from the keyword list: the keyword's Korean name (the catalog key), for its icon and name. */
  keyword?: string
  /** Who carries a picked keyword: the attacker or the target. */
  side?: 'self' | 'target'
  /** A stack keyword's count; `value` is then the count times its per-stack effect. */
  stacks?: number
  /** Picked from the gift list: what its artwork is drawn from, and which enhancement level it is. */
  gift?: { id: string; level: number; image_url: string | null; grade: string | null; keyword: string | null }
  /** The values its text offered, to switch between. */
  options?: number[]
  /**
   * What a keyword or gift read from the game's own values does (damage-abilities.ts). When present, `value`/`target` are only
   * the tile's summary and the calculation uses these, each scaled by `stacks` where it is per stack.
   */
  effects?: AbilityEffect[]
  /** The one coin it applies to, counted from 1; every coin when absent. */
  coin?: number
}
export const MAX_COINS = 10
/** The coins a modifier may be set to, 0 for every coin: those the skill has, and after them the saved one while the skill has fewer (it then applies to no coin). */
export const coinChoices = (coinCount: number, saved?: number): number[] =>
  [0, ...Array.from({ length: coinCount }, (_, index) => index + 1), ...(saved && saved > coinCount ? [saved] : [])]
export const MAX_MODIFIER_OPTIONS = 8
/** Gift artwork is drawn only from the site's own storage. */
export const GIFT_IMAGE_BASE = `${STORAGE_BASE}/`
// Far above any count of modifiers, and the next id (the largest + 1) is still a distinct whole number.
const MAX_MODIFIER_ID = 1e9
export const MODIFIER_TARGETS: ModifierTarget[] = ['damage', 'resist', 'physical', 'sin', 'final']
const SAVED_TARGETS: ModifierTarget[] = [...MODIFIER_TARGETS, 'power', 'coin_power']
/** The range a typed value may take: a final multiplier cannot be negative. */
export const clampModifierValue = (value: number, target: ModifierTarget) =>
  Math.min(MAX_MODIFIER_VALUE, Math.max(target === 'final' ? 0 : -MAX_MODIFIER_VALUE, value))
/** The saved value as coinDamage takes it: held to its range (whatever was saved, the calculation must not refuse it), percents as fractions. */
export const toModifier = ({ target, value }: Pick<SavedModifier, 'target' | 'value'>): Modifier => {
  const held = clampModifierValue(value, target)
  return { target: target as FormulaTarget, value: target === 'damage' || target === 'resist' ? held / 100 : held }
}
/** What applies to the `coin`th coin (from 1): the modifiers for every coin and those set to this one. */
export const coinModifiers = (saved: readonly SavedModifier[], coin: number, skill: SkillTraits = {}): Modifier[] =>
  saved.filter(modifier => modifier.coin === undefined || modifier.coin === coin)
    .flatMap(modifier => modifier.effects ? effectModifiers(modifier.effects, modifier.stacks, skill) : [toModifier(modifier)])
export const MAX_MODIFIERS = 30
export const MAX_MODIFIER_NAME = 40
export const MAX_MODIFIER_VALUE = 1000

/** Reads the browser's saved modifiers. Anything that is not a modifier is dropped rather than repaired. */
export function parseSavedModifiers(raw: string | null): SavedModifier[] {
  let rows: unknown
  try { rows = JSON.parse(raw ?? '') } catch { return [] }
  if (!Array.isArray(rows)) return []
  const saved = new Map<number, SavedModifier>()
  for (const row of rows) {
    if (saved.size >= MAX_MODIFIERS) break
    if (!row || typeof row !== 'object') continue
    const { id, name, value, target } = row as Record<string, unknown>
    if (!Number.isInteger(id) || (id as number) < 0 || (id as number) > MAX_MODIFIER_ID || saved.has(id as number) || typeof name !== 'string' || typeof value !== 'number' || !Number.isFinite(value)) continue
    if (!SAVED_TARGETS.includes(target as ModifierTarget) || (target === 'final' && value < 0)) continue
    saved.set(id as number, {
      id: id as number, name: name.slice(0, MAX_MODIFIER_NAME), value: clampModifierValue(value, target as ModifierTarget), target: target as ModifierTarget,
      ...savedSource(row as Record<string, unknown>, target as ModifierTarget),
    })
  }
  return [...saved.values()]
}

const text = (value: unknown, max: number): value is string => typeof value === 'string' && value.length <= max
// A keyword or a grade is looked up in plain tables where it is drawn: not a name every object answers to ("constructor", "__proto__").
const key = (value: unknown, max: number): value is string => text(value, max) && !(value in Object.prototype)

const EFFECT_TARGETS = ['damage', 'power', 'coin_power', 'physical', 'sin']
function isEffect(row: unknown): row is AbilityEffect {
  if (!row || typeof row !== 'object') return false
  const { target, side, value, scaled, attribute, atk } = row as Record<string, unknown>
  return EFFECT_TARGETS.includes(target as string) && (side === 'self' || side === 'target') && typeof value === 'number' && Math.abs(value) <= MAX_MODIFIER_VALUE
    && typeof scaled === 'boolean' && (attribute === undefined || key(attribute, 20)) && (atk === undefined || key(atk, 20))
}

/** The optional parts of a saved modifier. A part that is not what it should be is left out; the modifier itself stays. */
function savedSource({ keyword, side, stacks, gift, options, coin, effects }: Record<string, unknown>, target: ModifierTarget): Partial<SavedModifier> {
  const source: Partial<SavedModifier> = {}
  if (Number.isInteger(coin) && (coin as number) >= 1 && (coin as number) <= MAX_COINS) source.coin = coin as number
  if (key(keyword, 60)) source.keyword = keyword
  if (side === 'self' || side === 'target') source.side = side
  if (Number.isInteger(stacks) && (stacks as number) >= 1 && (stacks as number) <= 99) source.stacks = stacks as number
  if (Array.isArray(options) && options.length <= MAX_MODIFIER_OPTIONS && options.every(option => typeof option === 'number' && Number.isFinite(option))) {
    source.options = options.map(option => clampModifierValue(option, target))
  }
  const kept = Array.isArray(effects) ? effects.slice(0, MAX_MODIFIER_OPTIONS * 2).filter(isEffect) : []
  if (kept.length) source.effects = kept
  if (gift && typeof gift === 'object') {
    const { id, level, image_url, grade, keyword: giftKeyword } = gift as Record<string, unknown>
    const ownImage = image_url === null || (text(image_url, 500) && image_url.startsWith(GIFT_IMAGE_BASE) && !image_url.includes('..'))
    if (text(id, 40) && [0, 1, 2].includes(level as number) && ownImage && (grade === null || key(grade, 10)) && (giftKeyword === null || key(giftKeyword, 40))) {
      source.gift = { id, level: level as number, image_url: image_url as string | null, grade, keyword: giftKeyword }
    }
  }
  return source
}

/** The power each coin hits with: the base power plus the coin power of every heads so far, never below 0. */
export function coinPowers(basePower: number, coinPower: number, heads: boolean[]): number[] {
  let power = basePower
  return heads.map(isHeads => Math.max(0, power += isHeads ? coinPower : 0))
}

/**
 * What a number field holds while it is typed in: the number, kept inside its range (whole unless `decimal`), or null
 * while the text is not a number yet (emptied, or a lone "-", which a number field reports as empty).
 */
export function parseNumberInput(raw: string, { min, max, decimal = false }: { min: number; max: number; decimal?: boolean }): number | null {
  const value = raw.trim() === '' ? NaN : Number(raw)
  if (!Number.isFinite(value)) return null
  return Math.max(min, Math.min(max, decimal ? value : Math.trunc(value)))
}

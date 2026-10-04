// Community-derived skill damage formula (wikiwiki.jp/lcbwiki damage page and Korean write-ups); the game publishes none.
// The special flat addition of one skill (Ryōshū's "I Can Cook Anything") and the sin resonance bonus are left out.

import { STORAGE_BASE } from '@/lib/constants/game'

/** Physical resistance while staggered, by stage: none, stagger, stagger+, stagger++. */
export const STAGGER_RESIST = [null, 2, 2.5, 3] as const
export type StaggerStage = 0 | 1 | 2 | 3

export const CRITICAL_BONUS = 0.2
export const CLASH_BONUS = 0.03
export const OBSERVATION_BONUS = 0.03

/**
 * damage: summed with buffs, passives, gifts and skill effects. resist: summed with resistances and the level difference.
 * final: multiplies the finished damage. physical, sin: added to that resistance itself (a weakening of 0.1 a stack).
 */
export type ModifierTarget = 'damage' | 'resist' | 'final' | 'physical' | 'sin'
/** value: a fraction for damage and resist (0.25 = +25%), a multiplier for final (2 = double), a resistance amount for physical and sin (0.3). */
export type Modifier = { target: ModifierTarget; value: number }

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
  clashCount?: number
  observationLevel?: number
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

// Below normal, only half of the reduction counts: two ×0.5 resistances halve the damage instead of removing it.
const resistTerm = (resist: number) => resist >= 1 ? resist - 1 : (resist - 1) / 2

const levelTerm = (offense: number, defense: number) => (offense - defense) / (Math.abs(offense - defense) + 25)

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

  let damageFactor = 1
  let resistFactor = 1 + levelTerm(offense, defense)
    + (input.critical ? CRITICAL_BONUS : 0) + clash * CLASH_BONUS + observation * OBSERVATION_BONUS
  let finalMultiplier = 1
  for (const modifier of input.modifiers ?? []) {
    if (!Number.isFinite(modifier.value)) throw new RangeError('modifier value must be a number')
    if (modifier.target === 'damage') damageFactor += modifier.value
    else if (modifier.target === 'resist') resistFactor += modifier.value
    // A stagger fixes the physical resistance, so a weakening does not move it.
    else if (modifier.target === 'physical') physical = STAGGER_RESIST[stagger] ?? Math.max(0, physical + modifier.value)
    else if (modifier.target === 'sin') sin = Math.max(0, sin + modifier.value)
    else finalMultiplier *= amount(modifier.value, 'final multiplier')
  }
  resistFactor += resistTerm(physical) + resistTerm(sin)
  // Each side stops at zero: reductions past −100% on both would otherwise multiply into a gain.
  damageFactor = Math.max(0, damageFactor)
  resistFactor = Math.max(0, resistFactor)

  // Rounded to six places first: 100 × 1.15 is 114.99999999999999 in binary and would floor to 114.
  const whole = (value: number) => Math.floor(Math.round(value * 1e6) / 1e6)
  // The write-ups say a final multiplier applies "after the damage calculation", so it meets the floored value.
  const damage = Math.max(1, whole(Math.max(1, whole(power * damageFactor * resistFactor)) * finalMultiplier))
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
}
export const MAX_MODIFIER_OPTIONS = 8
/** Gift artwork is drawn only from the site's own storage. */
export const GIFT_IMAGE_BASE = `${STORAGE_BASE}/`
// Far above any count of modifiers, and the next id (the largest + 1) is still a distinct whole number.
const MAX_MODIFIER_ID = 1e9
export const MODIFIER_TARGETS: ModifierTarget[] = ['damage', 'resist', 'physical', 'sin', 'final']
/** The range a typed value may take: a final multiplier cannot be negative. */
export const clampModifierValue = (value: number, target: ModifierTarget) =>
  Math.min(MAX_MODIFIER_VALUE, Math.max(target === 'final' ? 0 : -MAX_MODIFIER_VALUE, value))
/** The saved value as coinDamage takes it: held to its range (whatever was saved, the calculation must not refuse it), percents as fractions. */
export const toModifier = ({ target, value }: Pick<SavedModifier, 'target' | 'value'>): Modifier => {
  const held = clampModifierValue(value, target)
  return { target, value: target === 'damage' || target === 'resist' ? held / 100 : held }
}
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
    if (!MODIFIER_TARGETS.includes(target as ModifierTarget) || (target === 'final' && value < 0)) continue
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

/** The optional parts of a saved modifier. A part that is not what it should be is left out; the modifier itself stays. */
function savedSource({ keyword, side, stacks, gift, options }: Record<string, unknown>, target: ModifierTarget): Partial<SavedModifier> {
  const source: Partial<SavedModifier> = {}
  if (key(keyword, 60)) source.keyword = keyword
  if (side === 'self' || side === 'target') source.side = side
  if (Number.isInteger(stacks) && (stacks as number) >= 1 && (stacks as number) <= 99) source.stacks = stacks as number
  if (Array.isArray(options) && options.length <= MAX_MODIFIER_OPTIONS && options.every(option => typeof option === 'number' && Number.isFinite(option))) {
    source.options = options.map(option => clampModifierValue(option, target))
  }
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

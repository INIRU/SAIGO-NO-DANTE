// 데미지 계산기가 쓰는 값의 모양. 규칙을 읽는 damage-abilities.ts와 식을 푸는 damage.ts가 같이 읽는다.

/** damage: dealt by the carrier (self) or taken by it (target); power: the skill's power; coin_power: the heads coin's added power; physical, sin: resistance of the target. */
export type EffectTarget = 'damage' | 'power' | 'coin_power' | 'physical' | 'sin'
export type EffectSide = 'self' | 'target'

/**
 * value: percent for damage (10 = +10%), a whole number for power and coin_power, a resistance amount for physical and sin.
 * scaled: the value is per stack (or per held item), flat otherwise. attribute, atk: kept in the game's English names; the effect applies only to a skill of that sin / attack type.
 */
export type AbilityEffect = { target: EffectTarget; side: EffectSide; value: number; scaled: boolean; attribute?: string; atk?: string }

/**
 * damage: summed with buffs, passives, gifts and skill effects. resist: summed with resistances and the level difference.
 * final: multiplies the finished damage. physical, sin: added to that resistance itself (a weakening of 0.1 a stack).
 */
export type FormulaTarget = 'damage' | 'resist' | 'final' | 'physical' | 'sin'
/** power, coin_power: added to the skill's power / the heads coin's power before the damage is figured (a keyword's or gift's effect, never typed in). */
export type ModifierTarget = FormulaTarget | Extract<EffectTarget, 'power' | 'coin_power'>
/** value: a fraction for damage and resist (0.25 = +25%), a multiplier for final (2 = double), a resistance amount for physical and sin (0.3). */
export type Modifier = { target: FormulaTarget; value: number }

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

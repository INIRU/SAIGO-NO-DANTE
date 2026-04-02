import type { Skill, Passive } from '@/lib/types'

export type NumDiff = { from: number; to: number }

export type SkillDiff = {
  base_power?: NumDiff
  coin_power?: NumDiff
  coins?: NumDiff
  offense_level?: NumDiff
  atk_weight?: NumDiff
  hasDescDiff: boolean
  level4Desc?: string
}

export type PassiveDiff = {
  sin_count?: NumDiff
  hasDescDiff: boolean
  level4Desc?: string
}

function skillKey(s: Skill): string {
  return `${s.skill_order}:${s.variant_order ?? 0}`
}

function passiveKey(p: Passive): string {
  return `${p.passive_type}:${p.passive_order}`
}

function numDiff(a: number | undefined | null, b: number | undefined | null): NumDiff | undefined {
  if (a == null || b == null || a === b) return undefined
  return { from: a, to: b }
}

export function computeSkillDiffs(
  level3: Skill[],
  level4: Skill[],
): { diffs: Map<string, SkillDiff>; newSkills: Skill[] } {
  const map3 = new Map<string, Skill>()
  for (const s of level3) map3.set(skillKey(s), s)

  const diffs = new Map<string, SkillDiff>()
  const newSkills: Skill[] = []

  for (const s4 of level4) {
    const s3 = map3.get(skillKey(s4))
    if (!s3) { newSkills.push(s4); continue }

    const diff: SkillDiff = { hasDescDiff: false }
    const bp = numDiff(s3.base_power, s4.base_power)
    if (bp) diff.base_power = bp
    const cp = numDiff(s3.coin_power, s4.coin_power)
    if (cp) diff.coin_power = cp
    const co = numDiff(s3.coins, s4.coins)
    if (co) diff.coins = co
    const ol = numDiff(s3.offense_level, s4.offense_level)
    if (ol) diff.offense_level = ol
    const aw = numDiff(s3.atk_weight, s4.atk_weight)
    if (aw) diff.atk_weight = aw

    if ((s3.description || '') !== (s4.description || '')) {
      diff.hasDescDiff = true
      diff.level4Desc = s4.description || ''
    }

    const { hasDescDiff, level4Desc, ...rest } = diff
    if (hasDescDiff || Object.values(rest).some(v => v !== undefined)) {
      diffs.set(s3.id, diff)
    }
  }

  return { diffs, newSkills }
}

export function computePassiveDiffs(
  level3: Passive[],
  level4: Passive[],
): { diffs: Map<string, PassiveDiff>; newPassives: Passive[] } {
  const map3 = new Map<string, Passive>()
  for (const p of level3) map3.set(passiveKey(p), p)

  const diffs = new Map<string, PassiveDiff>()
  const newPassives: Passive[] = []

  for (const p4 of level4) {
    const p3 = map3.get(passiveKey(p4))
    if (!p3) { newPassives.push(p4); continue }

    const diff: PassiveDiff = { hasDescDiff: false }
    const sc = numDiff(p3.sin_count, p4.sin_count)
    if (sc) diff.sin_count = sc

    if ((p3.description || '') !== (p4.description || '')) {
      diff.hasDescDiff = true
      diff.level4Desc = p4.description || ''
    }

    if (diff.hasDescDiff || diff.sin_count) {
      diffs.set(p3.id, diff)
    }
  }

  return { diffs, newPassives }
}

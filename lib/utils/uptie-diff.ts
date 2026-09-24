import type { Skill, Passive } from '@/lib/types'

export type NumDiff = { from: number; to: number }
/** A description line that differs between two uptie levels. coin 0 = not inside a coin section. */
export type LineChange = { kind: 'added' | 'removed'; coin: number; text: string }

export type SkillDiff = {
  next: Skill
  base_power?: NumDiff
  coin_power?: NumDiff
  coins?: NumDiff
  offense_level?: NumDiff
  atk_weight?: NumDiff
}

export type PassiveDiff = { next: Passive; sin_count?: NumDiff }

type Described = { description?: string | null; description_en?: string | null; description_jp?: string | null }

const skillKey = (s: Skill) => `${s.skill_order}:${s.variant_order ?? 0}`
const passiveKey = (p: Passive) => `${p.passive_type}:${p.passive_order}`

function numDiff(a: number | undefined | null, b: number | undefined | null): NumDiff | undefined {
  return a == null || b == null || a === b ? undefined : { from: a, to: b }
}

const descChanged = (a: Described, b: Described) =>
  (['description', 'description_en', 'description_jp'] as const).some(f => (a[f] || '') !== (b[f] || ''))

const COIN_PREFIX = /^\[(?:코인|Coin|コイン)\s?(\d+)\]\s*/

/** Non-empty lines tagged with their coin; the "[코인 N]" prefix moves into the tag. */
function taggedLines(description: string) {
  let coin = 0
  return description.split('\n').flatMap(raw => {
    const match = raw.match(COIN_PREFIX)
    if (match) coin = Number(match[1])
    const text = raw.replace(COIN_PREFIX, '').trim()
    return text ? [{ coin, text }] : []
  })
}

/**
 * Line diff (LCS) from one description to the next level's. Only changed lines are returned;
 * within each changed run, removed lines come before the lines that replace them.
 */
export function diffDescriptionLines(from: string, to: string): LineChange[] {
  const a = taggedLines(from)
  const b = taggedLines(to)
  const same = (i: number, j: number) => a[i].coin === b[j].coin && a[i].text === b[j].text
  const lcs = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0))
  for (let i = a.length - 1; i >= 0; i--)
    for (let j = b.length - 1; j >= 0; j--)
      lcs[i][j] = same(i, j) ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1])

  const out: LineChange[] = []
  let removed: LineChange[] = []
  let added: LineChange[] = []
  const flush = () => { out.push(...removed, ...added); removed = []; added = [] }
  let i = 0
  let j = 0
  while (i < a.length || j < b.length) {
    if (i < a.length && j < b.length && same(i, j)) { flush(); i++; j++ }
    else if (j < b.length && (i === a.length || lcs[i][j + 1] >= lcs[i + 1][j])) added.push({ kind: 'added', ...b[j++] })
    else removed.push({ kind: 'removed', ...a[i++] })
  }
  flush()
  return out
}

/** Compares the current level's skills with the next level's, keyed by slot and variant. */
export function computeSkillDiffs(current: Skill[], next: Skill[]): { diffs: Map<string, SkillDiff>; newSkills: Skill[] } {
  const byKey = new Map(current.map(s => [skillKey(s), s]))
  const diffs = new Map<string, SkillDiff>()
  const newSkills: Skill[] = []
  for (const to of next) {
    const from = byKey.get(skillKey(to))
    if (!from) { newSkills.push(to); continue }
    const numbers = {
      base_power: numDiff(from.base_power, to.base_power),
      coin_power: numDiff(from.coin_power, to.coin_power),
      coins: numDiff(from.coins, to.coins),
      offense_level: numDiff(from.offense_level, to.offense_level),
      atk_weight: numDiff(from.atk_weight, to.atk_weight),
    }
    if (descChanged(from, to) || Object.values(numbers).some(Boolean)) diffs.set(from.id, { next: to, ...numbers })
  }
  return { diffs, newSkills }
}

export function computePassiveDiffs(current: Passive[], next: Passive[]): { diffs: Map<string, PassiveDiff>; newPassives: Passive[] } {
  const byKey = new Map(current.map(p => [passiveKey(p), p]))
  const diffs = new Map<string, PassiveDiff>()
  const newPassives: Passive[] = []
  for (const to of next) {
    const from = byKey.get(passiveKey(to))
    if (!from) { newPassives.push(to); continue }
    const sin_count = numDiff(from.sin_count, to.sin_count)
    if (descChanged(from, to) || sin_count) diffs.set(from.id, { next: to, sin_count })
  }
  return { diffs, newPassives }
}

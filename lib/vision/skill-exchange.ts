import { SINNER_SLUGS } from '@/lib/constants/game'
import { translations } from '@/lib/i18n/translations'

/** Skill 1/2/3 copies of one identity in the run deck. */
export type SkillCounts = [number, number, number]

/** Shop skill replacement window: the sinner in its title (1 = Yi Sang … 12 = Gregor) and the "스킬 보유 현황" counts. */
export interface SkillExchangeRead { sinner: number; current: SkillCounts | null }

const squash = (value: string) => value.normalize('NFKC').replace(/\s+/g, '').toLowerCase()
const SINNER_NAMES = SINNER_SLUGS.map((slug, index) => ({ sinner: index + 1,
  names: Object.values(translations[`sinner.${slug}` as keyof typeof translations]).map(squash) }))

/**
 * Reads the window from a full-frame OCR text: one line starting with a sinner name and the skill word ("이스마엘 스킬 교체")
 * and the window's "스킬 보유 현황" header or "SKILL1x3" holding counts. The shop list itself shows items with the same
 * "로쟈 스킬 교체" wording, so a title without the window's own text, or several titles, never count.
 */
export function readSkillExchange(text: string): SkillExchangeRead | null {
  const lines = text.split('\n').map(squash)
  const counts: number[] = []
  // Two holding counts are sometimes read as one line ("SKILL2x2 SKILL3x3").
  for (const line of lines) for (const match of line.matchAll(/skill([123])[x×]([0-6])/g)) counts[Number(match[1]) - 1] ??= Number(match[2])
  const current = counts.length === 3 && counts.every(Number.isInteger) && counts[0] + counts[1] + counts[2] === 6
    ? counts as SkillCounts : null
  if (!current && !lines.some(line => line.includes('스킬보유현황'))) return null
  const sinners = new Set(lines.flatMap(line => SINNER_NAMES.filter(({ names }) =>
    names.some(name => line.startsWith(name) && /^(스킬|skill|スキル)/.test(line.slice(name.length)))).map(item => item.sinner)))
  return sinners.size === 1 ? { sinner: [...sinners][0], current } : null
}

/** One kind of replacement the window offers (S1→S2, S2→S3 or S1→S3) and how many times to buy it. */
export interface SkillExchangeMove { from: 1 | 2; to: 2 | 3; count: number }

/**
 * Replacements from the current counts to the plan's: each one turns a lower skill copy into a higher one, so a target
 * with more Skill 1 copies or fewer Skill 3 copies is unreachable (null). S1→S3 costs about the same as S1→S2 plus
 * S2→S3, so the direct swap is used as often as possible to need the fewest purchases.
 */
export function skillExchangeMoves(current: SkillCounts, target: SkillCounts): SkillExchangeMove[] | null {
  const fromSkill1 = current[0] - target[0]
  const toSkill3 = target[2] - current[2]
  if (fromSkill1 < 0 || toSkill3 < 0 || current[0] + current[1] + current[2] !== target[0] + target[1] + target[2]) return null
  const direct = Math.min(fromSkill1, toSkill3)
  return ([{ from: 1, to: 3, count: direct }, { from: 1, to: 2, count: fromSkill1 - direct }, { from: 2, to: 3, count: toSkill3 - direct }] as SkillExchangeMove[])
    .filter(move => move.count > 0)
}

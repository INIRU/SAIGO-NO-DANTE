import { SINNER_SLUGS } from '@/lib/constants/game'
import { translations } from '@/lib/i18n/translations'
import { skillExchangeMoves, type SkillCounts } from '@/lib/utils/skill-exchange-moves'

export { skillExchangeMoves }

/** Shop skill replacement window: the sinner in its title (1 = Yi Sang … 12 = Gregor) and the "스킬 보유 현황" counts. */
export interface SkillExchangeRead { sinner: number; current: SkillCounts | null }

// Accents go too: OCR reads "Ryōshū" as "Ryoshu" or "Ryshu".
const squash = (value: string) => value.normalize('NFKD').replace(/\p{M}/gu, '').normalize('NFKC').replace(/\s+/g, '').toLowerCase()
const SINNER_NAMES = SINNER_SLUGS.map((slug, index) => ({ sinner: index + 1,
  names: Object.values(translations[`sinner.${slug}` as keyof typeof translations]).map(squash) }))

/**
 * Reads the window from a full-frame OCR text: one title line naming a sinner ("이스마엘 스킬 교체" / "Replace Ishmael's
 * Skill" / "イシュメールスキル交換") and the window's "스킬 보유 현황" / "Skills Owned" / "スキル保有状況" header or "SKILL1x3"
 * holding counts. The shop list itself shows items with the same "로쟈 스킬 교체" wording, so a title without the window's
 * own text, or several titles, never count.
 */
export function readSkillExchange(text: string): SkillExchangeRead | null {
  const lines = text.split('\n').map(squash)
  const counts: number[] = []
  // Two holding counts are sometimes read as one line ("SKILL2x2 SKILL3x3").
  for (const line of lines) for (const match of line.matchAll(/skill([123])[x×]([0-6])/g)) counts[Number(match[1]) - 1] ??= Number(match[2])
  const current = counts.length === 3 && counts.every(Number.isInteger) && counts[0] + counts[1] + counts[2] === 6
    ? counts as SkillCounts : null
  if (!current && !lines.some(line => /스킬보유현황|skillsowned|スキル保有状況/.test(line))) return null
  const titled = (match: (name: string, read: string) => boolean) => new Set(lines.flatMap(line => {
    const read = /^replace(.+?)(?:['’]s|s)?skill/.exec(line)?.[1] ?? /^(.+?)(스킬|skill|スキル)/.exec(line)?.[1]
    return read ? SINNER_NAMES.filter(({ names }) => names.some(name => match(name, read))).map(item => item.sinner) : []
  }))
  const exact = titled((name, read) => name === read)
  // A name misread, dropped or added by one letter ("로쟈" as "로샤", "ryoshu" as "ryshu") still counts when only one sinner is that close.
  const sinners = exact.size ? exact : titled((name, read) => oneEdit([...name], [...read]))
  return sinners.size === 1 ? { sinner: [...sinners][0], current } : null
}

function oneEdit(a: string[], b: string[]): boolean {
  if (Math.abs(a.length - b.length) > 1) return false
  let i = 0, j = 0, edits = 0
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { i++; j++; continue }
    if (++edits > 1) return false
    if (a.length > b.length) i++
    else if (b.length > a.length) j++
    else { i++; j++ }
  }
  return edits + (a.length - i) + (b.length - j) === 1
}


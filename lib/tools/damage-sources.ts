// What the game's own effect texts say about skill damage, read from the Korean source text (ego_gifts.effect_base,
// keyword_meta.description). Gifts carry their numbers nowhere else in the extracted data (limbus-asset-extractor/site-sync/docs/provenance.md).

import type { SupportedLang } from '@/lib/i18n/types'
import type { KeywordInfo } from '@/lib/keywords/catalog'
import { MAX_MODIFIER_OPTIONS, type SavedModifier } from './damage'

// The first three are the attack types (physical resistance), the rest the sins.
const ATTRIBUTES = ['참격', '관통', '타격', '분노', '색욕', '나태', '탐식', '우울', '오만', '질투']
// "한 턴 동안 관통 스킬로 받는 피해가 수치에 비례하여 증가 (최대 10)"; the general keyword names no attribute, a sin is "나태 속성 스킬로".
const PROPORTIONAL = new RegExp(`(?:(${ATTRIBUTES.join('|')})(?: 속성)? )?스킬로 (받는|가하는) 피해가 수치에 비례하여 (증가|감소)(?:\\s*\\(최대 (\\d+)\\))?`)
// "대상의 참격 내성을 (스택 * 0.1) 증가"; the game also writes "관통 속성 내성". Only a resistance it names: "모든 내성" is not one value to raise.
const WEAKENING = new RegExp(`(${ATTRIBUTES.join('|')})(?: 속성)? 내성을 \\((?:스택|수치)\\s*[*xX×]\\s*(\\d+(?:\\.\\d+)?)\\)\\s*증가`)
// "In proportion to the count" is 10% a stack in the game data (TakeAtkDamageMultiplierByStack / AtkDamageMultiplierByStack ±0.1); the text does not say it.
const PROPORTION = 10
export const MAX_STACKS = 10

/** Who carries an effect: the attacker (damage dealt) or the target (damage taken, resistances). */
export type Side = 'self' | 'target'
/** perStack: percent for damage, a resistance value for physical and sin. */
export type StackEffect = { target: 'damage' | 'physical' | 'sin'; perStack: number; max: number; side: Side }

// Listed by kind (Fragile, Protection, Damage Up, Damage Down, weakenings), and within a kind the general keyword first, then attack types, then sins.
function readStack(text: string): { effect: StackEffect; rank: number } | null {
  const proportional = PROPORTIONAL.exec(text)
  if (proportional) {
    const [, attribute, verb, word, max] = proportional
    const taken = verb === '받는', more = word === '증가'
    return {
      effect: { target: 'damage', perStack: more ? PROPORTION : -PROPORTION, max: max ? Number(max) : MAX_STACKS, side: taken ? 'target' : 'self' },
      rank: ((taken ? 0 : 2) + (more ? 0 : 1)) * 100 + ATTRIBUTES.indexOf(attribute) + 1,
    }
  }
  const weakening = WEAKENING.exec(text)
  if (!weakening) return null
  const attribute = ATTRIBUTES.indexOf(weakening[1])
  return { effect: { target: attribute < 3 ? 'physical' : 'sin', perStack: Number(weakening[2]), max: MAX_STACKS, side: 'target' }, rank: 400 + attribute + 1 }
}

/**
 * The keywords whose effect is their stack count, known by the sentence of their Korean text, not by their name: damage
 * dealt or taken "in proportion to the count" changes by 10% a stack (Protection, Fragile, Damage Up and Down, general,
 * per attack type and per sin), and a weakening raises its resistance by the amount it states. A keyword the game adds
 * with either sentence is a stack keyword without a change here.
 */
export const stackEffect = (text: string): StackEffect | null => readStack(text)?.effect ?? null

export const mentionsDamage = (text: string) => text.includes('피해')

// Either "피해량 +(…)%" (a formula: its sign optional, its direction possibly the word after it) or a percent, with what may
// stand around it: 최대 before (also "최대 3, 30%"), a sign, 증가/감소 after.
const TOKEN = /(피해량?(?:이|을|가)?\s*([+＋\-−])?\s*\([^()]*\)\s*%(?:만큼)?\s*(증가|감소)?)|(최대\s*(?:\d+(?:\.\d+)?\s*,\s*)?)?([+＋\-−])?\s*(\d+(?:\.\d+)?)\s*%(?:\s*(증가|감소))?/g
// Damage of an effect (bleed, sinking …, also written as the game's [Keyword] placeholder), to SP or to a shield, not of the skill.
const EFFECT_DAMAGE = /(출혈|화상|파열|침잠|진동|정신력)\s*(피해|효과[로가와])|\[\w+\]\s*(피해|효과[로가와])|보호막에/
// It is the enemy who takes it.
const FOE = /(적|대상)(?:이|가|은)?\s*받는/
const direction = (sign: string | undefined, word?: string) => sign === '-' || sign === '−' || (!sign && word === '감소') ? -1 : 1

/**
 * value: the signed percent, null for a formula that states no maximum. taken: the damage its holder takes ("받는"), not
 * deals. foe: it is the enemy who takes it ("적이 받는"), so it raises what the attacker deals.
 */
export type DamageChange = { value: number | null; taken: boolean; foe: boolean }

// While a line is read, a change also remembers its direction, for the maximum that may follow it.
type Found = DamageChange & { sign: number }

/**
 * The changes a text makes to skill damage, in the order written. A change that scales ("…당 +10% (최대 30%)",
 * "+(합 횟수 x 6)% (최대 30%)") counts as its stated maximum.
 */
// pattern matching on game sentences; a wrong or missing value is corrected by the user in the calculator. If the game data ever carries gift ability values, read those instead.
export function damageChanges(text: string): DamageChange[] {
  const changes: DamageChange[] = []
  // A maximum written on its own line belongs to the line above it.
  for (const line of text.replace(/<[^>]+>/g, '').replace(/\n\s*(?=\(최대)/g, ' ').split('\n')) {
    if (!mentionsDamage(line)) continue
    // The change a following "(최대 N%)" belongs to.
    let open: Found | null = null
    const found: Found[] = []
    for (const match of line.matchAll(TOKEN)) {
      const [, formula, formulaSign, formulaWord, maximum, sign, number, word] = match
      if (maximum) {
        if (open) open.value = open.sign * Number(number)
        open = null
        continue
      }
      // A percent speaks of damage when "피해" stands in its own clause: "크리티컬 확률 +10%, 피해량 +20%" has one.
      const start = line.lastIndexOf(',', match.index) + 1
      const clause = line.slice(start, match.index + (formula ? formula.length : 0))
      // A bare percent right after "피해량" is an increase ("가하는 피해량 10% (최대 30%)").
      const by = formula ? direction(formulaSign, formulaWord) : sign || word ? direction(sign, word) : /피해량?\s*$/.test(clause) ? 1 : 0
      // "피해량의 10%만큼 회복" is a share of the damage, not a change of it.
      if (!by || !clause.includes('피해') || /의\s*$/.test(clause) || EFFECT_DAMAGE.test(clause)) { open = null; continue }
      // Taken, not dealt: "받는 피해량", or the clause before it sets the scene ("피해를 받을 때, 피해량 -25%").
      const taken = clause.includes('받는') || /피해를?\s*받(을 때|으면|을 경우)\s*,\s*$/.test(line.slice(0, start))
      found.push(open = { value: formula ? null : by * Number(number), taken, foe: taken && FOE.test(clause), sign: by })
    }
    for (const { value, taken, foe } of found) changes.push({ value, taken, foe })
    // A formula in a form the pattern does not read (nested brackets, the formula before the word, "N%씩") is still a
    // change: its stated maximum when it has one, else unknown, so it stays on offer for the user to give its value.
    if (!found.length && line.includes('피해량') && /\)\s*%|%\s*씩/.test(line) && !line.includes('피해량의') && !EFFECT_DAMAGE.test(line)) {
      const maximum = /최대\s*(\d+(?:\.\d+)?)\s*%/.exec(line)
      const taken = line.includes('받는')
      changes.push({ value: maximum ? (line.includes('감소') ? -1 : 1) * Number(maximum[1]) : null, taken, foe: taken && FOE.test(line) })
    }
  }
  return changes
}

const valuesOf = (changes: DamageChange[]) => [...new Set(changes.flatMap(change => change.value === null ? [] : [change.value]))]

/** The percents by which a text changes skill damage, signed, without repeats (a formula without a maximum has none). */
export const damageValues = (text: string) => valuesOf(damageChanges(text))

/** The ego_gifts columns the list is built from. */
export type GiftSourceRow = {
  game_id: number | null; name: string; name_en: string | null; name_jp: string | null
  grade: string | null; keyword: string | null; image_url: string | null
  effect_base: string | null; effect_plus: string | null; effect_plusplus: string | null
  effect_base_en: string | null; effect_plus_en: string | null; effect_plusplus_en: string | null
  effect_base_jp: string | null; effect_plus_jp: string | null; effect_plusplus_jp: string | null
}

export type DamageSources = {
  /** name: the Korean keyword name (the catalog key). */
  keywords: { name: string; label: string; text: string; values: number[]; stack: StackEffect | null; side: Side }[]
  /** stages: one per enhancement level the gift has (0 base, 1 +, 2 ++). */
  gifts: { id: string; name: string; label: string; grade: string | null; keyword: string | null; image_url: string | null; stages: { level: number; text: string; values: number[] }[] }[]
}

const inLanguage = (lang: SupportedLang, ko: string, en?: string | null, ja?: string | null) => (lang === 'en' ? en : lang === 'ja' ? ja : null) || ko

/**
 * The keywords and gifts the calculator offers: those whose text changes skill damage. Values always come from the
 * Korean text (damageChanges); names and texts are shown in `lang`, Korean where a translation is missing.
 * - Stack keywords come first. Any other keyword is on the side of what it changes: damage it deals on the attacker's,
 *   damage it takes on the target's, and on both, each with its own values, when it changes both.
 * - A gift counts what the attacker deals and what the enemy takes, not what allies take.
 */
export function buildDamageSources(
  keywords: Record<string, Pick<KeywordInfo, 'desc' | 'nameEn' | 'nameJp' | 'descEn' | 'descJp'>>,
  gifts: readonly GiftSourceRow[],
  lang: SupportedLang,
): DamageSources {
  const stackRows: (DamageSources['keywords'][number] & { rank: number })[] = []
  const keywordRows: DamageSources['keywords'] = []
  for (const [name, info] of Object.entries(keywords)) {
    const row = { name, label: inLanguage(lang, name, info.nameEn, info.nameJp), text: inLanguage(lang, info.desc, info.descEn, info.descJp) }
    const stack = readStack(info.desc)
    // a stack keyword is offered as its stacks only; were a text to hold the sentence and another damage percent, that percent would go unread. No keyword does (2026-10-05); offer both rows if one appears.
    if (stack) { stackRows.push({ ...row, values: [], stack: stack.effect, side: stack.effect.side, rank: stack.rank }); continue }
    const changes = damageChanges(info.desc)
    for (const side of ['self', 'target'] as const) {
      const own = changes.filter(change => change.taken === (side === 'target'))
      if (own.length) keywordRows.push({ ...row, values: valuesOf(own), stack: null, side })
    }
  }
  const giftRows: DamageSources['gifts'] = []
  for (const gift of gifts) {
    const texts = [
      [gift.effect_base, gift.effect_base_en, gift.effect_base_jp],
      [gift.effect_plus, gift.effect_plus_en, gift.effect_plus_jp],
      [gift.effect_plusplus, gift.effect_plusplus_en, gift.effect_plusplus_jp],
    ]
    const stages = texts.flatMap(([ko, en, ja], level) => {
      if (!ko) return []
      const changes = damageChanges(ko).filter(change => !change.taken || change.foe)
      return [{ level, text: inLanguage(lang, ko, en, ja), values: valuesOf(changes), changes: changes.length }]
    })
    if (!stages.some(stage => stage.changes)) continue
    giftRows.push({
      id: String(gift.game_id ?? gift.name), name: gift.name, label: inLanguage(lang, gift.name, gift.name_en, gift.name_jp),
      grade: gift.grade, keyword: gift.keyword, image_url: gift.image_url,
      stages: stages.map(({ level, text, values }) => ({ level, text, values })),
    })
  }
  return { keywords: [...stackRows.sort((a, b) => a.rank - b.rank).map(({ rank: _, ...row }) => row), ...keywordRows], gifts: giftRows }
}

type NewModifier = Omit<SavedModifier, 'id'>

/** A keyword of the list as a modifier: a stack keyword starts at one stack (and its effect knows its own side), any other at the first value its text offers (0 when it offers none). */
export function keywordModifier({ name, label, values, stack, side }: Omit<DamageSources['keywords'][number], 'text'>): NewModifier {
  return stack
    ? { name: label, keyword: name, stacks: 1, value: stack.perStack, target: stack.target, side: stack.side }
    : { name: label, keyword: name, value: values[0] ?? 0, options: values.slice(0, MAX_MODIFIER_OPTIONS), target: 'damage', side }
}

export type DamageSuggestion = { key: string; kind: 'keyword' | 'gift'; label: string; modifier: NewModifier; /** A stack keyword's effect per stack. */ perStack?: number }

export type SourceGroup = Side | 'gift'

/** What a candidate of a picker already stands for among the applied modifiers: the same gift, or the same keyword on the same side. */
export const findApplied = <T extends NewModifier>(modifiers: readonly T[], { gift, keyword, side }: NewModifier): T | undefined =>
  modifiers.find(other => gift ? other.gift?.id === gift.id : !!keyword && !other.gift && other.keyword === keyword && (other.side ?? 'self') === (side ?? 'self'))

/**
 * What a typed name may mean: keywords and gifts whose shown name contains it, names that start with it first. A gift
 * is offered once, at its first level: its enhancement level is switched where the gift is edited.
 * With a `group`, only that group is searched, and before a name is typed all of it is offered.
 */
export function suggestDamageSources(sources: DamageSources, query: string, { group, limit = group ? Infinity : 8 }: { group?: SourceGroup; limit?: number } = {}): DamageSuggestion[] {
  const needle = query.trim().toLocaleLowerCase()
  if (!needle && !group) return []
  const rows: DamageSuggestion[] = []
  for (const keyword of group === 'gift' ? [] : sources.keywords) {
    if (group && keyword.side !== group) continue
    rows.push({ key: `k:${keyword.name}:${keyword.side}`, kind: 'keyword', label: keyword.label, modifier: keywordModifier(keyword), ...(keyword.stack ? { perStack: keyword.stack.perStack } : {}) })
  }
  for (const gift of group && group !== 'gift' ? [] : sources.gifts) {
    const [stage] = gift.stages
    const values = stage.values.slice(0, MAX_MODIFIER_OPTIONS)
    rows.push({ key: `g:${gift.id}`, kind: 'gift', label: gift.label, modifier: {
      name: gift.label, value: values[0] ?? 0, options: values, target: 'damage',
      gift: { id: gift.id, level: stage.level, image_url: gift.image_url, grade: gift.grade, keyword: gift.keyword },
    } })
  }
  if (!needle) return rows.slice(0, limit)
  const position = (row: DamageSuggestion) => row.label.toLocaleLowerCase().indexOf(needle)
  // sort is stable: within "starts with" and within "contains", keywords stay ahead of gifts in list order.
  return rows.filter(row => position(row) >= 0).sort((a, b) => Math.min(position(a), 1) - Math.min(position(b), 1)).slice(0, limit)
}

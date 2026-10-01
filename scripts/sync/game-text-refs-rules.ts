import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { richestEntry } from './mirror-dungeon-rules'

/**
 * limbus.game_text_refs: what a `[Id]` in raw game text stands for. BattleKeywords entries are keywords/statuses
 * ({id, name, desc}), SkillTag entries are condition labels ({id, name:"[적중시]"}). Names and descriptions are stored as
 * the game wrote them (Unity tags, `{n}` slots), so the site can draw them itself.
 */
export type GameTextLang = 'kr' | 'en' | 'jp'
export type GameTextEntry = { id: string; name?: string; desc?: string; flavor?: string }
export type PerLang<T> = Record<GameTextLang, T>
export type GameTextSources = { keywords: PerLang<GameTextEntry[]>; skillTags: PerLang<GameTextEntry[]> }
export type GameTextRefInput = GameTextSources & { keywordMetaNames: readonly string[] }

export type GameTextRefRow = {
  id: string
  kind: 'keyword' | 'skilltag'
  name: string | null
  name_en: string | null
  name_jp: string | null
  description: string | null
  description_en: string | null
  description_jp: string | null
  /** The keyword's flavor line (brown italic under the description in the game tooltip); keywords only. */
  flavor: string | null
  flavor_en: string | null
  flavor_jp: string | null
  keyword_name: string | null
}

const LANGS: readonly GameTextLang[] = ['kr', 'en', 'jp']
const FOLDER: Record<GameTextLang, string> = { kr: 'KR', en: 'EN', jp: 'JP' }

/** Files of one family in a language folder, the base file (`KR_SkillTag.txt`) first, the rest by name. */
function familyFiles(dir: string, lang: GameTextLang, family: 'BattleKeywords' | 'SkillTag'): string[] {
  const prefix = `${FOLDER[lang]}_${family}`
  return readdirSync(dir)
    .filter(file => file.startsWith(prefix) && file.endsWith('.txt'))
    .sort((a, b) => (a === `${prefix}.txt` ? -1 : b === `${prefix}.txt` ? 1 : a.localeCompare(b)))
}

function readEntries(path: string): GameTextEntry[] {
  let parsed: unknown
  try {
    parsed = JSON.parse(readFileSync(path, 'utf8').replace(/^﻿/, ''))
  } catch (err) {
    throw new Error(`${path}: ${(err as Error).message}`)
  }
  const list = (parsed as { dataList?: unknown } | null)?.dataList
  if (!Array.isArray(list)) throw new Error(`${path}: no dataList`)
  const entries: GameTextEntry[] = []
  for (const item of list) {
    if (!item || typeof item !== 'object') continue
    const { id, name, desc, flavor } = item as Record<string, unknown>
    if (typeof id !== 'string' || !id) continue
    entries.push({
      id,
      ...(typeof name === 'string' ? { name } : {}),
      ...(typeof desc === 'string' ? { desc } : {}),
      ...(typeof flavor === 'string' ? { flavor } : {}),
    })
  }
  return entries
}

/** Every `{LANG}_BattleKeywords*.txt` and `{LANG}_SkillTag*.txt` under `<dataDir>/{KR,EN,JP}/`, entries in file order. */
export function readGameTextSources(dataDir: string): GameTextSources {
  const keywords = { kr: [], en: [], jp: [] } as PerLang<GameTextEntry[]>
  const skillTags = { kr: [], en: [], jp: [] } as PerLang<GameTextEntry[]>
  for (const lang of LANGS) {
    const dir = join(dataDir, FOLDER[lang])
    for (const file of familyFiles(dir, lang, 'BattleKeywords')) keywords[lang].push(...readEntries(join(dir, file)))
    for (const file of familyFiles(dir, lang, 'SkillTag')) skillTags[lang].push(...readEntries(join(dir, file)))
  }
  return { keywords, skillTags }
}

const orNull = (value: string | undefined) => (value === undefined || value === '' ? null : value)

/** The `keyword_meta` name that stands for a KR name: equal after trimming, else equal with all whitespace removed. */
function matchKeywordMeta(krName: string | null, metaNames: readonly string[]): string | null {
  if (!krName) return null
  const exact = krName.trim()
  if (!exact) return null
  const direct = metaNames.find(name => name.trim() === exact)
  if (direct !== undefined) return direct
  const squash = (text: string) => text.replace(/\s+/g, '')
  const key = squash(exact)
  return metaNames.find(name => squash(name) === key) ?? null
}

/**
 * Rows of limbus.game_text_refs, sorted by id. An id in the SkillTag files is a 'skilltag' (also when a BattleKeywords
 * file has it); the rest are 'keyword'. Per id and language the richest entry of the files is kept (name/desc only are
 * scored, so an extra `flavor` field does not decide; the flavor is the richest entry's, else the first file's that has one). Names lose trailing whitespace (the KR "공격 레벨 감소 " has one),
 * descriptions stay verbatim. keyword_name is only set for keywords.
 */
export function buildGameTextRefs(input: GameTextRefInput): GameTextRefRow[] {
  const group = (lists: PerLang<GameTextEntry[]>) => {
    const byId = new Map<string, PerLang<GameTextEntry[]>>()
    for (const lang of LANGS) {
      for (const entry of lists[lang]) {
        const slot = byId.get(entry.id) ?? byId.set(entry.id, { kr: [], en: [], jp: [] }).get(entry.id)!
        slot[lang].push(entry)
      }
    }
    return byId
  }
  const tags = group(input.skillTags)
  const keywords = group(input.keywords)
  const rows: GameTextRefRow[] = []
  const rowOf = (id: string, kind: GameTextRefRow['kind'], slot: PerLang<GameTextEntry[]>): GameTextRefRow => {
    const best = Object.fromEntries(LANGS.map(lang => [lang, richestEntry(slot[lang])])) as PerLang<GameTextEntry | undefined>
    const name = (lang: GameTextLang) => orNull(best[lang]?.name?.trimEnd())
    const desc = (lang: GameTextLang) => (kind === 'keyword' ? orNull(best[lang]?.desc) : null)
    const flavor = (lang: GameTextLang) =>
      (kind === 'keyword' ? orNull(best[lang]?.flavor || slot[lang].find(entry => entry.flavor)?.flavor) : null)
    return {
      id,
      kind,
      name: name('kr'),
      name_en: name('en'),
      name_jp: name('jp'),
      description: desc('kr'),
      description_en: desc('en'),
      description_jp: desc('jp'),
      flavor: flavor('kr'),
      flavor_en: flavor('en'),
      flavor_jp: flavor('jp'),
      keyword_name: kind === 'keyword' ? matchKeywordMeta(name('kr'), input.keywordMetaNames) : null,
    }
  }
  for (const [id, slot] of tags) rows.push(rowOf(id, 'skilltag', slot))
  for (const [id, slot] of keywords) if (!tags.has(id)) rows.push(rowOf(id, 'keyword', slot))
  return rows.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
}

const COLUMNS = ['kind', 'name', 'name_en', 'name_jp', 'description', 'description_en', 'description_jp', 'flavor', 'flavor_en', 'flavor_jp', 'keyword_name'] as const

/** Built rows against the stored ones (matched by id; extra stored columns such as updated_at are ignored). */
export function diffGameTextRefs(stored: readonly GameTextRefRow[], next: readonly GameTextRefRow[]) {
  const byId = new Map(stored.map(row => [row.id, row]))
  const created: GameTextRefRow[] = []
  const changed: GameTextRefRow[] = []
  const unchanged: GameTextRefRow[] = []
  for (const row of next) {
    const old = byId.get(row.id)
    if (!old) created.push(row)
    else if (COLUMNS.some(column => (old[column] ?? null) !== row[column])) changed.push(row)
    else unchanged.push(row)
  }
  return { created, changed, unchanged }
}

// ── keyword_meta.game_id: the primary reference of a curated keyword ───────────────────────────────────────────────────

/** Why a reference became the primary one: the keyword's own tag, the only same-name keyword reference, the most used of several. */
export type PrimaryRefReason = 'tag' | 'only' | 'most-used'
export type PrimaryRefPlan = {
  chosen: Map<string, { id: string; reason: PrimaryRefReason }>
  /** Several same-name references with equally many uses (also none at all): left unset, the candidates sorted. */
  ambiguous: Map<string, string[]>
  /** Names no keyword reference carries. */
  none: string[]
  /** Names whose tag-chosen reference has another KR name (informational: the tag still wins). */
  tagNameDiffers: string[]
}

/**
 * The reference each keyword_meta name displays its texts from, decided without guessing and independent of input order:
 * 1. the tag the keywords step resolved for the name (the keyword's own buff tag), when it is a keyword reference;
 * 2. else the single keyword reference whose keyword_name is the name;
 * 3. else, among several, the one used most in skill, passive and gift texts (`usage`), when strictly more than the next;
 * a tie is ambiguous and a name without any reference is none: both stay unset (the site then keeps the keyword_meta texts).
 */
export function selectPrimaryRefs(input: {
  refs: readonly Pick<GameTextRefRow, 'id' | 'kind' | 'keyword_name'>[]
  metaNames: readonly string[]
  tags?: ReadonlyMap<string, string>
  usage?: ReadonlyMap<string, number>
}): PrimaryRefPlan {
  const keywordIds = new Set(input.refs.filter(ref => ref.kind === 'keyword').map(ref => ref.id))
  const byName = new Map<string, string[]>()
  const keywordNameById = new Map(input.refs.filter(ref => ref.kind === 'keyword').map(ref => [ref.id, ref.keyword_name] as const))
  for (const ref of input.refs) {
    if (ref.kind !== 'keyword' || !ref.keyword_name) continue
    byName.set(ref.keyword_name, [...(byName.get(ref.keyword_name) ?? []), ref.id])
  }
  const plan: PrimaryRefPlan = { chosen: new Map(), ambiguous: new Map(), none: [], tagNameDiffers: [] }
  for (const name of [...new Set(input.metaNames)].sort()) {
    const tag = input.tags?.get(name)
    if (tag && keywordIds.has(tag)) {
      plan.chosen.set(name, { id: tag, reason: 'tag' })
      if (keywordNameById.get(tag) !== name) plan.tagNameDiffers.push(name)
      continue
    }
    const candidates = [...(byName.get(name) ?? [])].sort()
    if (!candidates.length) plan.none.push(name)
    else if (candidates.length === 1) plan.chosen.set(name, { id: candidates[0], reason: 'only' })
    else {
      const used = candidates.map(id => ({ id, uses: input.usage?.get(id) ?? 0 })).sort((a, b) => b.uses - a.uses || (a.id < b.id ? -1 : 1))
      if (used[0].uses > used[1].uses) plan.chosen.set(name, { id: used[0].id, reason: 'most-used' })
      else plan.ambiguous.set(name, candidates)
    }
  }
  return plan
}

/** The id to store: a found one wins, else the stored one stays (a hand-set id survives a name the rules cannot decide). */
export function keepOrSetGameId(stored: string | null | undefined, found: string | null | undefined): string | null {
  return found ?? stored ?? null
}

const BRACKET_ID = /\[([A-Za-z0-9_]+)\]/g

/** Number of `[Id]` occurrences per id (only the `ids` given) over raw texts, wherever they stand (inside Unity tags too). */
export function countRefUsage(texts: Iterable<string>, ids: ReadonlySet<string>): Map<string, number> {
  const usage = new Map<string, number>()
  for (const text of texts) {
    for (const match of text.matchAll(BRACKET_ID)) {
      if (ids.has(match[1])) usage.set(match[1], (usage.get(match[1]) ?? 0) + 1)
    }
  }
  return usage
}

/** KR files with the skill, passive and gift texts players read: not enemy, abnormality, assist or tutorial ones. */
const USAGE_FILE = /^KR_(Skills|Passive|Passives|EGOgift)\w*[-.\w]*\.txt$/
const USAGE_SKIP = /Enemy|Abnormality|Assist|Tutorial/i

/** `[Id]` uses in the extraction's personality/E.G.O skill, passive and gift texts (`<dataDir>/KR`). */
export function readRefUsage(dataDir: string, ids: ReadonlySet<string>): Map<string, number> {
  const dir = join(dataDir, FOLDER.kr)
  const texts = readdirSync(dir)
    .filter(file => USAGE_FILE.test(file) && !USAGE_SKIP.test(file))
    .sort()
    .map(file => readFileSync(join(dir, file), 'utf8'))
  return countRefUsage(texts, ids)
}

/**
 * The plan from the extraction: the references the sync stores, the same-name links, the usage. `metaNames` are all
 * keyword_meta names (they decide keyword_name like the references sync does), `names` the ones to plan for (default: all).
 */
export function planKeywordGameIds(input: {
  dataDir: string
  metaNames: readonly string[]
  names?: readonly string[]
  /** keyword_meta name → the tag the keywords step resolved for it. */
  tags?: ReadonlyMap<string, string>
}): PrimaryRefPlan & { refs: GameTextRefRow[] } {
  const refs = buildGameTextRefs({ ...readGameTextSources(input.dataDir), keywordMetaNames: input.metaNames })
  const usage = readRefUsage(input.dataDir, new Set(refs.filter(ref => ref.kind === 'keyword').map(ref => ref.id)))
  return { ...selectPrimaryRefs({ refs, metaNames: input.names ?? input.metaNames, tags: input.tags, usage }), refs }
}

export type GameIdReport = {
  /** Names with a primary reference (byTag + only + mostUsed). */
  set: number
  byTag: number
  only: number
  mostUsed: number
  ambiguous: number
  none: number
  /** Chosen ids that game_text_refs does not hold yet (refs step not run), so they cannot be written. */
  refNotInDb: number
  /** keyword_meta has no game_id column yet (migration not applied): the plan is computed and reported, nothing is written. */
  columnMissing: boolean
}

/**
 * What to store per name: the chosen reference when game_text_refs already holds it (the foreign key needs the row), else the
 * id already stored. `stored` is null when the column does not exist, `dbRefIds` null when game_text_refs does not.
 */
export function resolveKeywordGameIds(input: {
  plan: PrimaryRefPlan
  names: readonly string[]
  stored: ReadonlyMap<string, string | null> | null
  dbRefIds: ReadonlySet<string> | null
}): { ids: Map<string, string | null>; report: GameIdReport } {
  const ids = new Map<string, string | null>()
  let refNotInDb = 0
  for (const name of input.names) {
    const found = input.plan.chosen.get(name)?.id
    const writable = found && input.dbRefIds?.has(found) ? found : null
    if (found && !writable) refNotInDb++
    ids.set(name, keepOrSetGameId(input.stored?.get(name), writable))
  }
  const reasons = [...input.plan.chosen.values()].map(chosen => chosen.reason)
  const count = (reason: PrimaryRefReason) => reasons.filter(r => r === reason).length
  return {
    ids,
    report: {
      set: reasons.length, byTag: count('tag'), only: count('only'), mostUsed: count('most-used'),
      ambiguous: input.plan.ambiguous.size, none: input.plan.none.length, refNotInDb, columnMissing: input.stored === null,
    },
  }
}

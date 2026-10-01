import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { richestEntry } from './mirror-dungeon-rules'

/**
 * limbus.game_text_refs: what a `[Id]` in raw game text stands for. BattleKeywords entries are keywords/statuses
 * ({id, name, desc}), SkillTag entries are condition labels ({id, name:"[적중시]"}). Names and descriptions are stored as
 * the game wrote them (Unity tags, `{n}` slots), so the site can draw them itself.
 */
export type GameTextLang = 'kr' | 'en' | 'jp'
export type GameTextEntry = { id: string; name?: string; desc?: string }
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
    const { id, name, desc } = item as Record<string, unknown>
    if (typeof id !== 'string' || !id) continue
    entries.push({
      id,
      ...(typeof name === 'string' ? { name } : {}),
      ...(typeof desc === 'string' ? { desc } : {}),
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
 * scored, so an extra `flavor` field does not decide). Names lose trailing whitespace (the KR "공격 레벨 감소 " has one),
 * descriptions stay verbatim. keyword_name is only set for keywords.
 */
export function buildGameTextRefs(input: GameTextRefInput): GameTextRefRow[] {
  const group = (lists: PerLang<GameTextEntry[]>) => {
    const byId = new Map<string, PerLang<GameTextEntry[]>>()
    for (const lang of LANGS) {
      for (const entry of lists[lang]) {
        const slot = byId.get(entry.id) ?? byId.set(entry.id, { kr: [], en: [], jp: [] }).get(entry.id)!
        slot[lang].push({ id: entry.id, name: entry.name, desc: entry.desc })
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
    return {
      id,
      kind,
      name: name('kr'),
      name_en: name('en'),
      name_jp: name('jp'),
      description: desc('kr'),
      description_en: desc('en'),
      description_jp: desc('jp'),
      keyword_name: kind === 'keyword' ? matchKeywordMeta(name('kr'), input.keywordMetaNames) : null,
    }
  }
  for (const [id, slot] of tags) rows.push(rowOf(id, 'skilltag', slot))
  for (const [id, slot] of keywords) if (!tags.has(id)) rows.push(rowOf(id, 'keyword', slot))
  return rows.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
}

const COLUMNS = ['kind', 'name', 'name_en', 'name_jp', 'description', 'description_en', 'description_jp', 'keyword_name'] as const

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

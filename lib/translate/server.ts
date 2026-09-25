import { createHash } from 'node:crypto'
import { generateText } from 'ai'
import { createAdminClient } from '@/lib/supabase/admin'
import { AFFILIATION_MAP } from '@/lib/i18n/localize'
import { textLanguage, uniqueSegments, type TranslateLang } from './segments'

export type PostKind = 'deck' | 'plan'
export type TranslationPairs = [string, string][]

// Cheap, fast model through Vercel AI Gateway (OIDC on Vercel, AI_GATEWAY_API_KEY locally).
const MODEL = 'google/gemini-2.5-flash-lite'
// Bump when the prompt or glossary changes so stored translations are made again.
const TRANSLATION_VERSION = 2
const MAX_CHARS = 30_000
const LANGS: TranslateLang[] = ['ko', 'en', 'ja']
const LANG_NAME: Record<TranslateLang, string> = { ko: 'Korean', en: 'English', ja: 'Japanese' }
const NAME_COLUMN: Record<TranslateLang, 'name' | 'name_en' | 'name_jp'> = { ko: 'name', en: 'name_en', ja: 'name_jp' }

export const translationAvailable = () => Boolean(process.env.AI_GATEWAY_API_KEY || process.env.VERCEL)

const db = () => createAdminClient().schema('limbus')

/** The post's own texts: title, notes and (plans) floor memos. */
export async function postTexts(kind: PostKind, id: string): Promise<(string | null)[] | null> {
  if (kind === 'deck') {
    const { data } = await db().from('decks').select('title, description').eq('id', id).maybeSingle()
    return data ? [data.title, data.description] : null
  }
  const { data } = await db().from('md_plans').select('title, description, floor_plan').eq('id', id).maybeSingle()
  if (!data) return null
  const memos = Array.isArray(data.floor_plan) ? data.floor_plan.map((floor: { memo?: unknown }) => typeof floor?.memo === 'string' ? floor.memo : null) : []
  return [data.title, data.description, ...memos]
}

const hashOf = (segments: string[]) => createHash('sha256').update(JSON.stringify([TRANSLATION_VERSION, segments])).digest('hex')

type NameRow = Record<string, string | null>

/** Every row of a name table (PostgREST returns at most 1000 per request). */
async function allNames(table: string, columns: string): Promise<NameRow[]> {
  const rows: NameRow[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db().from(table).select(columns).range(from, from + 999)
    if (error || !data?.length) break
    rows.push(...(data as unknown as NameRow[]))
    if (data.length < 1000) break
  }
  return rows
}

/**
 * Game names that appear in the text, with the official name in the target language: status keywords (화상 → Burn),
 * Sinners, affiliations (중지 → The Middle), E.G.O Gifts, Theme Packs, Identities and E.G.O. Given to the model so
 * proper nouns come out as in the game instead of word by word.
 */
async function glossary(segments: string[], source: TranslateLang, target: TranslateLang) {
  const text = segments.join('\n')
  const [keywords, sinners, gifts, themes, identities, egos] = await Promise.all([
    allNames('keyword_meta', 'name, name_en, name_jp'),
    allNames('sinners', 'name_kr, name_en, name_jp'),
    allNames('ego_gifts', 'name, name_en, name_jp'),
    allNames('ego_gift_themes', 'name, name_en, name_jp'),
    allNames('identities', 'name_kr, name_en, name_jp'),
    allNames('ego', 'name_kr, name_en, name_jp'),
  ])
  const byName = (row: NameRow) => ({ ko: row.name, en: row.name_en, ja: row.name_jp })
  const byKr = (row: NameRow) => ({ ko: row.name_kr, en: row.name_en, ja: row.name_jp })
  const rows: Record<TranslateLang, string | null>[] = [
    ...keywords.map(byName), ...sinners.map(byKr), ...gifts.map(byName), ...themes.map(byName), ...identities.map(byKr), ...egos.map(byKr),
    ...Object.entries(AFFILIATION_MAP).map(([ko, names]) => ({ ko, en: names.en, ja: names.ja })),
  ]
  const pairs = new Map<string, string>()
  for (const row of rows) {
    const from = row[source]?.trim(), to = row[target]?.trim()
    if (from && to && from !== to && from.length >= 2 && text.includes(from)) pairs.set(from, to)
  }
  // Longest first, so "새벽 사무소 해결사" wins over "새벽 사무소".
  return [...pairs].sort((a, b) => b[0].length - a[0].length).slice(0, 400)
}

async function translateSegments(segments: string[], source: TranslateLang, target: TranslateLang) {
  const terms = await glossary(segments, source, target)
  const { text } = await generateText({
    model: MODEL,
    temperature: 0,
    system: [
      `You translate player-written notes about the game Limbus Company from ${LANG_NAME[source]} into ${LANG_NAME[target]}.`,
      'Return ONLY a JSON array of strings, the same length and order as the input array.',
      'Keep Markdown, line breaks, emoji, numbers, URLs, and anything inside backticks, [[...]], [x:...] or {{...}} unchanged.',
      `Use the official ${LANG_NAME[target]} Limbus Company terminology (Sinner, Identity, E.G.O, E.G.O Gift, Theme Pack, Mirror Dungeon, Uptie, Sanity, Clash, Coin Power, Skill 1/2/3). Players use shorthand; translate it into the game's words.`,
      terms.length ? `Glossary (${LANG_NAME[source]} → ${LANG_NAME[target]}), always use these exact names:\n${terms.map(([from, to]) => `${from} → ${to}`).join('\n')}` : '',
      `Leave a string unchanged if it is already in ${LANG_NAME[target]}.`,
    ].filter(Boolean).join('\n'),
    prompt: JSON.stringify(segments),
  })
  const parsed: unknown = JSON.parse(text.replace(/^\s*\u0060{3}(?:json)?|\u0060{3}\s*$/g, ''))
  if (!Array.isArray(parsed) || parsed.length !== segments.length || parsed.some(item => typeof item !== 'string')) throw new Error('bad translation shape')
  return segments.map((segment, index) => [segment, parsed[index] as string] as [string, string])
}

/**
 * Translates a post into the site languages other than its own and stores the results (post_translations).
 * Unchanged posts are skipped by hash, so calling this after every save is cheap. Errors are logged, not thrown.
 */
export async function translatePost(kind: PostKind, id: string, only?: TranslateLang): Promise<TranslationPairs | null> {
  if (!translationAvailable()) return null
  try {
    const texts = await postTexts(kind, id)
    if (!texts) return null
    const segments = uniqueSegments(texts)
    const source = textLanguage(segments.join('\n'))
    if (!segments.length || !source || segments.reduce((sum, s) => sum + s.length, 0) > MAX_CHARS) return null
    const hash = hashOf(segments)
    // Every other site language is made at once; `only` just picks which one to return.
    const targets = LANGS.filter(lang => lang !== source)
    const { data: existing } = await db().from('post_translations').select('lang, source_hash, pairs').eq('kind', kind).eq('post_id', id)
    let result: TranslationPairs | null = null
    for (const lang of targets) {
      const row = existing?.find(item => item.lang === lang)
      let pairs = row?.source_hash === hash ? row.pairs as TranslationPairs : null
      if (!pairs) {
        pairs = await translateSegments(segments, source, lang)
        await db().from('post_translations').upsert({ kind, post_id: id, lang, source_hash: hash, pairs, created_at: new Date().toISOString() })
      }
      if (lang === only) result = pairs
    }
    return result
  } catch (error) {
    console.error('[translatePost]', kind, id, error instanceof Error ? error.message : error)
    return null
  }
}

/** Stored translation of a post for one language (possibly from an older version; unchanged pieces still apply). */
export async function storedTranslation(kind: PostKind, id: string, lang: string): Promise<TranslationPairs | null> {
  const { data } = await db().from('post_translations').select('pairs').eq('kind', kind).eq('post_id', id).eq('lang', lang).maybeSingle()
  return (data?.pairs as TranslationPairs | undefined) ?? null
}

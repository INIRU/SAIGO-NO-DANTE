import { createHash } from 'node:crypto'
import { generateText } from 'ai'
import { createAdminClient } from '@/lib/supabase/admin'
import { textLanguage, uniqueSegments, type TranslateLang } from './segments'

export type PostKind = 'deck' | 'plan'
export type TranslationPairs = [string, string][]

// Cheap, fast model through Vercel AI Gateway (OIDC on Vercel, AI_GATEWAY_API_KEY locally).
const MODEL = 'google/gemini-2.5-flash-lite'
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

const hashOf = (segments: string[]) => createHash('sha256').update(JSON.stringify(segments)).digest('hex')

async function keywordNames() {
  const rows: { name: string; name_en: string | null; name_jp: string | null }[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db().from('keyword_meta').select('name, name_en, name_jp').range(from, from + 999)
    if (error || !data?.length) break
    rows.push(...data)
    if (data.length < 1000) break
  }
  return rows
}

/**
 * Game terms that appear in the text, with the official name in the target language: status keywords (화상 → Burn)
 * and Sinners. Given to the model so players' shorthand is translated with the game's own words.
 */
async function glossary(segments: string[], source: TranslateLang, target: TranslateLang) {
  const text = segments.join('\n')
  const [keywords, sinners] = await Promise.all([
    keywordNames(),
    db().from('sinners').select('name_kr, name_en, name_jp'),
  ])
  const rows = [
    ...keywords.map(row => ({ ko: row.name, en: row.name_en, ja: row.name_jp })),
    ...(sinners.data ?? []).map(row => ({ ko: row.name_kr, en: row.name_en, ja: row.name_jp })),
  ] as Record<TranslateLang, string | null>[]
  const pairs = new Map<string, string>()
  for (const row of rows) {
    const from = row[source]?.trim(), to = row[target]?.trim()
    if (from && to && from !== to && from.length >= 2 && text.includes(from)) pairs.set(from, to)
  }
  return [...pairs].slice(0, 300)
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
    const targets = LANGS.filter(lang => lang !== source && (!only || lang === only))
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

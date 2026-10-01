import { NextResponse } from 'next/server'
import { cacheLife, cacheTag } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { CACHE_TAGS } from '@/lib/constants/cache-tags'
import { getGameTextRefNames } from '@/lib/db/game-text-refs'
import { gameTextForScreen, refNameLabels } from '@/lib/game-text/rich-text'

const SUFFIX = { ko: '', en: '_en', ja: '_jp' } as const
type Lang = keyof typeof SUFFIX

/**
 * The long texts Assist reads on screen (gift effects, event passages, choice and result lines) in one game language.
 * The run page sends only the site language's; a player whose game client uses another language loads it from here.
 */
async function texts(lang: Lang) {
  'use cache'
  cacheLife('max')
  cacheTag(CACHE_TAGS.mirrorDungeon, CACHE_TAGS.gameData, CACHE_TAGS.gameTextRefs)
  const s = SUFFIX[lang]
  const db = createAdminClient().schema('limbus')
  // Gift effects are game text with [Id]s; the screen shows their names, so the client gets the text with those names.
  // Without the reference table (not loaded yet) the ids stay as written.
  const labels = await getGameTextRefNames(lang).then(refNameLabels, () => undefined)
  const [gifts, events, choices] = await Promise.all([
    db.from('ego_gifts').select(`game_id, effect_base${s}, effect_plus${s}, effect_plusplus${s}`),
    db.from('md_events').select(`id, desc_text${s}`),
    db.from('md_event_choices').select(`id, message${s}, result_text${s}`),
  ])
  if (gifts.error || events.error || choices.error) throw Error('Assist texts unavailable')
  const pick = (row: Record<string, unknown>, fields: string[]) => fields.map(field => row[field + s]).filter((value): value is string => typeof value === 'string' && value.length > 0)
  const rows = <T,>(data: unknown) => data as unknown as (T & Record<string, unknown>)[]
  return {
    gifts: rows<{ game_id: number }>(gifts.data).map(row => ({ id: String(row.game_id), texts: pick(row, ['effect_base', 'effect_plus', 'effect_plusplus']).map(text => gameTextForScreen(text, labels)) })),
    events: rows<{ id: number }>(events.data).map(row => ({ id: String(row.id), texts: pick(row, ['desc_text']) })),
    choices: rows<{ id: number }>(choices.data).map(row => ({ id: String(row.id), texts: pick(row, ['message']), resultTexts: pick(row, ['result_text']) })),
  }
}

export async function GET(_request: Request, { params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params
  if (!(lang in SUFFIX)) return NextResponse.json({ error: 'Unknown language' }, { status: 404 })
  try {
    return NextResponse.json(await texts(lang as Lang), { headers: { 'Cache-Control': 'public, max-age=3600, s-maxage=86400' } })
  } catch {
    return NextResponse.json({ error: 'Unavailable' }, { status: 503 })
  }
}

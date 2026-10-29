import { NextResponse } from 'next/server'
import { cacheLife, cacheTag } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { CACHE_TAGS } from '@/lib/constants/cache-tags'
import { CATALOG_CACHE_CONTROL } from '@/lib/constants/http-cache'
import { routing } from '@/lib/i18n/routing'
import type { SupportedLang } from '@/lib/i18n/types'
import { isMissingColumnError } from '@/lib/keywords/ref-text'
import { readAllRows } from '@/lib/meta/pagination'

type SkillRow = {
  identity_id: string; name: string; name_en: string | null; name_jp: string | null; skill_type: string | null
  coins: number | null; base_power: number | null; coin_power: number | null; coin_list?: { scale: number; operator: string }[] | null
  skill_order: number | null; variant_order: number | null; uptie_level: number | null
}
type IdentityRow = { id: string; sinner_id: string | null; name_kr: string | null; name_en: string | null; name_jp: string | null }

const SKILL_COLUMNS = 'identity_id, name, name_en, name_jp, skill_type, coins, base_power, coin_power, skill_order, variant_order, uptie_level'
const inLanguage = (lang: SupportedLang, ko: string, en?: string | null, ja?: string | null) => (lang === 'en' ? en : lang === 'ja' ? ja : null) || ko

/** Every identity with its skills at the highest uptie level (sync level 4), the coins as the clash calculator reads them. */
async function getClashSkills(lang: SupportedLang) {
  'use cache'
  cacheLife('max')
  cacheTag(CACHE_TAGS.identities, CACHE_TAGS.gameData)

  const db = createAdminClient().schema('limbus')
  const readSkills = (columns: string) => readAllRows<SkillRow>((from, to) => db.from('skills').select(columns).order('id').range(from, to) as never)
  // coin_list is a newer column: until its migration is applied a skill's coins are its count times the one coin power.
  let skills = await readSkills(`${SKILL_COLUMNS}, coin_list`)
  if (skills.error && isMissingColumnError(skills.error)) skills = await readSkills(SKILL_COLUMNS)
  const identities = await db.from('identities').select('id, sinner_id, name_kr, name_en, name_jp').order('rarity', { ascending: false })
  // A failed read throws instead of caching an empty list.
  if (skills.error) throw new Error(skills.error.message)
  if (identities.error) throw new Error(identities.error.message)

  // The highest uptie level of every skill slot (and variant).
  const best = new Map<string, SkillRow>()
  for (const row of skills.data!) {
    const slot = `${row.identity_id}:${row.skill_order}:${row.variant_order ?? 0}`
    if ((best.get(slot)?.uptie_level ?? -1) < (row.uptie_level ?? 0)) best.set(slot, row)
  }
  const byIdentity = new Map<string, SkillRow[]>()
  for (const row of best.values()) byIdentity.set(row.identity_id, [...(byIdentity.get(row.identity_id) ?? []), row])
  return (identities.data as IdentityRow[]).flatMap(identity => {
    const rows = (byIdentity.get(identity.id) ?? []).sort((a, b) => (a.skill_order ?? 0) - (b.skill_order ?? 0) || (a.variant_order ?? 0) - (b.variant_order ?? 0))
    if (!rows.length) return []
    return [{
      id: identity.id, sinner: identity.sinner_id, label: inLanguage(lang, identity.name_kr ?? '', identity.name_en, identity.name_jp),
      skills: rows.map(row => ({
        key: `${row.skill_order}:${row.variant_order ?? 0}`, label: inLanguage(lang, row.name, row.name_en, row.name_jp), type: row.skill_type,
        coins: row.coins ?? 0, base_power: row.base_power ?? 0, coin_power: row.coin_power ?? 0, coin_list: row.coin_list ?? null,
      })),
    }]
  })
}

/** The identities and their highest-level skills, for the clash calculator's pickers (loaded when it first opens). */
export async function GET(_request: Request, { params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params
  if (!(routing.locales as readonly string[]).includes(lang)) return NextResponse.json({ error: 'Unknown language' }, { status: 404 })
  try {
    return NextResponse.json({ identities: await getClashSkills(lang as SupportedLang) }, { headers: { 'Cache-Control': CATALOG_CACHE_CONTROL } })
  } catch {
    return NextResponse.json({ error: 'Unavailable' }, { status: 503 })
  }
}

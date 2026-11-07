import { NextRequest, NextResponse } from 'next/server'
import { cacheLife, cacheTag } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { CACHE_TAGS } from '@/lib/constants/cache-tags'
import { STORAGE_BASE } from '@/lib/constants/game'
import { gameTextToPlain, refNameLabels } from '@/lib/game-text/rich-text'
import { getGameTextRefNames } from '@/lib/db/game-text-refs'
import { resolveKeywordIconUrl } from '@/lib/keywords/catalog'
import { getIdentityImageUrl } from '@/lib/utils/images'
import { localizeGiftKeyword } from '@/lib/i18n/gift-keyword'
import { translations } from '@/lib/i18n/translations'
import { pageEntries } from '@/lib/search/pages'
import type { ContextField, IndexEntry } from '@/lib/search/engine'
import { SINNER_ALIASES } from '@/lib/search/sinner-aliases'

type Names = { name_kr?: string | null; name_en: string | null; name_jp: string | null; name?: string | null }
type Lang = 'ko' | 'en' | 'ja'

const ko = (row: Names) => row.name_kr ?? row.name ?? ''
const pick = (row: Names, lang: Lang) => (lang === 'en' ? row.name_en : lang === 'ja' ? row.name_jp : null) || ko(row)
const names = (row: Names) => ({ ko: ko(row), en: row.name_en, ja: row.name_jp })

// 표가 작아(수천 행) 한 번 읽어 두고, 검색은 브라우저에서 한다. 게임 데이터 동기화 때 태그로 갱신된다.
// 키워드 부제의 [Id]는 참조 표(한국어)로 이름을 얻는다. 표를 못 읽었거나 아직 비었으면 그 색인은 오래 두면 안 된다:
// 읽을 때 던져 캐시에 쓰이지 않게 하고, 호출하는 쪽(loadRows)이 [Id]를 그대로 둔 색인을 짧게만 캐시해 쓴다.
async function getRows(withRefs: boolean) {
  'use cache'
  if (withRefs) cacheLife('max')
  else cacheLife('page-1m')
  cacheTag(CACHE_TAGS.gameData, CACHE_TAGS.sinners, CACHE_TAGS.identities, CACHE_TAGS.ego, CACHE_TAGS.egoGifts, CACHE_TAGS.keywords, CACHE_TAGS.gameTextRefs)

  let labels: Record<string, string> | undefined
  if (withRefs) {
    const refs = await getGameTextRefNames('ko')
    if (Object.keys(refs).length === 0) throw new Error('game_text_refs is empty')
    labels = refNameLabels(refs)
  }
  const db = createAdminClient().schema('limbus')
  const [sinners, identities, ego, keywords, gifts, themes, events] = await Promise.all([
    db.from('sinners').select('id, name, name_kr, name_en, name_jp, order_num'),
    db.from('identities').select('id, name_kr, name_en, name_jp, rarity, game_id, folder_name, sinner_id'),
    db.from('ego').select('id, name_kr, name_en, name_jp, grade, image_url, sinner_id'),
    db.from('keyword_meta').select('name, name_en, name_jp, description, icon_slug'),
    db.from('ego_gifts').select('id, name, name_en, name_jp, keyword, grade, image_url'),
    db.from('ego_gift_themes').select('id, name, name_en, name_jp, image_url, difficulty'),
    db.from('md_events').select('id, name, name_en, name_jp, image_url').eq('category', 'entry'),
  ])
  const failed = [sinners, identities, ego, keywords, gifts, themes, events].find(r => r.error)
  if (failed?.error) throw new Error(failed.error.message)
  return {
    sinners: (sinners.data ?? []).sort((a, b) => a.order_num - b.order_num),
    identities: identities.data ?? [],
    ego: ego.data ?? [],
    keywords: (keywords.data ?? []).map(k => ({ ...k, description: k.description ? gameTextToPlain(k.description, { names: labels }).slice(0, 80) : null })),
    gifts: gifts.data ?? [],
    themes: themes.data ?? [],
    events: (events.data ?? []).filter(e => e.name),
  }
}

async function loadRows() {
  try {
    return await getRows(true)
  } catch (error) {
    console.error('Search index without game text names:', error)
    return getRows(false)
  }
}

const tierLabel = (difficulty: string | null, lang: Lang) => {
  const key = `mirrorDungeon.tier.${difficulty}` as keyof typeof translations
  return (translations[key] as Record<Lang, string> | undefined)?.[lang]
}

function buildEntries(rows: Awaited<ReturnType<typeof getRows>>, lang: Lang): IndexEntry[] {
  const sinnerById = new Map(rows.sinners.map(s => [s.id, s]))
  const keywordNames = new Map(rows.keywords.map(k => [k.name, k]))
  const giftKeyword = (keyword: string | null) => {
    if (!keyword) return []
    const meta = keywordNames.get(keyword)
    const texts = new Set([keyword, meta?.name_en ?? localizeGiftKeyword(keyword, 'en'), meta?.name_jp ?? localizeGiftKeyword(keyword, 'ja')])
    return [...texts].filter(Boolean).map(text => ({ field: 'keyword' as ContextField, text }))
  }

  return [
    ...rows.sinners.map((s): IndexEntry => ({
      type: 'sinner', label: pick(s, lang), names: names(s), href: `/sinners/${s.id}`,
      icon: `${STORAGE_BASE}/icons/Sinners/${s.id}.webp`,
      context: (SINNER_ALIASES[s.id] ?? []).map(text => ({ field: 'alias', text })),
    })),
    ...rows.identities.map((i): IndexEntry => ({
      type: 'identity', label: pick(i, lang), names: names(i), href: `/sinners/${i.sinner_id}/identities/${i.id}`,
      sublabel: sinnerById.has(i.sinner_id) ? pick(sinnerById.get(i.sinner_id)!, lang) : undefined,
      icon: getIdentityImageUrl(i.sinner_id, i.folder_name, `${i.game_id}_normal`), rarity: i.rarity, sinner: i.sinner_id,
    })),
    ...rows.ego.map((e): IndexEntry => ({
      type: 'ego', label: pick(e, lang), names: names(e), href: `/sinners/${e.sinner_id}/ego/${e.id}`,
      sublabel: sinnerById.has(e.sinner_id) ? pick(sinnerById.get(e.sinner_id)!, lang) : undefined,
      icon: e.image_url ?? undefined, grade: e.grade, sinner: e.sinner_id,
    })),
    ...rows.keywords.map((k): IndexEntry => ({
      type: 'keyword', label: pick(k, lang), names: names(k), href: `/keywords?keyword=${encodeURIComponent(k.name)}`,
      sublabel: lang === 'ko' ? k.description ?? undefined : undefined,
      icon: resolveKeywordIconUrl(k.name, k.icon_slug) ?? undefined,
    })),
    ...rows.gifts.map((g): IndexEntry => ({
      type: 'egoGift', label: pick(g, lang), names: names(g), href: `/mirror-dungeon?gift=${g.id}`,
      sublabel: g.keyword ? localizeGiftKeyword(g.keyword, lang) : undefined,
      icon: g.image_url ?? undefined, grade: g.grade, context: giftKeyword(g.keyword),
    })),
    ...rows.themes.map((t): IndexEntry => ({
      type: 'themePack', label: pick(t, lang), names: names(t), href: `/mirror-dungeon?tab=themes&pack=${t.id}`,
      sublabel: tierLabel(t.difficulty, lang), icon: t.image_url ?? undefined, grade: t.difficulty,
    })),
    ...rows.events.map((e): IndexEntry => ({
      type: 'event', label: pick(e, lang), names: names(e), href: `/mirror-dungeon?tab=events&event=${e.id}`,
      icon: e.image_url ?? undefined,
    })),
    ...pageEntries(lang),
  ]
}

export async function GET(request: NextRequest) {
  try {
    const param = request.nextUrl.searchParams.get('lang')
    const lang: Lang = param === 'en' || param === 'ja' ? param : 'ko'
    // 그림 주소는 저장소 주소를 뺀 뒷부분만 보낸다(브라우저가 붙인다). 수감자 맥락도 브라우저가 채운다(expandIndex)
    const entries = buildEntries(await loadRows(), lang).map(e => e.icon?.startsWith(STORAGE_BASE + '/') ? { ...e, icon: e.icon.slice(STORAGE_BASE.length + 1) } : e)
    return NextResponse.json({ entries }, { headers: { 'Cache-Control': 'public, max-age=300, stale-while-revalidate=86400' } })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal Server Error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

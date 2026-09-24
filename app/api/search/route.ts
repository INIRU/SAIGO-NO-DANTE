import { NextRequest, NextResponse } from 'next/server'
import { cacheLife, cacheTag } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { CACHE_TAGS } from '@/lib/constants/cache-tags'
import { STORAGE_BASE } from '@/lib/constants/game'
import { isSubsequence, matchScore, matchesAllWords } from '@/lib/search/match'
import { resolveKeywordIconUrl } from '@/lib/keywords/catalog'

export type SearchItemType = 'sinner' | 'identity' | 'ego' | 'keyword' | 'egoGift'
export type SearchItem = {
  type: SearchItemType
  label: string
  sublabel: string
  href: string
  icon?: string
  rarity?: number
  grade?: string | null
}

type Names = { name_kr: string | null; name_en: string | null; name_jp: string | null; name?: string | null }
type Lang = 'ko' | 'en' | 'ja'

const pick = (row: Names, lang: Lang) => (lang === 'en' ? row.name_en : lang === 'ja' ? row.name_jp : row.name_kr) || row.name_kr || row.name || ''
const allNames = (row: Names) => [row.name_kr, row.name_en, row.name_jp, row.name]

// 이름 색인: 표가 작아(수백 행) 한 번 읽어 두고 메모리에서 찾는다. 게임 데이터 동기화 때 태그로 갱신된다.
async function getSearchIndex() {
  'use cache'
  cacheLife('max')
  cacheTag(CACHE_TAGS.gameData, CACHE_TAGS.sinners, CACHE_TAGS.identities, CACHE_TAGS.ego, CACHE_TAGS.egoGifts, CACHE_TAGS.keywords)

  const db = createAdminClient().schema('limbus')
  const [sinners, identities, ego, keywords, gifts] = await Promise.all([
    db.from('sinners').select('id, name, name_kr, name_en, name_jp, order_num'),
    db.from('identities').select('id, name, name_kr, name_en, name_jp, rarity, game_id, folder_name, sinner_id'),
    db.from('ego').select('id, name, name_kr, name_en, name_jp, grade, image_url, sinner_id'),
    db.from('keyword_meta').select('name, name_en, name_jp, description, icon_slug'),
    db.from('ego_gifts').select('name, name_en, name_jp, keyword, grade, image_url'),
  ])
  const failed = [sinners, identities, ego, keywords, gifts].find(r => r.error)
  if (failed?.error) throw new Error(failed.error.message)
  return {
    sinners: sinners.data ?? [],
    identities: identities.data ?? [],
    ego: ego.data ?? [],
    keywords: (keywords.data ?? []).map(k => ({ ...k, description: k.description?.slice(0, 80) ?? null })),
    gifts: gifts.data ?? [],
  }
}

const LIMITS: Record<SearchItemType, number> = { sinner: 4, identity: 8, ego: 6, keyword: 5, egoGift: 6 }

export async function GET(request: NextRequest) {
  try {
    const q = request.nextUrl.searchParams.get('q')?.trim().slice(0, 80) ?? ''
    const langParam = request.nextUrl.searchParams.get('lang')
    const lang: Lang = langParam === 'en' || langParam === 'ja' ? langParam : 'ko'
    if (!q) return NextResponse.json({ items: [], suggestions: [] })

    const index = await getSearchIndex()
    const sinnerById = new Map(index.sinners.map(s => [s.id, s]))
    const sinnerNames = (id: string) => { const s = sinnerById.get(id); return s ? allNames(s) : [] }

    // 이름이 맞으면 점수대로, 이름+수감자 이름을 낱말로 나눠 모두 맞으면 그다음
    const score = (names: (string | null | undefined)[], extra: (string | null | undefined)[] = []) =>
      matchScore(names, q) || (matchesAllWords([...names, ...extra], q) ? 0.5 : 0)

    const candidates: { item: SearchItem; score: number }[] = []
    const add = (item: SearchItem, s: number) => { if (s > 0) candidates.push({ item, score: s }) }

    for (const s of index.sinners) {
      add({ type: 'sinner', label: pick(s, lang), sublabel: s.name ?? '', href: `/sinners/${s.id}`, icon: `${STORAGE_BASE}/icons/Sinners/${s.id}.webp` }, score(allNames(s)))
    }
    for (const i of index.identities) {
      const sinner = sinnerById.get(i.sinner_id)
      add({
        type: 'identity', label: pick(i, lang), sublabel: sinner ? pick(sinner, lang) : '',
        href: `/sinners/${i.sinner_id}/identities/${i.id}`,
        icon: `${STORAGE_BASE}/sinners/${i.sinner_id}/identities/${i.folder_name}/${i.game_id}_normal.webp`,
        rarity: i.rarity,
      }, score(allNames(i), sinnerNames(i.sinner_id)))
    }
    for (const e of index.ego) {
      const sinner = sinnerById.get(e.sinner_id)
      add({
        type: 'ego', label: pick(e, lang), sublabel: sinner ? pick(sinner, lang) : '',
        href: `/sinners/${e.sinner_id}/ego/${e.id}`, icon: e.image_url ?? undefined, grade: e.grade,
      }, score(allNames(e), sinnerNames(e.sinner_id)))
    }
    for (const k of index.keywords) {
      add({
        type: 'keyword', label: pick({ ...k, name_kr: k.name }, lang), sublabel: lang === 'ko' ? k.description ?? '' : '',
        href: `/mirror-dungeon?keyword=${encodeURIComponent(k.name)}`, icon: resolveKeywordIconUrl(k.name, k.icon_slug) ?? undefined,
      }, score([k.name, k.name_en, k.name_jp]))
    }
    for (const g of index.gifts) {
      add({
        type: 'egoGift', label: pick({ ...g, name_kr: g.name }, lang), sublabel: g.keyword ?? '',
        href: `/mirror-dungeon?q=${encodeURIComponent(g.name)}`, icon: g.image_url ?? undefined, grade: g.grade,
      }, score([g.name, g.name_en, g.name_jp]))
    }

    candidates.sort((a, b) => b.score - a.score || a.item.label.length - b.item.label.length)
    const taken: Record<string, number> = {}
    const items = candidates
      .filter(({ item }) => (taken[item.type] = (taken[item.type] ?? 0) + 1) <= LIMITS[item.type])
      .map(c => c.item)

    // 결과가 없으면 글자가 순서대로 들어 있는 인격·E.G.O를 추천한다 ("검료" → 검계 살수 료슈)
    const suggestions = items.length > 0 ? [] : [
      ...index.identities.filter(i => allNames(i).some(n => n && isSubsequence(n, q))).slice(0, 5).map(i => ({
        type: 'identity' as const, label: pick(i, lang), sublabel: pick(sinnerById.get(i.sinner_id) ?? { name_kr: '', name_en: '', name_jp: '' }, lang),
        href: `/sinners/${i.sinner_id}/identities/${i.id}`,
        icon: `${STORAGE_BASE}/sinners/${i.sinner_id}/identities/${i.folder_name}/${i.game_id}_normal.webp`,
        rarity: i.rarity,
      })),
    ]

    return NextResponse.json({ items, suggestions })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal Server Error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

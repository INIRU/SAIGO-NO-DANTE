import { NextRequest, NextResponse } from 'next/server'
import { cacheLife, cacheTag } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { CACHE_TAGS } from '@/lib/constants/cache-tags'
import { ASSET_KINDS, isAssetKind, type AssetKind } from '@/lib/notes/blocks'
import type { NoteAssetData } from '@/features/notes'
import { SIN_ORDER, SIN_LABELS_KR, SIN_ICON_MAP } from '@/lib/constants/sin'
import { getIdentityInfoUrl } from '@/lib/utils/images'
import { resolveKeywordIconUrl } from '@/lib/keywords/catalog'
import { withEgoStage } from '@/lib/db/queries'
import type { Identity, Skill } from '@/lib/types'
import { isUuid } from '@/lib/utils/uuid'

const TABLES = { gift:'ego_gifts', theme:'ego_gift_themes', identity:'identities', ego:'ego', skill:'skills', keyword:'keyword_meta' } as const
const COLUMNS = {
  gift:'id,name,name_en,name_jp,grade,keyword,image_url,effect_base,effect_base_en,effect_base_jp',
  theme:'id,name,name_en,name_jp,image_url',
  identity:'id,name_kr,name_en,name_jp,sinner_id,rarity,game_id,folder_name,keywords,release_date',
  ego:'id,name_kr,name_en,name_jp,grade,image_url,sinner_id,sin_affinity,stage_levels:ego_skills(construe_level)',
  skill:'id,name,name_en,name_jp,identity_id,skill_type,atk_type,sin_affinity,coins,base_power,coin_power,coin_list,skill_order,image_id,variant_order,atk_weight,offense_level,description,description_en,description_jp,uptie_level',
  keyword:'name,name_en,name_jp,description,icon_slug',
} as const
type AssetQuery = PromiseLike<{ data: unknown; error: unknown }> & {
  in(column: string, values: readonly unknown[]): AssetQuery
  eq(column: string, value: unknown): AssetQuery
  gte(column: string, value: unknown): AssetQuery
  or(filters: string): AssetQuery
  order(column: string): AssetQuery
  range(from: number, to: number): AssetQuery
}
async function load(kind: AssetKind, query: string, ids: string[], offset = 0, grade = '', identityIds: string[] | null = null, catalog = false): Promise<NoteAssetData[]> {
  'use cache'
  cacheLife('hours'); cacheTag(CACHE_TAGS.gameData)
  if (kind === 'sin') return SIN_ORDER.filter(id => ids.length ? ids.includes(id) : `${id} ${SIN_LABELS_KR[id]}`.includes(query)).map(id => ({kind,id,name:SIN_LABELS_KR[id],name_en:id,image_url:SIN_ICON_MAP[id]}))
  if (kind === 'skill' && identityIds?.length === 0) return []
  const db = createAdminClient().schema('limbus')
  // One query over six tables: the client types one table at a time, so the builder is read through its few filters.
  let req = db.from(TABLES[kind]).select(COLUMNS[kind]) as AssetQuery
  // 노트 스킬은 동기화 III·IV만 쓴다(I·II 행이 들어와도 검색·형제 라벨이 바뀌지 않게)
  if (kind === 'skill') req = identityIds ? req.in('identity_id', identityIds).eq('uptie_level', 4) : req.gte('uptie_level', 3)
  if (kind === 'gift' && grade) req = req.eq('grade', Number(grade))
  if (ids.length) req = req.in(kind === 'keyword' ? 'name' : 'id', ids)
  else {
    const escaped = query.replace(/[%,().\\]/g,'')
    if (escaped) req = req.or(`${kind === 'identity' || kind === 'ego' ? 'name_kr' : 'name'}.ilike.%${escaped}%,name_en.ilike.%${escaped}%,name_jp.ilike.%${escaped}%`)
    req = req.order(kind === 'identity' || kind === 'ego' ? 'name_kr' : 'name').range(offset, offset + (catalog ? 999 : identityIds ? 239 : 23))
  }
  const {data,error} = await req
  if (error) throw Error('Assets unavailable')
  // Columns are an explicit public game-data allowlist, never user/profile rows.
  const rows = data as Array<Record<string, unknown>>
  let identities: Identity[] = [], siblings: Skill[] = []
  if (kind === 'skill' && rows.length) {
    const identityIds = [...new Set(rows.map(r => String(r.identity_id)))]
    const [parents, allSkills] = await Promise.all([
      db.from('identities').select(COLUMNS.identity).in('id', identityIds),
      db.from('skills').select(COLUMNS.skill).in('identity_id', identityIds).gte('uptie_level', 3),
    ])
    if (parents.error || allSkills.error) throw Error('Skill data unavailable')
    identities = parents.data as Identity[]; siblings = allSkills.data as Skill[]
  }
  return rows.map(row => {
    const identity = kind === 'identity' ? row as Identity : identities.find(i => i.id === row.identity_id)
    return { kind, id:String(kind === 'keyword' ? row.name : row.id), name:String(row.name_kr || row.name || ''),
      name_en:row.name_en as string, name_jp:row.name_jp as string,
      image_url:identity && kind === 'identity' ? getIdentityInfoUrl(identity) : kind === 'keyword' ? resolveKeywordIconUrl(String(row.name), row.icon_slug as string | null) : row.image_url as string,
      grade:row.grade as string, keyword:row.keyword as string, description:(row.description ?? row.effect_base) as string, description_en:(row.description_en ?? row.effect_base_en) as string, description_jp:(row.description_jp ?? row.effect_base_jp) as string,
      ...(kind === 'ego' ? {ego: {grade:String(row.grade), image_url:row.image_url as string, sin_affinity:row.sin_affinity as string, max_construe_level:withEgoStage({stage_levels:row.stage_levels as {construe_level:number|null}[]}).max_construe_level}, sinnerId:String(row.sinner_id)} : {}),
      ...(identity ? {identity} : {}),
      ...(kind === 'skill' ? {skill:row as Skill, skills:siblings.filter(s => s.identity_id === row.identity_id), sinnerName:identity?.name_kr} : {}),
    }
  })
}
export async function GET(req: NextRequest) {
  const p=req.nextUrl.searchParams
  try {
    if (p.has('refs')) {
      const refs: unknown = JSON.parse(p.get('refs')!)
      if (!Array.isArray(refs) || refs.length > 150 || refs.some(r => !r || !isAssetKind(r.kind) || typeof r.id !== 'string' || !r.id || r.id.length > 150)) return NextResponse.json({error:'Invalid references'},{status:400})
      const results = await Promise.all(ASSET_KINDS.map(kind => {
        const ids = [...new Set(refs.filter(r => r.kind === kind).map(r => r.id as string))]
        return ids.length ? load(kind,'',ids) : []
      }))
      return NextResponse.json(results.flat())
    }
    const grade=p.get('grade') ?? ''
    if (grade && !/^[1-5]$/.test(grade)) return NextResponse.json({error:'Invalid tier'},{status:400})
    const kind=p.get('kind'), q=p.get('q')?.trim() ?? '', offset=Number(p.get('offset') ?? 0)
    if (!isAssetKind(kind) || q.length > 100 || !Number.isInteger(offset) || offset < 0 || offset > 5000) return NextResponse.json({error:'Invalid search'},{status:400})
    const identityIds = p.has('identities') ? p.get('identities')!.split(',').filter(Boolean) : null
    if (identityIds && (identityIds.length > 12 || identityIds.some(id => !isUuid(id)))) return NextResponse.json({error:'Invalid identities'},{status:400})
    return NextResponse.json(await load(kind,q,[],offset,grade,identityIds,['gift', 'identity', 'ego'].includes(kind) && p.get('catalog') === '1'))
  } catch { return NextResponse.json({error:'Assets unavailable'},{status:503}) }
}

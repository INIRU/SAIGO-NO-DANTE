import type { Metadata } from 'next'
import { cacheLife, cacheTag } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { getTranslations } from 'next-intl/server'
import { CACHE_TAGS } from '@/lib/constants/cache-tags'
import RunWrapper from './RunWrapper'
import type { MirrorDungeonEvent } from '@/components/mirror-dungeon/types'

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params
  const t = await getTranslations({ locale: lang, namespace: 'planner' })
  return {
    title: t('run.metaTitle'),
    description: '림버스 컴퍼니 거울 던전 트리거 모드 — 실시간 기프트 추적, 인격/스킬/EGO 수정, 확률업 기프트 확인, 이벤트 선택지 가이드',
    alternates: { canonical: 'https://saigo-no-dante.com/planner/run' },
  }
}

export default async function RunPage() {
  'use cache'
  cacheLife('max')
  cacheTag(CACHE_TAGS.mirrorDungeon, CACHE_TAGS.gameData)
  const supabase = createAdminClient()

  const [{ data: themes, error: e1 }, { data: gifts, error: e2 }, { data: recipes, error: e3 }] = await Promise.all([
    supabase.schema('limbus').from('ego_gift_themes').select('id, name, name_en, name_jp, dungeon_id, ego_gift_ids, specific_ego_gift_ids, image_url, difficulty, floor_info'),
    supabase.schema('limbus').from('ego_gifts').select('*').order('keyword').order('grade'),
    supabase.schema('limbus').from('ego_gift_recipes').select('*'),
  ])
  if (e1 || e2 || e3) console.error('[RunPage] query group 1:', e1?.message, e2?.message, e3?.message)

  const [{ data: identities, error: e4 }, { data: sinners, error: e5 }, { data: skills, error: e6 }, { data: passives, error: e6b }] = await Promise.all([
    supabase.schema('limbus').from('identities').select('id, sinner_id, name_kr, rarity, keywords, skill_keyword_list, affiliation, association_list, game_id, folder_name').order('rarity', { ascending: false }),
    supabase.schema('limbus').from('sinners').select('id, name_kr, order_num').order('order_num'),
    supabase.schema('limbus').from('skills').select('identity_id, name, sin_affinity, skill_type, skill_order, uptie_level').eq('uptie_level', 4),
    supabase.schema('limbus').from('passives').select('id, name, identity_id, passive_type, sin_affinity, sin_count, active_cond, description, uptie_level').eq('uptie_level', 4),
  ])
  if (e4 || e5 || e6 || e6b) console.error('[RunPage] query group 2:', e4?.message, e5?.message, e6?.message, e6b?.message)

  const [{ data: egos, error: e7 }, { data: mdEvents, error: e8 }, { data: mdChoices, error: e9 }] = await Promise.all([
    supabase.schema('limbus').from('ego').select('id, sinner_id, name, name_kr, grade, sin_affinity, image_url, cost, game_id'),
    supabase.schema('limbus').from('md_events').select('id, name, desc_text, gift_ids, source, image_url, theme_ids').order('id'),
    supabase.schema('limbus').from('md_event_choices').select('event_id, sort_order, message, message_desc, result_text').order('event_id').order('sort_order'),
  ])
  if (e7 || e8 || e9) console.error('[RunPage] query group 3:', e7?.message, e8?.message, e9?.message)

  // Build a map from event_id → sorted choices for O(1) lookup
  const choicesByEventId = new Map<number, typeof mdChoices>()
  for (const choice of (mdChoices ?? [])) {
    const arr = choicesByEventId.get(choice.event_id) ?? []
    arr.push(choice)
    choicesByEventId.set(choice.event_id, arr)
  }

  // Compose md_events rows into the MirrorDungeonEvent shape RunClient expects
  const events: MirrorDungeonEvent[] = (mdEvents ?? []).map(ev => ({
    id: ev.id,
    name: ev.name,
    desc_text: ev.desc_text,
    gift_ids: ev.gift_ids,
    source: ev.source,
    image_url: ev.image_url,
    theme_ids: ev.theme_ids,
    options: (choicesByEventId.get(ev.id) ?? []).map(c => ({
      message: c.message ?? '',
      messageDesc: c.message_desc ?? undefined,
      result: c.result_text ? [c.result_text] : undefined,
    })),
  }))

  return (
    <RunWrapper
      themes={themes ?? []}
      gifts={gifts ?? []}
      recipes={recipes ?? []}
      identities={identities ?? []}
      sinners={sinners ?? []}
      skills={skills ?? []}
      passives={passives ?? []}
      egos={egos ?? []}
      events={events ?? []}
    />
  )
}

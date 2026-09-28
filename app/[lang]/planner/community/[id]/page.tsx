import { notePlainText } from '@/lib/notes/blocks'
import { resolvePlannerIdentity } from '@/lib/planner/catalog-references'
import { selectUptieRows } from '@/lib/identity/skill-model'
import type { Metadata } from 'next'
import { localeAlternates } from '@/lib/seo/metadata'
import { absoluteUrl } from '@/lib/utils/og-image'
import { Suspense } from 'react'
import { notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { cacheLife, cacheTag } from 'next/cache'
import { CACHE_TAGS } from '@/lib/constants/cache-tags'
import { withoutOtherLocales } from '@/lib/i18n/strip-locales'
import type { MdEvent, MdEventChoice } from '@/components/mirror-dungeon/types'
import PlanDetailClient from './PlanDetailClient'
import PlanDetailSkeleton from './PlanDetailSkeleton'

interface Props {
  params: Promise<{ lang: string; id: string }>
}

/**
 * Fetch the full plan row. Both generateMetadata and PlanDetailPage call this
 * function — the Supabase server client is created fresh each time, but the
 * query selects the full set of columns needed by the page so there is only
 * one plan DB round-trip per request (metadata reuses the same data shape).
 */
async function fetchFullPlan(id: string) {
  const supabase = await createClient()
  const { data } = await supabase
    .schema('limbus')
    .from('md_plans')
    .select('id, title, description, difficulty, tags, deck, egos, floor_plan, gift_inventory, vote_count, view_count, comment_count, created_at, user_id, guest_tag, profiles:user_id(username, avatar_url)')
    .eq('id', id)
    .maybeSingle()
  return data
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang, id } = await params
  const tDetail = await getTranslations({ locale: lang, namespace: 'planner.detail' })
  const tDifficulty = await getTranslations({ locale: lang, namespace: 'planner.communityBoard.difficulty' })
  const plan = await fetchFullPlan(id)
  if (!plan) return { title: tDetail('notFoundTitle') }

  const diff = tDifficulty(plan.difficulty)

  return {
    title: tDetail('metaTitle', { title: plan.title }),
    alternates: localeAlternates(lang, `/planner/community/${id}`),
    openGraph: { images: [{ url: absoluteUrl(`/${lang}/planner/community/${id}/opengraph-image`), width: 1200, height: 630, alt: plan.title }] },
    twitter: { card: 'summary_large_image', images: [absoluteUrl(`/${lang}/planner/community/${id}/opengraph-image`)] },
    description: plan.description
      ? tDetail('metaDescriptionWithDescription', { difficulty: diff, description: notePlainText(plan.description).slice(0,160) })
      : tDetail('metaDescription', { difficulty: diff }),
  }
}

// 모든 플랜이 같이 쓰는 게임 데이터는 캐시한다(플랜마다 DB를 다시 읽지 않게)
async function fetchPlanDetailGameData() {
  'use cache'
  cacheLife('max')
  cacheTag(CACHE_TAGS.gameData, CACHE_TAGS.mirrorDungeon, CACHE_TAGS.themes, CACHE_TAGS.egoGifts, CACHE_TAGS.identities, CACHE_TAGS.sinners, CACHE_TAGS.ego)
  const db = createAdminClient().schema('limbus')
  const [themes, gifts, recipes, identities, sinners, egos] = await Promise.all([
    db.from('ego_gift_themes').select('id, name, name_en, name_jp, ego_gift_ids, specific_ego_gift_ids, fixed_reward_gift_ids, image_url, difficulty, floor_info'),
    db.from('ego_gifts').select('*').order('keyword').order('grade'),
    db.from('ego_gift_recipes').select('*'),
    db.from('identities').select('id, sinner_id, name, name_kr, name_en, name_jp, tier, rarity, keywords, skill_keyword_list, affiliation, association_list, game_id, folder_name, hp, speed_min, speed_max, def_level, slash_res, pierce_res, blunt_res').order('rarity', { ascending: false }),
    db.from('sinners').select('id, name_kr, order_num').order('order_num'),
    db.from('ego').select('id, sinner_id, name, name_kr, name_en, name_jp, grade, sin_affinity, image_url, cost, game_id'),
  ])
  for (const [name, result] of Object.entries({ themes, gifts, recipes, identities, sinners, egos })) {
    if (result.error) console.error('Failed to fetch ' + name + ':', result.error)
  }
  return { themes: themes.data ?? [], gifts: gifts.data ?? [], recipes: recipes.data ?? [], identities: identities.data ?? [], sinners: sinners.data ?? [], egos: egos.data ?? [] }
}

// 층 계획의 기프트를 주는 진입 이벤트와, 선택지가 이어지는 후속 이벤트·선택지만 읽는다(이벤트 모달용)
async function fetchPlanEvents(giftIds: number[]) {
  'use cache'
  cacheLife('max')
  cacheTag(CACHE_TAGS.gameData, CACHE_TAGS.mirrorDungeon)
  if (!giftIds.length) return { events: [], choices: [] }
  const db = createAdminClient().schema('limbus')
  const columns = 'id, name, name_en, name_jp, desc_text, desc_text_en, desc_text_jp, event_type, source, image_url, theme_ids, gift_ids, variant_of, category, judgment'
  const roots = await db.from('md_events').select(columns).eq('category', 'entry').overlaps('gift_ids', giftIds)
  if (roots.error) { console.error('Failed to fetch plan events:', roots.error); return { events: [], choices: [] } }
  const events = [...roots.data]
  const choices: Record<string, unknown>[] = []
  let pending = events.map(event => event.id)
  // 후속 이벤트 체인은 4단계까지만 따라간다(실제 데이터는 그보다 얕다)
  for (let depth = 0; pending.length && depth < 4; depth++) {
    const next = await db.from('md_event_choices').select('*').in('event_id', pending).order('event_id').order('sort_order')
    if (next.error) { console.error('Failed to fetch plan event choices:', next.error); break }
    choices.push(...next.data)
    const known = new Set(events.map(event => event.id))
    const linked = [...new Set(next.data.flatMap(choice => choice.next_event_id && !known.has(choice.next_event_id) ? [choice.next_event_id as number] : []))]
    if (!linked.length) break
    const more = await db.from('md_events').select(columns).in('id', linked)
    if (more.error) { console.error('Failed to fetch linked events:', more.error); break }
    events.push(...more.data)
    pending = more.data.map(event => event.id)
  }
  return { events, choices }
}

const localized = (row: Record<string, unknown>, field: string, lang: string) =>
  (lang === 'en' ? row[field + '_en'] : lang === 'ja' ? row[field + '_jp'] : null) ?? row[field]

export default async function PlanDetailPage({ params }: Props) {
  const { lang, id } = await params
  const supabase = await createClient()

  // 플랜과 캐시된 게임 데이터를 함께 읽고, 스킬·패시브만 편성 인격 기준으로 한 번 더 읽는다(DB 왕복 4번 → 2번)
  const [plan, game] = await Promise.all([fetchFullPlan(id), fetchPlanDetailGameData()])
  if (!plan) notFound()
  const planGiftIds = [...new Set((Array.isArray(plan.floor_plan) ? plan.floor_plan : [])
    .flatMap((entry: { gift_ids?: unknown }) => Array.isArray(entry?.gift_ids) ? entry.gift_ids.map(Number) : [])
    .filter((giftId: number) => Number.isInteger(giftId) && giftId > 0))].sort((a, b) => a - b)
  const { themes, recipes, identities, sinners, egos } = game
  const gifts = game.gifts.map(gift => withoutOtherLocales(gift, lang, ['effect_base', 'effect_plus', 'effect_plusplus']))

  const memberIds = [...new Set((Array.isArray(plan.deck) ? plan.deck : []).flatMap(slot => {
    const identity = resolvePlannerIdentity(slot, identities)
    return identity ? [identity.id] : []
  }))]

  const [{ data: skills, error: skillsError }, { data: passives, error: passivesError }, planEvents] = await Promise.all([
    supabase.schema('limbus').from('skills')
      .select('id, identity_id, image_id, name, name_en, name_jp, skill_type, atk_type, sin_affinity, coins, base_power, coin_power, skill_order, variant_order, atk_weight, offense_level, description, description_en, description_jp, uptie_level')
      .in('identity_id', memberIds)
      .gte('uptie_level', 3),
    supabase.schema('limbus').from('passives')
      .select('id, identity_id, name, name_en, name_jp, passive_type, sin_affinity, sin_count, active_cond, description, description_en, description_jp, passive_order, uptie_level')
      .in('identity_id', memberIds)
      .gte('uptie_level', 3),
    fetchPlanEvents(planGiftIds),
  ])
  if (skillsError) console.error('Failed to fetch skills:', skillsError)
  if (passivesError) console.error('Failed to fetch passives:', passivesError)

  return (
    <Suspense fallback={<PlanDetailSkeleton />}>
      <PlanDetailClient
        plan={plan as any}
        themes={themes}
        gifts={gifts}
        recipes={recipes}
        identities={identities}
        sinners={sinners}
        skills={memberIds.flatMap(id => selectUptieRows((skills ?? []).filter(row => row.identity_id === id), 4))}
        passives={memberIds.flatMap(id => selectUptieRows((passives ?? []).filter(row => row.identity_id === id), 4))}
        egos={egos}
        events={planEvents.events.map(event => withoutOtherLocales(event, lang, ['desc_text'], ['judgment'])) as unknown as MdEvent[]}
        eventChoices={planEvents.choices.map(choice => ({
          ...withoutOtherLocales(choice, lang, ['result_text', 'message', 'message_desc'], ['effects']),
          message: localized(choice, 'message', lang),
          message_desc: localized(choice, 'message_desc', lang),
          result_text: localized(choice, 'result_text', lang),
        })) as unknown as MdEventChoice[]}
      />
    </Suspense>
  )
}

import type { Metadata } from 'next'
import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import PlannerClient from './PlannerClient'

export const metadata: Metadata = {
  title: '거울 던전 플래너',
  description: '림버스 컴퍼니 거울 던전 플래너 — 층별 테마팩 시뮬레이션, 덱 편성, 기프트 조합식, 키워드 시너지를 한번에 계획하세요.',
  alternates: { canonical: 'https://saigo-no-dante.com/planner' },
}

export default async function PlannerPage() {
  const supabase = await createClient()

  // 그룹 1: 거울 던전 데이터
  const [{ data: themes, error: themesError }, { data: gifts, error: giftsError }, { data: recipes, error: recipesError }] = await Promise.all([
    supabase.schema('limbus').from('ego_gift_themes').select('id, name, dungeon_id, ego_gift_ids, specific_ego_gift_ids, image_url, boss_image_url, difficulty, floor_info'),
    supabase.schema('limbus').from('ego_gifts').select('*').order('keyword').order('grade'),
    supabase.schema('limbus').from('ego_gift_recipes').select('*'),
  ])
  if (themesError) console.error('Failed to fetch themes:', themesError)
  if (giftsError) console.error('Failed to fetch gifts:', giftsError)
  if (recipesError) console.error('Failed to fetch recipes:', recipesError)

  // 그룹 2: 인격/수감자/패시브/스킬/EGO
  const [{ data: identities, error: identitiesError }, { data: sinners, error: sinnersError }, { data: passives, error: passivesError }, { data: skills, error: skillsError }] = await Promise.all([
    supabase.schema('limbus').from('identities').select('id, sinner_id, name_kr, rarity, keywords, game_id, folder_name').order('rarity', { ascending: false }),
    supabase.schema('limbus').from('sinners').select('id, name_kr, order_num').order('order_num'),
    supabase.schema('limbus').from('passives').select('id, name, identity_id, passive_type, sin_affinity, sin_count, active_cond, description, uptie_level').eq('uptie_level', 4),
    supabase.schema('limbus').from('skills').select('identity_id, name, sin_affinity, skill_type, skill_order, uptie_level').eq('uptie_level', 4),
  ])
  if (identitiesError) console.error('Failed to fetch identities:', identitiesError)
  if (sinnersError) console.error('Failed to fetch sinners:', sinnersError)
  if (passivesError) console.error('Failed to fetch passives:', passivesError)
  if (skillsError) console.error('Failed to fetch skills:', skillsError)

  // 그룹 3: EGO
  const { data: egos, error: egosError } = await supabase.schema('limbus').from('ego').select('id, sinner_id, name, name_kr, grade, sin_affinity, image_url, cost')
  if (egosError) console.error('Failed to fetch egos:', egosError)

  return (
    <>
      {/* Server-rendered page header — paints in initial HTML before JS loads */}
      <div className="pt-20 sm:pt-24 pb-4 px-3 md:px-6 max-w-[90rem] mx-auto">
        <p style={{ color: 'var(--gold-dim)', fontFamily: 'var(--font-mono)', fontSize: '0.625rem', letterSpacing: '0.3em', marginBottom: '0.5rem' }}>
          MIRROR DUNGEON PLANNER
        </p>
        <h1 className="font-serif text-2xl md:text-4xl font-bold" style={{ color: 'var(--gold)' }}>
          거울 던전 플래너
        </h1>
        <div style={{ width: '6rem', height: '0.0625rem', background: 'linear-gradient(90deg, var(--gold), transparent)', marginTop: '0.75rem' }} />
      </div>
      {/* PlannerClient uses nuqs (useSearchParams internally), requiring Suspense
          to prevent CSR bailout from de-opting the entire page to client rendering. */}
      <Suspense fallback={null}>
        <PlannerClient
          themes={themes ?? []}
          gifts={gifts ?? []}
          recipes={recipes ?? []}
          identities={identities ?? []}
          sinners={sinners ?? []}
          passives={passives ?? []}
          skills={skills ?? []}
          egos={egos ?? []}
        />
      </Suspense>
    </>
  )
}

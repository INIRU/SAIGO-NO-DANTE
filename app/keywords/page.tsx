import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import KeywordsClient from './KeywordsClient'

export const revalidate = 300

export const metadata: Metadata = {
  title: '키워드 도감',
  description: '림버스 컴퍼니 키워드 도감 — 415종 키워드별 설명, 관련 인격, E.G.O 기프트 한눈에.',
  openGraph: {
    title: '키워드 도감 | 최애의 관리자',
    description: '림버스 컴퍼니 키워드 도감 — 키워드별 관련 인격·기프트 모아보기.',
  },
}

export default async function KeywordsPage() {
  const supabase = await createClient()

  const [{ data: keywords }, { data: identities }, { data: sinners }, { data: gifts }, { data: egos }] = await Promise.all([
    supabase.schema('limbus').from('keyword_meta')
      .select('name, description, max_stack, icon_slug, sin_affinity')
      .order('name'),
    supabase.schema('limbus').from('identities')
      .select('id, name, name_kr, sinner_id, keywords, rarity, game_id, folder_name')
      .order('name'),
    supabase.schema('limbus').from('sinners')
      .select('id, name_kr'),
    supabase.schema('limbus').from('ego_gifts')
      .select('name, keyword, grade, image_url')
      .order('name'),
    supabase.schema('limbus').from('ego')
      .select('id, name, name_kr, sinner_id, grade, sin_affinity, keywords, folder_name, image_url')
      .order('name'),
  ])

  return (
    <KeywordsClient
      keywords={keywords ?? []}
      identities={identities ?? []}
      sinners={sinners ?? []}
      gifts={gifts ?? []}
      egos={egos ?? []}
    />
  )
}

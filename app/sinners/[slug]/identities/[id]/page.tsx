import { getSinnerById, getIdentityById, getSkills, getPassives, getIdentities, getEGOs } from '@/lib/data/sinners'
import { notFound } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import IdentityDetailClient from './IdentityDetailClient'

export default async function IdentityPage({
  params,
}: {
  params: Promise<{ slug: string; id: string }>
}) {
  const { slug, id } = await params
  const [sinner, identity] = await Promise.all([
    getSinnerById(slug),
    getIdentityById(id),
  ])
  if (!sinner || !identity) notFound()

  const [skills, passives, session, sinnerIdentities, sinnerEgos] = await Promise.all([
    getSkills(identity.id),
    getPassives(identity.id),
    getServerSession(authOptions),
    getIdentities(sinner.id),
    getEGOs(sinner.id),
  ])

  // 운용법 조회
  let guide: { id: string; content: string; author_name: string | null; updated_at: string } | null = null
  try {
    const admin = createAdminClient()
    const { data } = await admin
      .schema('limbus')
      .from('identity_guides')
      .select('id, content, updated_at, author_id')
      .eq('identity_id', identity.id)
      .maybeSingle()
    if (data) {
      const { data: profile } = await admin
        .schema('limbus')
        .from('profiles')
        .select('username')
        .eq('id', data.author_id)
        .single()
      guide = {
        id: data.id,
        content: data.content,
        author_name: profile?.username ?? null,
        updated_at: data.updated_at,
      }
    }
  } catch { /* guide fetch failed, continue without it */ }

  return (
    <IdentityDetailClient
      sinner={sinner}
      identity={identity}
      skills={skills}
      passives={passives}
      guide={guide}
      sinnerIdentities={sinnerIdentities}
      sinnerEgos={sinnerEgos}
      canEditGuide={session?.user?.isWanjang === true || session?.user?.isAdmin === true}
    />
  )
}

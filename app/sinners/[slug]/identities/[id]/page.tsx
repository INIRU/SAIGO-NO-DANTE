import { getSinnerById, getIdentityById, getSkills, getPassives, getIdentities, getEGOs, getSinners } from '@/lib/data/sinners'
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

  const [skills, passives, session, sinnerIdentities, sinnerEgos, allSinners, allIdentities, allEgos] = await Promise.all([
    getSkills(identity.id),
    getPassives(identity.id),
    getServerSession(authOptions),
    getIdentities(sinner.id),
    getEGOs(sinner.id),
    getSinners(),
    getIdentities(),
    getEGOs(),
  ])

  // 운영법 조회 (여러 개)
  let guides: { id: string; title: string; content: string; author_name: string | null; updated_at: string }[] = []
  try {
    const admin = createAdminClient()
    const { data } = await admin
      .schema('limbus')
      .from('identity_guides')
      .select('id, title, content, updated_at, author_id')
      .eq('identity_id', identity.id)
      .order('created_at', { ascending: true })
    if (data && data.length > 0) {
      const authorIds = [...new Set(data.map(g => g.author_id))]
      const { data: profiles } = await admin
        .schema('limbus')
        .from('profiles')
        .select('id, username')
        .in('id', authorIds)
      const profileMap = new Map(profiles?.map(p => [p.id, p.username]) ?? [])
      guides = data.map(g => ({
        id: g.id,
        title: g.title,
        content: g.content,
        author_name: profileMap.get(g.author_id) ?? null,
        updated_at: g.updated_at,
      }))
    }
  } catch { /* guide fetch failed, continue without it */ }

  return (
    <IdentityDetailClient
      sinner={sinner}
      identity={identity}
      skills={skills}
      passives={passives}
      guides={guides}
      sinnerIdentities={sinnerIdentities}
      sinnerEgos={sinnerEgos}
      allSinners={allSinners}
      allIdentities={allIdentities}
      allEgos={allEgos}
      canEditGuide={session?.user?.isWanjang === true || session?.user?.isAdmin === true}
    />
  )
}

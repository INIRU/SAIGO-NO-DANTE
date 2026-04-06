import type { Metadata } from 'next'
import { Suspense } from 'react'
import { getSinnerById, getIdentityById, getSkills, getPassives, getIdentities, getEGOs, getSinners, getEgoGiftsForNotes, getSanityConditions, getPanicInfo } from '@/lib/db/queries'
import { notFound } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { getIdentityInfoUrl, getIdentityProfileUrl } from '@/lib/utils/images'
import IdentityDetailClient from './IdentityDetailClient'
import JsonLd, { breadcrumbJsonLd, gameCharacterJsonLd } from '@/components/seo/JsonLd'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://saigo-no-dante.com'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; id: string }>
}): Promise<Metadata> {
  const { slug, id } = await params
  const [sinner, identity] = await Promise.all([
    getSinnerById(slug),
    getIdentityById(id),
  ])
  if (!sinner || !identity) return { title: '인격을 찾을 수 없습니다', robots: { index: false } }

  const rarityStr = identity.rarity === 3 ? '000등급' : identity.rarity === 2 ? '00등급' : '0등급'
  const keywordsStr = identity.keywords?.length ? identity.keywords.slice(0, 3).join(', ') : ''
  const description = `${sinner.name_kr} ${identity.name_kr} — ${rarityStr}${keywordsStr ? `, 키워드: ${keywordsStr}` : ''}. 스킬, 패시브, 스탯 정보.`
  const imageUrl = getIdentityInfoUrl(identity) || getIdentityProfileUrl(identity)
  const canonical = `${SITE_URL}/sinners/${slug}/identities/${id}`
  const pageTitle = `${identity.name_kr} | ${sinner.name_kr} | SAIGO NO DANTE`

  return {
    title: { absolute: pageTitle },
    description,
    alternates: { canonical },
    openGraph: {
      title: pageTitle,
      description,
      url: canonical,
      type: 'article',
      ...(imageUrl ? { images: [{ url: imageUrl, width: 512, height: 512, alt: `${identity.name_kr} — ${sinner.name_kr} 인격 이미지` }] } : {}),
    },
    twitter: {
      card: 'summary_large_image',
      title: pageTitle,
      description,
      ...(imageUrl ? { images: [imageUrl] } : {}),
    },
  }
}

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

  const [skills, passives, session, allSinners, allIdentities, allEgos, egoGifts, currentSeason, sanityConditions, panicInfo] = await Promise.all([
    getSkills(identity.id),
    getPassives(identity.id),
    getServerSession(authOptions),
    getSinners(),
    getIdentities(),
    getEGOs(),
    getEgoGiftsForNotes(),
    (async () => {
      const supabase = createAdminClient()
      const { data, error } = await supabase
        .schema('limbus').from('app_config').select('value')
        .eq('key', 'current_season').single()
      if (error) console.error('Failed to fetch current season:', error)
      return data?.value?.season ?? 7
    })(),
    getSanityConditions(identity.id),
    identity.panic_type ? getPanicInfo(identity.panic_type) : Promise.resolve(null),
  ])

  // 운영법 조회 (여러 개)
  let guides: { id: string; title: string; content: string; author_name: string | null; updated_at: string }[] = []
  try {
    const admin = createAdminClient()
    const { data, error: guidesError } = await admin
      .schema('limbus')
      .from('identity_guides')
      .select('id, title, content, updated_at, author_id')
      .eq('identity_id', identity.id)
      .order('created_at', { ascending: true })
    if (guidesError) console.error('Failed to fetch identity guides:', guidesError)
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

  const canonical = `${SITE_URL}/sinners/${slug}/identities/${id}`
  const identityImageUrl = getIdentityInfoUrl(identity) || getIdentityProfileUrl(identity)

  return (
    <>
      <JsonLd data={breadcrumbJsonLd([
        { name: '홈', url: SITE_URL },
        { name: '수감자', url: `${SITE_URL}/sinners` },
        { name: sinner.name_kr, url: `${SITE_URL}/sinners/${slug}` },
        { name: identity.name_kr, url: canonical },
      ])} />
      {identityImageUrl && (
        <JsonLd data={gameCharacterJsonLd({
          name: `${identity.name_kr} — ${sinner.name_kr}`,
          description: `${sinner.name_kr}의 ${identity.name_kr} 인격. Limbus Company 수감자 인격 정보.`,
          image: identityImageUrl,
          url: canonical,
          siteUrl: SITE_URL,
        })} />
      )}
      <Suspense fallback={null}>
        <IdentityDetailClient
          sinner={sinner}
          identity={identity}
          skills={skills}
          passives={passives}
          sanityConditions={sanityConditions}
          panicInfo={panicInfo}
          guides={guides}
          allSinners={allSinners}
          allIdentities={allIdentities}
          allEgos={allEgos}
          egoGifts={egoGifts}
          canEditGuide={session?.user?.isWanjang === true || session?.user?.isAdmin === true}
          isAdmin={!!session?.user?.isAdmin}
          isLoggedIn={!!session}
          currentSeason={currentSeason}
        />
      </Suspense>
    </>
  )
}

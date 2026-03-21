import type { Metadata } from 'next'
import { getSinnerById, getIdentities, getEGOs } from '@/lib/db/queries'
import { SINNER_SLUGS } from '@/lib/constants/game'
import { notFound } from 'next/navigation'
import SinnerDetailClient from './SinnerDetailClient'
import JsonLd, { breadcrumbJsonLd, gameCharacterJsonLd } from '@/components/seo/JsonLd'
import { getSinnerProfileUrl } from '@/lib/utils/images'

export const revalidate = 60

export function generateStaticParams() {
  return SINNER_SLUGS.map(slug => ({ slug }))
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const sinner = await getSinnerById(slug)
  if (!sinner) return { title: '수감자를 찾을 수 없습니다', robots: { index: false } }
  const siteUrl = 'https://saigo-no-dante.com'
  return {
    title: `${sinner.name_kr} (${sinner.name})`,
    description: `${sinner.name_kr}의 모든 인격과 EGO — ${sinner.description ?? `Limbus Company ${sinner.name_kr} 수감자 정보`}`,
    alternates: { canonical: `${siteUrl}/sinners/${slug}` },
    openGraph: {
      title: `${sinner.name_kr} | 최애의 관리자`,
      description: `${sinner.name_kr}의 인격, EGO, 스킬 데이터를 확인하세요.`,
    },
  }
}

export default async function SinnerPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const [sinner, identities, egos] = await Promise.all([
    getSinnerById(slug),
    getIdentities(slug),
    getEGOs(slug),
  ])
  if (!sinner) notFound()

  const siteUrl = 'https://saigo-no-dante.com'
  const profileUrl = getSinnerProfileUrl(sinner.id)

  return (
    <>
      <JsonLd data={breadcrumbJsonLd([
        { name: '홈', url: siteUrl },
        { name: '수감자', url: `${siteUrl}/sinners` },
        { name: sinner.name_kr, url: `${siteUrl}/sinners/${slug}` },
      ])} />
      {profileUrl && (
        <JsonLd data={gameCharacterJsonLd({
          name: `${sinner.name_kr} (${sinner.name})`,
          description: sinner.description ?? `Limbus Company 수감자 ${sinner.name_kr}`,
          image: profileUrl,
          url: `${siteUrl}/sinners/${slug}`,
          siteUrl,
        })} />
      )}
      <SinnerDetailClient sinner={sinner} identities={identities} egos={egos} />
    </>
  )
}

import type { Metadata } from 'next'
import { getSinnerById, getIdentities, getEGOs, SINNER_SLUGS } from '@/lib/data/sinners'
import { notFound } from 'next/navigation'
import SinnerDetailClient from './SinnerDetailClient'

export const revalidate = 60

export function generateStaticParams() {
  return SINNER_SLUGS.map(slug => ({ slug }))
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const sinner = await getSinnerById(slug)
  if (!sinner) return {}
  return {
    title: `${sinner.name_kr} (${sinner.name})`,
    description: `${sinner.name_kr}의 모든 인격과 EGO — ${sinner.description ?? `Limbus Company ${sinner.name_kr} 수감자 정보`}`,
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
  return <SinnerDetailClient sinner={sinner} identities={identities} egos={egos} />
}

import type { Metadata } from 'next'
import { Suspense } from 'react'
import { cacheLife } from 'next/cache'
import { getSinnerById, getEGOById, getEGOs } from '@/lib/db/queries'
import { notFound } from 'next/navigation'
import dynamic from 'next/dynamic'
const EGODetailClient = dynamic(() => import('./EGODetailClient'))

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; egoId: string }>
}): Promise<Metadata> {
  const { slug, egoId } = await params
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (!UUID_RE.test(egoId)) return { title: 'EGO를 찾을 수 없습니다', robots: { index: false } }
  const [sinner, ego] = await Promise.all([getSinnerById(slug), getEGOById(egoId)])
  if (!sinner || !ego) return { title: 'EGO를 찾을 수 없습니다', robots: { index: false } }

  const sinStr = ego.sin_affinity ?? ''
  const description = `${sinner.name_kr} ${ego.name_kr ?? ego.name} — ${ego.grade} 등급${sinStr ? `, ${sinStr} 속성` : ''} EGO. 스킬, 패시브, 내성 정보.`
  const canonical = `https://saigo-no-dante.com/sinners/${slug}/ego/${egoId}`

  return {
    title: `${ego.name_kr ?? ego.name} — ${sinner.name_kr}`,
    description,
    alternates: { canonical },
    openGraph: {
      title: `${ego.name_kr ?? ego.name} — ${sinner.name_kr} | 최애의 관리자`,
      description,
      ...(ego.image_url ? { images: [{ url: ego.image_url, width: 512, height: 512 }] } : {}),
    },
  }
}

export async function generateStaticParams() {
  const egos = await getEGOs()
  return egos.map(e => ({ slug: e.sinner_id, egoId: e.id }))
}

export default async function EGODetailPage({ params }: { params: Promise<{ slug: string; egoId: string }> }) {
  'use cache'
  cacheLife('page-1m')
  const { slug, egoId } = await params
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(egoId)) notFound()
  const [sinner, ego] = await Promise.all([getSinnerById(slug), getEGOById(egoId)])
  if (!sinner || !ego) notFound()
  return (
    <Suspense fallback={null}>
      <EGODetailClient sinner={sinner} ego={ego} />
    </Suspense>
  )
}

import { getSinnerById, getEGOById, getEGOs } from '@/lib/data/sinners'
import { notFound } from 'next/navigation'
import EGODetailClient from './EGODetailClient'

export const revalidate = 60

export async function generateStaticParams() {
  const egos = await getEGOs()
  return egos.map(e => ({ slug: e.sinner_id, egoId: e.id }))
}

export default async function EGODetailPage({ params }: { params: Promise<{ slug: string; egoId: string }> }) {
  const { slug, egoId } = await params
  const [sinner, ego] = await Promise.all([getSinnerById(slug), getEGOById(egoId)])
  if (!sinner || !ego) notFound()
  return <EGODetailClient sinner={sinner} ego={ego} />
}

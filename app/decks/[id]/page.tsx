import type { Metadata } from 'next'
import { createAdminClient } from '@/lib/supabase/admin'
import DeckDetailClient from './DeckDetailClient'

type Props = { params: Promise<{ id: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const supabase = createAdminClient()
  const { data } = await supabase
    .schema('limbus')
    .from('decks')
    .select('title, description, tags')
    .eq('id', id)
    .single()

  if (!data) {
    return { title: '덱을 찾을 수 없습니다' }
  }

  const title = data.title
  const description = data.description
    ? data.description.slice(0, 160)
    : `${data.title} — 림버스 컴퍼니 덱 빌드`

  return {
    title,
    description,
    openGraph: {
      title: `${title} | 덱 게시판`,
      description,
    },
  }
}

export default async function DeckDetailPage({ params }: Props) {
  const { id } = await params
  return <DeckDetailClient id={id} />
}

import type { Metadata } from 'next'
import CollectionClient from './CollectionClient'

export const metadata: Metadata = {
  title: '보유 현황',
  description: '림버스 컴퍼니 인격·EGO 보유 현황을 체크하고 URL로 공유하세요.',
  alternates: { canonical: 'https://saigo-no-dante.com/collection' },
}

export default function CollectionPage() {
  return <CollectionClient />
}

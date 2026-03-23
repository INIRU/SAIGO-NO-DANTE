import type { Metadata } from 'next'
import DecksClient from './DecksClient'

export const metadata: Metadata = {
  title: '덱 게시판',
  description: '림버스 컴퍼니 커뮤니티 덱 빌드를 탐색하고 공유하세요.',
  alternates: { canonical: 'https://saigo-no-dante.com/decks' },
}

export default function DecksPage() {
  return <DecksClient />
}

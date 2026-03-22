import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '덱 게시판',
  description: '림버스 컴퍼니 덱 공유 게시판 — 인격 편성, EGO 조합, 운영법을 공유하세요.',
  alternates: { canonical: 'https://saigo-no-dante.com/decks' },
}

export default function DecksLayout({ children }: { children: React.ReactNode }) {
  return children
}

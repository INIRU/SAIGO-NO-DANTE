'use client'
import dynamic from 'next/dynamic'
import DeckBuilderSkeleton from '@/components/decks/DeckBuilderSkeleton'

const Inner = dynamic(() => import('./DeckBuilderClient'), {
  ssr: false,
  loading: () => <DeckBuilderSkeleton />,
})

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default function DeckBuilderWrapper(props: any) {
  return <Inner {...props} />
}

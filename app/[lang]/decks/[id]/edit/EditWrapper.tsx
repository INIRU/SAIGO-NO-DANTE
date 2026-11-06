'use client'
import dynamic from 'next/dynamic'
import DeckBuilderSkeleton from '@/features/decks/components/DeckBuilderSkeleton'

const Inner = dynamic(() => import('../../new/DeckBuilderClient'), {
  ssr: false,
  loading: () => <DeckBuilderSkeleton />,
})

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default function EditWrapper(props: any) {
  return <Inner {...props} />
}

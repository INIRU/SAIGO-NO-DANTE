'use client'
import type { ComponentProps } from 'react'
import dynamic from 'next/dynamic'
import DeckBuilderSkeleton from '@/features/decks/components/DeckBuilderSkeleton'

const Inner = dynamic(() => import('./DeckBuilderClient'), {
  ssr: false,
  loading: () => <DeckBuilderSkeleton />,
})

export default function DeckBuilderWrapper(props: ComponentProps<typeof Inner>) {
  return <Inner {...props} />
}

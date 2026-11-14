'use client'
import type { ComponentProps } from 'react'
import dynamic from 'next/dynamic'
import DeckBuilderSkeleton from '@/features/decks/components/DeckBuilderSkeleton'

const Inner = dynamic(() => import('../../new/DeckBuilderClient'), {
  ssr: false,
  loading: () => <DeckBuilderSkeleton />,
})

export default function EditWrapper(props: ComponentProps<typeof Inner>) {
  return <Inner {...props} />
}

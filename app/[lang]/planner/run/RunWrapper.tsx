'use client'
import type { ComponentProps } from 'react'
import dynamic from 'next/dynamic'
import RunSkeleton from '@/features/planner/components/RunSkeleton'

const Inner = dynamic(() => import('./RunClient'), {
  ssr: false,
  loading: () => <RunSkeleton />,
})

export default function RunWrapper(props: ComponentProps<typeof Inner>) {
  return <Inner {...props} />
}

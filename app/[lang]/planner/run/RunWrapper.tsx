'use client'
import dynamic from 'next/dynamic'
import RunSkeleton from '@/features/planner/components/RunSkeleton'

const Inner = dynamic(() => import('./RunClient'), {
  ssr: false,
  loading: () => <RunSkeleton />,
})

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default function RunWrapper(props: any) {
  return <Inner {...props} />
}

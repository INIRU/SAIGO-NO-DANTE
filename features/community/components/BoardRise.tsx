'use client'

import useSWR from 'swr'
import { ChevronUp } from 'lucide-react'
import type { RisingFeed } from '@/features/community/server/rising-feed'

/**
 * The rising lists of one board. `feed` is null while loading or when the read fails (the database function may not be there
 * yet); `loading` is true only until the first answer or failure, so the shelf can hold its place meanwhile.
 */
export function useRising(kind: 'deck' | 'planner'): { feed: RisingFeed | null; loading: boolean } {
  const { data, error } = useSWR<RisingFeed>(`/api/discovery/rising?kind=${kind}`, { revalidateOnFocus: false })
  return { feed: data ?? null, loading: data === undefined && !error }
}

/** The rise: a small up chevron and a Bebas multiplier. */
export function RiseValue({ rise, className = '' }: { rise: number; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-0.5 text-[var(--gold-light)] ${className}`}>
      <ChevronUp size={14} strokeWidth={3} aria-hidden="true" />
      <span className="font-[family-name:var(--font-title)] text-[1.375rem] leading-none tabular-nums">×{rise >= 99 ? 99 : rise.toFixed(1)}</span>
    </span>
  )
}

/** How many recent posts field an identity: the same Bebas figure as the rise. */
export function RisingCount({ count }: { count: number }) {
  return <span className="font-[family-name:var(--font-title)] text-[1.375rem] leading-none tabular-nums text-[var(--gold-light)]">×{count}</span>
}

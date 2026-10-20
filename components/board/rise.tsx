'use client'

import useSWR from 'swr'
import { ChevronUp } from 'lucide-react'
import type { RisingFeed } from '@/lib/discovery/rising-feed'

async function read(url: string): Promise<RisingFeed> {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`rising ${response.status}`)
  return response.json()
}

/** The rising lists of one board; null while loading or when the read fails (the database function may not be there yet). */
export function useRising(kind: 'deck' | 'planner'): RisingFeed | null {
  return useSWR(`/api/discovery/rising?kind=${kind}`, read, { revalidateOnFocus: false }).data ?? null
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

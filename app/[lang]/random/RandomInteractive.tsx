'use client'

import { useSearchParams } from 'next/navigation'
import RandomClient from './RandomClient'
import type { Sinner, Identity, EGO } from '@/lib/types/index'

type Props = {
  sinners: Sinner[]
  identities: Identity[]
  egos: EGO[]
}

/**
 * Thin client boundary that reads useSearchParams (requires Suspense).
 * Passes the resolved URL code down to RandomClient as a plain string prop,
 * keeping RandomClient free of the CSR-bailout hook.
 */
export default function RandomInteractive({ sinners, identities, egos }: Props) {
  const searchParams = useSearchParams()
  const urlCode = searchParams?.get('code') ?? undefined

  return (
    <RandomClient
      sinners={sinners}
      identities={identities}
      egos={egos}
      urlCode={urlCode}
    />
  )
}

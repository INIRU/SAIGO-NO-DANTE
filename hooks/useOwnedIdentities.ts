'use client'

import useSWR from 'swr'
import { useSession } from 'next-auth/react'
import { decodeCollectionAsync, withBaseIdentities, type CollectionData } from '@/lib/collection'

/** The signed-in user's saved collection (identity and E.G.O ids, LCB identities included); null without one. */
async function loadOwned(): Promise<Set<string> | null> {
  const profile = await fetch('/api/profile').then(r => r.ok ? r.json() : null) as { profile?: { collection_code?: string | null } } | null
  const code = profile?.profile?.collection_code
  if (!code) return null // no saved collection: skip the catalog download entirely
  const catalog = await fetch('/api/collection').then(r => r.ok ? r.json() : null) as CollectionData | null
  if (!catalog?.sinners?.length) return null
  const owned = await decodeCollectionAsync(code, catalog.sinners, catalog.identities, catalog.egos)
  return owned.size ? withBaseIdentities(owned, catalog.identities) : null
}

export const OWNED_KEY = 'owned-collection'

/** One request per session however many cards ask (SWR dedupes by key). */
export function useOwnedIdentities(): Set<string> | null {
  const { status } = useSession()
  const { data } = useSWR(status === 'authenticated' ? OWNED_KEY : null, loadOwned, {
    revalidateOnFocus: false, revalidateIfStale: false, dedupingInterval: 10 * 60_000,
  })
  return data ?? null
}


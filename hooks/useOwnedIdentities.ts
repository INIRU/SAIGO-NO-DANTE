'use client'

import useSWR from 'swr'
import { useSession } from 'next-auth/react'
import { decodeCollectionAsync, withBaseIdentities, type CollectionData } from '@/lib/collection'

const DEVICE_CODE_KEY = 'limbus-collection'

/** The saved collection (identity and E.G.O ids, LCB identities included); null without one. A signed-in user's profile code comes first, the code saved on this device is the fallback and a visitor's only source. */
async function loadOwned(signedIn: boolean): Promise<Set<string> | null> {
  let code: string | null | undefined = null
  if (signedIn) {
    const profile = await fetch('/api/profile').then(r => r.ok ? r.json() : null) as { profile?: { collection_code?: string | null } } | null
    code = profile?.profile?.collection_code
  }
  code ||= localStorage.getItem(DEVICE_CODE_KEY)
  if (!code) return null // no saved collection: skip the catalog download entirely
  const catalog = await fetch('/api/collection').then(r => r.ok ? r.json() : null) as CollectionData | null
  if (!catalog?.sinners?.length) return null
  const owned = await decodeCollectionAsync(code, catalog.sinners, catalog.identities, catalog.egos)
  return owned.size ? withBaseIdentities(owned, catalog.identities) : null
}

const OWNED_KEY = 'owned-collection'

/** One request per session however many cards ask (SWR dedupes by key). */
export function useOwnedIdentities(): Set<string> | null {
  const { status } = useSession()
  const signedIn = status === 'authenticated'
  const { data } = useSWR(status === 'loading' ? null : signedIn ? OWNED_KEY : `${OWNED_KEY}:device`, () => loadOwned(signedIn), {
    revalidateOnFocus: false, revalidateIfStale: false, dedupingInterval: 10 * 60_000,
  })
  return data ?? null
}

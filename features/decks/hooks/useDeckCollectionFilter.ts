'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { decodeCollectionAsync, withBaseIdentities, type CollectionData } from '@/lib/collection'
import { useOwnedIdentities } from '@/hooks/useOwnedIdentities'

type SetFilterQuery = (values: { ownedIdentity?: boolean | null; ownedEgo?: boolean | null }) => unknown

/**
 * The "only what I own" filters of the deck list: the owned set comes from a pasted collection code or from the
 * signed-in profile (loaded once on mount). `effectiveOwned` falls back to the saved owned identities, so a link with
 * `oi=1` filters at once.
 */
export function useDeckCollectionFilter({ authStatus, filterOwnedIdentity, filterOwnedEgo, setFilterQuery }: {
  authStatus: string
  filterOwnedIdentity: boolean
  filterOwnedEgo: boolean
  setFilterQuery: SetFilterQuery
}) {
  const [ownedIds, setOwnedIds] = useState<Set<string> | null>(null)
  const [collectionLoading, setCollectionLoading] = useState(false)
  const [hasCollection, setHasCollection] = useState(false)
  const [collectionData, setCollectionData] = useState<CollectionData | null>(null)
  const [codeInput, setCodeInput] = useState('')
  const [codeError, setCodeError] = useState(false)
  const collectionRequestRef = useRef<Promise<CollectionData | null> | null>(null)

  const ensureCollectionData = useCallback(async () => {
    if (collectionData) return collectionData
    if (!collectionRequestRef.current) {
      setCollectionLoading(true)
      collectionRequestRef.current = fetch('/api/collection')
        .then(r => r.json())
        .then((d: CollectionData) => {
          if (!d.sinners?.length) return null
          setCollectionData(d)
          return d
        })
        .catch(() => null)
        .finally(() => {
          collectionRequestRef.current = null
          setCollectionLoading(false)
        })
    }
    return collectionRequestRef.current
  }, [collectionData])

  const loadProfileCollection = useCallback(async () => {
    if (authStatus !== 'authenticated') return false
    setCollectionLoading(true)
    try {
      const data = await ensureCollectionData()
      if (!data) return false
      const profileData = await fetch('/api/profile').then(r => r.json()) as { profile?: { collection_code?: string | null } }
      const code = profileData.profile?.collection_code
      if (!code) return false
      const ticked = await decodeCollectionAsync(code, data.sinners, data.identities, data.egos)
      // An empty code is invalid; LCB identities are added only after that check.
      const decoded = ticked.size ? withBaseIdentities(ticked, data.identities) : ticked
      setOwnedIds(decoded)
      setHasCollection(true)
      return true
    } catch {
      return false
    } finally {
      setCollectionLoading(false)
    }
  }, [authStatus, ensureCollectionData])

  // ── Auto-load collection for logged-in user ──
  useEffect(() => {
    void loadProfileCollection()
  }, [loadProfileCollection])

  const applyCollectionCode = useCallback(async (rawInput: string) => {
    setCodeError(false)
    let code = rawInput.trim()
    try {
      const url = new URL(code)
      code = url.searchParams.get('code') ?? code
    } catch { /* not a URL, use as-is */ }
    if (!code) return
    try {
      const data = await ensureCollectionData()
      if (!data) { setCodeError(true); return }
      const ticked = await decodeCollectionAsync(code, data.sinners, data.identities, data.egos)
      // An empty code is invalid; LCB identities are added only after that check.
      const decoded = ticked.size ? withBaseIdentities(ticked, data.identities) : ticked
      if (decoded.size === 0) { setCodeError(true); return }
      setOwnedIds(decoded)
      setHasCollection(true)
    } catch {
      setCodeError(true)
    }
  }, [ensureCollectionData])

  const toggleFilterOwnedIdentity = useCallback(async () => {
    let hasOwnedIds = ownedIds !== null
    if (!hasOwnedIds && authStatus === 'authenticated') {
      hasOwnedIds = await loadProfileCollection()
    }
    if (!hasOwnedIds) return
    void setFilterQuery({ ownedIdentity: !filterOwnedIdentity })
  }, [authStatus, filterOwnedIdentity, loadProfileCollection, ownedIds, setFilterQuery])

  const toggleFilterOwnedEgo = useCallback(async () => {
    let hasOwnedIds = ownedIds !== null
    if (!hasOwnedIds && authStatus === 'authenticated') {
      hasOwnedIds = await loadProfileCollection()
    }
    if (!hasOwnedIds) return
    void setFilterQuery({ ownedEgo: !filterOwnedEgo })
  }, [authStatus, filterOwnedEgo, loadProfileCollection, ownedIds, setFilterQuery])

  const clearCollection = () => {
    setOwnedIds(null)
    setHasCollection(false)
    void setFilterQuery({ ownedIdentity: null, ownedEgo: null })
    setCodeInput('')
  }

  const profileOwned = useOwnedIdentities()
  const effectiveOwned = ownedIds ?? profileOwned

  return {
    collectionLoading, hasCollection, codeInput, codeError, effectiveOwned,
    changeCodeInput: (value: string) => { setCodeInput(value); setCodeError(false) },
    applyCollectionCode, toggleFilterOwnedIdentity, toggleFilterOwnedEgo, clearCollection,
  }
}

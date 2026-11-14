'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { parseAsBoolean, useQueryState } from 'nuqs'
import { decodeCollectionAsync, withBaseIdentities, type CollectionData } from '@/lib/collection'
import { useOwnedIdentities } from '@/hooks/useOwnedIdentities'

/**
 * The "only plans I can form" filters of the community board: the owned set comes from a pasted collection code or
 * from the signed-in profile (loaded once on mount). `effectiveOwned` falls back to the saved owned identities, so a
 * link with `oi=1` filters at once.
 */
export function usePlanCollectionFilter(authStatus: string) {
  // URL에 남긴다: 게시판 위 "보유 인격으로 편성할 수 있는 플랜만 보기" 링크가 이 필터를 켠 채로 연다(덱 게시판과 같은 oi)
  const [filterOwnedIdentity, setFilterOwnedIdentity] = useQueryState('oi', parseAsBoolean.withDefault(false))
  const [filterOwnedEgo, setFilterOwnedEgo] = useState(false)
  const [ownedIds, setOwnedIds] = useState<Set<string> | null>(null)
  const [hasCollection, setHasCollection] = useState(false)
  const [collectionLoading, setCollectionLoading] = useState(false)
  const [collectionData, setCollectionData] = useState<CollectionData | null>(null)
  const [codeInput, setCodeInput] = useState('')
  const [codeError, setCodeError] = useState(false)
  const collectionDataRef = useRef<CollectionData | null>(null)
  const collectionRequestRef = useRef<Promise<CollectionData | null> | null>(null)

  useEffect(() => {
    collectionDataRef.current = collectionData
  }, [collectionData])

  const loadCollectionData = useCallback(async () => {
    if (collectionDataRef.current) return collectionDataRef.current
    if (!collectionRequestRef.current) {
      setCollectionLoading(true)
      collectionRequestRef.current = fetch('/api/collection')
        .then(r => r.json())
        .then((d: CollectionData) => {
          if (d.sinners?.length > 0) {
            collectionDataRef.current = d
            setCollectionData(d)
            return d
          }
          return null
        })
        .catch(() => null)
        .finally(() => {
          collectionRequestRef.current = null
          setCollectionLoading(false)
        })
    }
    return collectionRequestRef.current
  }, [])

  const loadProfileCollection = useCallback(async () => {
    if (authStatus !== 'authenticated') return false
    setCollectionLoading(true)
    try {
      const data = await loadCollectionData()
      if (!data) return false
      const profileData = await fetch('/api/profile').then(r => r.json()) as { profile?: { collection_code?: string | null } }
      const code = profileData.profile?.collection_code
      if (!code) return false
      const ticked = await decodeCollectionAsync(code, data.sinners, data.identities, data.egos)
      // An empty code is invalid; LCB identities are added only after that check.
      const decoded = ticked.size ? withBaseIdentities(ticked, data.identities) : ticked
      if (decoded.size === 0) return false
      setOwnedIds(decoded)
      setHasCollection(true)
      return true
    } catch {
      return false
    } finally {
      setCollectionLoading(false)
    }
  }, [authStatus, loadCollectionData])

  // 로그인 유저: 프로필에서 컬렉션 코드 자동 로드
  useEffect(() => {
    void loadProfileCollection()
  }, [loadProfileCollection])

  // 보유 코드 적용
  const applyCollectionCode = useCallback(async (rawInput: string) => {
    setCodeError(false)
    let code = rawInput.trim()
    try {
      const url = new URL(code)
      code = url.searchParams.get('code') ?? code
    } catch {
      // URL이 아닌 경우 그대로 사용
    }
    if (!code) return
    try {
      const data = await loadCollectionData()
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
  }, [loadCollectionData])

  const toggleFilterOwnedIdentity = useCallback(async () => {
    let hasOwnedIds = ownedIds !== null
    if (!hasOwnedIds) {
      hasOwnedIds = await loadProfileCollection()
    }
    if (!hasOwnedIds) return
    void setFilterOwnedIdentity(prev => !prev)
  }, [loadProfileCollection, ownedIds])

  const toggleFilterOwnedEgo = useCallback(async () => {
    let hasOwnedIds = ownedIds !== null
    if (!hasOwnedIds) {
      hasOwnedIds = await loadProfileCollection()
    }
    if (!hasOwnedIds) return
    setFilterOwnedEgo(prev => !prev)
  }, [loadProfileCollection, ownedIds])

  const clearCollectionFilters = () => {
    setOwnedIds(null)
    setHasCollection(false)
    void setFilterOwnedIdentity(false)
    setFilterOwnedEgo(false)
    setCodeInput('')
    setCodeError(false)
    setCollectionLoading(false)
  }

  const profileOwned = useOwnedIdentities()
  const effectiveOwned = ownedIds ?? profileOwned

  return {
    filterOwnedIdentity, filterOwnedEgo, hasCollection, collectionLoading, codeInput, codeError, effectiveOwned,
    changeCodeInput: (value: string) => { setCodeInput(value); setCodeError(false) },
    applyCollectionCode, toggleFilterOwnedIdentity, toggleFilterOwnedEgo, clearCollectionFilters,
  }
}

'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { PlanSummary } from '@/features/planner/components/PlanCard'
import { showError } from '@/lib/toast'

function mergePlanRows(existing: PlanSummary[], incoming: PlanSummary[]) {
  const byId = new Map<string, PlanSummary>()
  const orderedIds: string[] = []

  for (const plan of [...existing, ...incoming]) {
    if (!byId.has(plan.id)) orderedIds.push(plan.id)
    byId.set(plan.id, plan)
  }

  return orderedIds.map(id => byId.get(id)!)
}

interface Options {
  initialPlans?: PlanSummary[]
  initialTotal?: number
  /** The filters and sort as a query string: a new key starts the list over. */
  serverQueryKey: string
  /** Nothing is loaded while the list is hidden (the discovery shelf shows instead). */
  listVisible: boolean
  buildSearchParams: (offset: number) => URLSearchParams
  pageSize: number
  errorMessage: string
}

/** The community plan list: the first page, "more" pages, and what a failed request leaves behind. */
export function usePlanList({ initialPlans, initialTotal, serverQueryKey, listVisible, buildSearchParams, pageSize, errorMessage }: Options) {
  const [plans, setPlans] = useState<PlanSummary[]>(initialPlans ?? [])
  const [loading, setLoading] = useState(initialPlans === undefined)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(
    initialPlans !== undefined && initialTotal !== undefined
      ? initialPlans.length < initialTotal
      : true
  )
  const [total, setTotal] = useState(initialTotal ?? 0)
  const offsetRef = useRef(initialPlans?.length ?? 0)
  // loadMore reads the rows shown now without putting them in its dependencies
  const plansRef = useRef(plans)
  useEffect(() => { plansRef.current = plans }, [plans])
  const initialDataKey = useRef<string | null>(initialPlans !== undefined ? (() => {
    const params = new URLSearchParams()
    params.set('sort', 'latest')
    params.sort()
    return params.toString()
  })() : null)
  const planRequestId = useRef(0)
  const loadMoreRequestId = useRef(0)
  const loadMoreAbortRef = useRef<AbortController | null>(null)
  const latestRequestKeyRef = useRef('')

  useEffect(() => {
    if (!listVisible) return
    latestRequestKeyRef.current = serverQueryKey
    if (initialDataKey.current === serverQueryKey && initialPlans !== undefined) {
      initialDataKey.current = null
      setLoading(false)
      setLoadingMore(false)
      setHasMore(initialTotal === undefined ? initialPlans.length >= pageSize : initialPlans.length < initialTotal)
      offsetRef.current = initialPlans.length
      return
    }

    loadMoreAbortRef.current?.abort()
    loadMoreRequestId.current += 1
    const requestId = planRequestId.current + 1
    planRequestId.current = requestId
    const controller = new AbortController()
    const hasExistingPlans = plans.length > 0
    setLoading(!hasExistingPlans)
    setLoadingMore(false)
    setHasMore(true)

    fetch(`/api/planner?${buildSearchParams(0).toString()}`, { signal: controller.signal })
      .then(res => res.ok ? res.json() : Promise.reject(new Error('planner fetch failed')))
      .then(json => {
        if (planRequestId.current !== requestId || latestRequestKeyRef.current !== serverQueryKey) return
        const fetched: PlanSummary[] = json.plans ?? []
        const nextTotal = json.total ?? 0
        setTotal(nextTotal)
        setPlans(fetched)
        setHasMore(fetched.length < nextTotal)
        offsetRef.current = fetched.length
      })
      .catch(error => {
        if (error instanceof DOMException && error.name === 'AbortError') return
        if (planRequestId.current !== requestId || latestRequestKeyRef.current !== serverQueryKey) return
        showError(errorMessage)
        setPlans([])
        setHasMore(false)
        offsetRef.current = 0
      })
      .finally(() => {
        if (planRequestId.current !== requestId || latestRequestKeyRef.current !== serverQueryKey) return
        setLoading(false)
      })

    return () => controller.abort()
  }, [listVisible, serverQueryKey, buildSearchParams, initialPlans, initialTotal]) // eslint-disable-line react-hooks/exhaustive-deps

  const loadMore = useCallback(() => {
    if (loading || loadingMore || !hasMore) return
    setLoadingMore(true)
    loadMoreAbortRef.current?.abort()
    const requestId = loadMoreRequestId.current + 1
    loadMoreRequestId.current = requestId
    const requestQueryKey = serverQueryKey
    const controller = new AbortController()
    loadMoreAbortRef.current = controller

    fetch(`/api/planner?${buildSearchParams(offsetRef.current).toString()}`, { signal: controller.signal })
      .then(res => res.ok ? res.json() : Promise.reject(new Error('planner fetch failed')))
      .then(json => {
        if (loadMoreRequestId.current !== requestId || latestRequestKeyRef.current !== requestQueryKey) return
        const fetched: PlanSummary[] = json.plans ?? []
        const nextTotal = json.total ?? 0
        setTotal(nextTotal)
        if (fetched.length === 0) {
          setHasMore(false)
          return
        }
        const merged = mergePlanRows(plansRef.current, fetched)
        offsetRef.current = merged.length
        setHasMore(merged.length < nextTotal)
        setPlans(merged)
      })
      .catch(error => {
        if (error instanceof DOMException && error.name === 'AbortError') return
        if (loadMoreRequestId.current !== requestId || latestRequestKeyRef.current !== requestQueryKey) return
        showError(errorMessage)
        setHasMore(false)
      })
      .finally(() => {
        if (loadMoreRequestId.current === requestId) loadMoreAbortRef.current = null
        if (loadMoreRequestId.current === requestId && latestRequestKeyRef.current === requestQueryKey) setLoadingMore(false)
      })
  }, [loading, loadingMore, hasMore, serverQueryKey, buildSearchParams, errorMessage])

  useEffect(() => {
    loadMoreAbortRef.current?.abort()
    loadMoreRequestId.current += 1
    setLoadingMore(false)
  }, [serverQueryKey])

  return { plans, loading, loadingMore, hasMore, total, loadMore }
}

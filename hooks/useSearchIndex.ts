'use client'

import { useCallback, useEffect, useState } from 'react'
import { STORAGE_BASE } from '@/lib/constants/game'
import { expandIndex, type IndexEntry } from '@/lib/search/engine'

const loads = new Map<string, Promise<IndexEntry[]>>()

/** 언어별 검색 색인을 한 번만 받는다. 실패하면 다음 호출에서 다시 받는다. 검색 버튼 hover 때 미리 불러도 된다 */
export function loadSearchIndex(lang: string): Promise<IndexEntry[]> {
  let load = loads.get(lang)
  if (!load) {
    load = fetch(`/api/search/index?lang=${lang}`)
      .then(res => res.ok ? res.json() : Promise.reject(new Error(String(res.status))))
      .then((data: { entries: IndexEntry[] }) => expandIndex(data.entries, STORAGE_BASE))
    load.catch(() => loads.delete(lang))
    loads.set(lang, load)
  }
  return load
}

export function useSearchIndex(lang: string, enabled: boolean) {
  const [state, setState] = useState<{ lang: string; entries: IndexEntry[] | null; failed: boolean }>({ lang, entries: null, failed: false })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (!enabled) return
    let live = true
    loadSearchIndex(lang).then(
      entries => { if (live) setState({ lang, entries, failed: false }) },
      error => { console.error('search index failed', error); if (live) setState({ lang, entries: null, failed: true }) },
    )
    return () => { live = false }
  }, [lang, enabled, attempt])

  const current = state.lang === lang ? state : { entries: null, failed: false }
  const retry = useCallback(() => { setState(s => ({ ...s, failed: false })); setAttempt(n => n + 1) }, [])
  return { entries: current.entries, failed: current.failed, retry }
}

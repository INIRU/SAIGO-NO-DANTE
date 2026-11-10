'use client'

import useSWR from 'swr'

/**
 * Picker suggestions from `/api/discovery/suggest`. `data` is null when `url` is null or the read fails (the picker then shows
 * no group); `loading` is true from the moment a url is asked until the answer or the failure arrives (the picker holds the
 * group's place with a skeleton).
 */
export function useSuggestionState<T>(url: string | null): { data: T | null; loading: boolean } {
  const { data, error } = useSWR<T>(url, { revalidateOnFocus: false, shouldRetryOnError: false, dedupingInterval: 300_000 })
  return { data: data ?? null, loading: url !== null && data === undefined && !error }
}

/** The suggestions alone: null while loading, when `url` is null, or when the read fails. */
export function useSuggestions<T>(url: string | null): T | null {
  return useSuggestionState<T>(url).data
}

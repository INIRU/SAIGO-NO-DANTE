'use client'

import useSWR from 'swr'

const read = async (url: string) => {
  const response = await fetch(url)
  if (!response.ok) throw new Error(String(response.status))
  return response.json()
}

/** Picker suggestions from `/api/discovery/suggest`. null while loading, when `url` is null, or when the read fails (the picker then shows no group). */
export function useSuggestions<T>(url: string | null): T | null {
  const { data } = useSWR<T>(url, read, { revalidateOnFocus: false, shouldRetryOnError: false, dedupingInterval: 300_000 })
  return data ?? null
}

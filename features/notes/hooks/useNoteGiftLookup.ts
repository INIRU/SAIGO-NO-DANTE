'use client'

import { useMemo } from 'react'
import useSWR from 'swr'
import { fetchJson } from '@/lib/utils/http'
import type { NoteEgoGiftEntry } from '@/features/notes/lib/note-entries'

export const fetchNoteGifts = (url: string) => fetchJson<NoteEgoGiftEntry[]>(url)

/** Gift lookup for one-line previews (cards). Loads the cached gift list once, only when the text mentions a gift. */
export function useNoteGiftLookup(text: string): Record<string, NoteEgoGiftEntry> {
  const { data } = useSWR(text.includes('[g:') ? '/api/ego-gifts' : null, fetchNoteGifts, { revalidateOnFocus: false, revalidateIfStale: false })
  return useMemo(() => Object.fromEntries((data ?? []).filter(gift => gift.name && gift.keyword).map(gift => [gift.name, { ...gift, grade: gift.grade ?? '1' }])), [data])
}

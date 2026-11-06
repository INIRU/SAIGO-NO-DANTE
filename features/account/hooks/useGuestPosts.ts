'use client'

import { useCallback, useEffect, useState } from 'react'
import useSWR from 'swr'
import { GUEST_KEY_HEADER, GUEST_KEY_STORAGE, guestHeaders, readGuestKey } from '@/features/account/lib/guest-key'

export type GuestPost = { id: string; title: string; created_at: string }
export type GuestPosts = { decks: GuestPost[]; plans: GuestPost[] }

async function fetchGuestPosts([, key]: readonly [string, string]): Promise<GuestPosts> {
  const res = await fetch('/api/guest/posts', { headers: { [GUEST_KEY_HEADER]: key }, cache: 'no-store' })
  if (!res.ok) throw new Error(String(res.status))
  return res.json()
}

/**
 * This browser's guest key and the posts written with it. The key is read after mount (localStorage);
 * `enabled` false skips the request, e.g. signed-in visitors on a detail page.
 */
export function useGuestPosts(enabled = true) {
  const [key, setKey] = useState<string | null>(null)
  const [keyRead, setKeyRead] = useState(false)
  useEffect(() => { setKey(readGuestKey()); setKeyRead(true) }, [])
  const posts = useSWR(enabled && key ? (['guest-posts', key] as const) : null, fetchGuestPosts, { revalidateOnFocus: false })
  const reloadKey = useCallback(() => setKey(readGuestKey()), [])
  return { key, keyRead, reloadKey, posts }
}

export type GuestRecoverTarget = { kind: 'deck' | 'plan'; id: string } | { kind: 'support' | 'want'; code: string }

/**
 * Proves a guest post is this visitor's with its password; this browser's key (made if there is none) owns it afterwards.
 * Throws an Error whose message is the server's refusal code (guestRecoverMessage in features/account/lib/guest-copy.ts names it).
 */
export async function recoverGuestPost(target: GuestRecoverTarget, pin: string) {
  const res = await fetch('/api/guest/recover', { method: 'POST', headers: { 'Content-Type': 'application/json', ...guestHeaders(false) }, body: JSON.stringify({ ...target, pin }) })
  if (!res.ok) throw new Error((await res.json().catch(() => null))?.code ?? 'failed')
}

/** Moves every post of the key to the signed-in account; the key is dropped from this browser afterwards. */
export async function claimGuestPosts(key: string): Promise<{ decks: number; plans: number }> {
  const res = await fetch('/api/guest/claim', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key }) })
  const data = await res.json().catch(() => null)
  if (!res.ok) throw new Error(data?.error ?? String(res.status))
  try { localStorage.removeItem(GUEST_KEY_STORAGE) } catch { /* nothing stored */ }
  return { decks: Number(data?.decks) || 0, plans: Number(data?.plans) || 0 }
}

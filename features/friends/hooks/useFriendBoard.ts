'use client'

import { useMemo } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { useSession } from 'next-auth/react'
import useSWR from 'swr'
import { fetchNoteAssets } from '@/components/notes/NoteBlockViewer'
import { assetName, type NoteAssetData } from '@/lib/notes/assets'
import { GUEST_KEY_HEADER, guestHeaders, readGuestKey } from '@/lib/guest/key'
import { WANT_LIMIT, type RequestStatus, type StoredSlot, type Visibility } from '@/features/friends/lib/codes'
import { EGO_GRADES, type SupportSlot } from '@/features/friends/components/SupportStrips'

/** What the friend code screens share: the API's shapes, the catalogue lookups and the requests. */
export type Kind = 'support' | 'want'
export const KINDS: Kind[] = ['support', 'want']
export type Post = {
  id: string; visibility: Visibility; slots: StoredSlot[]; identityIds: string[]; mine: boolean; bumpedAt: string; seenAt: string
  author: string | null; authorId: string | null; guestTag: string | null; code: string | null; received?: string[]; expiresAt?: string
  /** approval posts: the viewer's own request (others' posts), or everyone's requests (the viewer's own post). */
  request?: RequestStatus | null; requests?: { id: string; name: string | null; userId: string | null; guestTag: string | null; status: RequestStatus; createdAt: string }[]
}
export type Listing = { posts: Post[]; own: Post | null; wanted?: { identityId: string; count: number }[] }
export type Slots = (SupportSlot | null)[]
export const emptySlots = (kind: Kind): Slots => Array(kind === 'support' ? 12 : WANT_LIMIT).fill(null)

/** What a save sends, in a fixed order: equal JSON means nothing changed since the saved post. */
export const supportBody = (slots: Slots) => slots.flatMap((slot, index) => slot
  ? [{ slot: index, identity: slot.identityId, egos: Object.fromEntries(EGO_GRADES.flatMap(grade => slot.egos[grade] ? [[grade, slot.egos[grade]]] : [])) }] : [])
export const wantBody = (slots: Slots) => [...new Set(slots.flatMap(slot => slot ? [slot.identityId] : []))]

/** The viewer's last friend code on this device, so the exchange window and the composer start with it. */
const CODE_STORAGE = 'snd-friend-code'
export const readOwnCode = () => { try { return localStorage.getItem(CODE_STORAGE) ?? '' } catch { return '' } }
export const rememberOwnCode = (code: string) => { try { localStorage.setItem(CODE_STORAGE, code) } catch { /* private mode: typed again next time */ } }

/** Stored posts name identities by id: the catalogue turns them into the slots the strips draw. */
export function useFriendCatalog() {
  const lang = useLocale()
  const identities = useSWR('/api/notes/assets?kind=identity&catalog=1', fetchNoteAssets, { revalidateOnFocus: false })
  return useMemo(() => {
    const byId = new Map((identities.data ?? []).map(asset => [asset.id, asset] as [string, NoteAssetData]))
    const slotOf = (id: string, egos: SupportSlot['egos'] = {}): SupportSlot | null => {
      const asset = byId.get(id)
      return asset?.identity ? { identityId: asset.id, identity: asset.identity, name: assetName(asset, lang), egos } : null
    }
    return {
      ready: byId.size > 0, slotOf,
      supportSlots: (stored: StoredSlot[]) => { const next = emptySlots('support'); for (const item of stored) next[item.slot] = slotOf(item.identity, item.egos); return next },
      wantSlots: (ids: string[]) => Array.from({ length: WANT_LIMIT }, (_, index) => ids[index] ? slotOf(ids[index]) : null),
    }
  }, [identities.data, lang])
}

/** Requests of the board. Readers send the guest key only if this browser already has one; writers create it. */
export function useFriendApi() {
  const t = useTranslations('friends'), signedIn = useSession().status === 'authenticated'
  return useMemo(() => {
    const message = (data: { code?: string; error?: string }) => data.code && t.has(`errors.${data.code}`) ? t(`errors.${data.code}`) : data.error || t('errors.failed')
    return {
      signedIn,
      load: async (url: string) => {
        const guest = signedIn ? null : readGuestKey()
        const response = await fetch(url, { headers: guest ? { [GUEST_KEY_HEADER]: guest } : {} })
        if (!response.ok) throw Error('list')
        return await response.json() as Listing
      },
      send: async (url: string, method: string, body?: unknown) => {
        const response = await fetch(url, { method, headers: { 'Content-Type': 'application/json', ...guestHeaders(signedIn) }, body: body === undefined ? undefined : JSON.stringify(body) })
        const data = await response.json().catch(() => ({}))
        if (!response.ok) throw Error(message(data))
        return data
      },
    }
  }, [signedIn, t])
}

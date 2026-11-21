'use client'
import { useLocale } from 'next-intl'
import { signOut } from 'next-auth/react'
import { forgetPushSubscription } from '@/hooks/usePushSubscription'

type Steps = { forget: () => Promise<unknown>; request: () => Promise<{ ok: boolean }>; leave: () => Promise<unknown> | void }

/** The push subscription goes first (as on sign-out), so a deleted account never keeps a browser subscribed. */
export async function deleteAccount({ forget, request, leave }: Steps) {
  await forget()
  if (!(await request()).ok) throw Error()
  await leave()
}

/** Sign-out and account deletion, shared by the rail and the settings tab. `removeAccount` throws when it fails. */
export function useAccountActions() {
  const callbackUrl = `/${useLocale()}`
  const leave = () => signOut({ callbackUrl })
  return {
    logout: () => void forgetPushSubscription().finally(leave),
    removeAccount: () => deleteAccount({ forget: forgetPushSubscription, request: () => fetch('/api/profile', { method: 'DELETE' }), leave }),
  }
}

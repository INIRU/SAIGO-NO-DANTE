'use client'

import { Suspense } from 'react'
import dynamic from 'next/dynamic'
import { SessionProvider, useSession } from 'next-auth/react'
import { SessionActivityPing } from './SessionActivityPing'

// Both notices apply to signed-in accounts only; their modal code (Radix Dialog, motion) loads once someone signs in.
const LegalVersionModal = dynamic(() => import('./LegalVersionModal'), { ssr: false })
const SuspensionNoticeModal = dynamic(() => import('./SuspensionNoticeModal'), { ssr: false })

function SignedInNotices() {
  const { status } = useSession()
  if (status !== 'authenticated') return null
  return (
    <>
      <SuspensionNoticeModal />
      <LegalVersionModal />
    </>
  )
}

export default function Provider({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <Suspense fallback={null}>
        <SessionActivityPing />
        <SignedInNotices />
      </Suspense>
      {children}
    </SessionProvider>
  )
}

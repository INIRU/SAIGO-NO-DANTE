'use client'

import { Suspense } from 'react'
import { SessionProvider } from 'next-auth/react'
import LegalVersionModal from './LegalVersionModal'
import { SessionActivityPing } from './SessionActivityPing'
import SuspensionNoticeModal from './SuspensionNoticeModal'

export default function Provider({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <Suspense fallback={null}>
        <SessionActivityPing />
        <SuspensionNoticeModal />
        <LegalVersionModal />
      </Suspense>
      {children}
    </SessionProvider>
  )
}

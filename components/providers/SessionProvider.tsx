'use client'

import { Suspense } from 'react'
import { SessionProvider } from 'next-auth/react'
import { SessionActivityPing } from './SessionActivityPing'

/** `notices`: what the signed-in user must see first (terms update, suspension). The caller passes it, so this shared provider imports no feature. */
export default function Provider({ children, notices }: { children: React.ReactNode; notices?: React.ReactNode }) {
  return (
    <SessionProvider>
      <Suspense fallback={null}>
        <SessionActivityPing />
        {notices}
      </Suspense>
      {children}
    </SessionProvider>
  )
}

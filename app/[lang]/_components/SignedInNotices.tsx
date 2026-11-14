'use client'

import dynamic from 'next/dynamic'
import { useSession } from 'next-auth/react'

// Both notices apply to signed-in accounts only; their modal code (Radix Dialog, motion) loads once someone signs in.
const LegalVersionModal = dynamic(() => import('@/features/account/components/LegalVersionModal'), { ssr: false })
const SuspensionNoticeModal = dynamic(() => import('@/components/providers/SuspensionNoticeModal'), { ssr: false })

export default function SignedInNotices() {
  const { status } = useSession()
  if (status !== 'authenticated') return null
  return (
    <>
      <SuspensionNoticeModal />
      <LegalVersionModal />
    </>
  )
}

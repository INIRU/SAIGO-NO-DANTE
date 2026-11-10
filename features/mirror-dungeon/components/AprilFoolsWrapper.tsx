'use client'

import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import { isAprilFools } from '../lib/april-fools'

const AprilFools = dynamic(() => import('./AprilFools'), { ssr: false })

// CLS guard: useState(false) ensures SSR and first client render both emit null.
// The useEffect (client-only) sets show=true only when KST date is April 1.
// Outside April 1, show remains false and the component always returns null —
// no layout shift and no hydration mismatch. No change needed.
export default function AprilFoolsWrapper() {
  const [show, setShow] = useState(false)

  useEffect(() => {
    if (isAprilFools()) setShow(true)
  }, [])

  if (!show) return null
  return <AprilFools />
}

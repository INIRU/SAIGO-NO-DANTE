'use client'

import Image from 'next/image'
import { useEffect, useState } from 'react'
import { FAUST_FACES, markFaceSeen, readSeenFaces } from '@/lib/community/faust-faces'
import { discoverEgg } from '@/components/community/easterEggs'

/** Faust on the Assist tile, a different expression on each visit (picked in the browser; the home page itself is cached). */
export default function FaustPortrait({ className }: { className?: string }) {
  const [face, setFace] = useState<number | null>(null)
  useEffect(() => {
    const next = Math.floor(Math.random() * FAUST_FACES)
    setFace(next)
    markFaceSeen(localStorage, next)
    if (readSeenFaces(localStorage).length === FAUST_FACES) discoverEgg('faust-faces')
  }, [])
  return face === null
    ? <span className={className} aria-hidden />
    : <Image src={`/assets/home/faust-${face}.webp`} alt="" width={256} height={280} className={className} />
}

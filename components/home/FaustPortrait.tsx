'use client'

import Image from 'next/image'
import { useEffect, useState } from 'react'

const FACES = 14

/** Faust on the Assist tile, a different expression on each visit (picked in the browser; the home page itself is cached). */
export default function FaustPortrait({ className }: { className?: string }) {
  const [face, setFace] = useState<number | null>(null)
  useEffect(() => { setFace(Math.floor(Math.random() * FACES)) }, [])
  return face === null
    ? <span className={className} aria-hidden />
    : <Image src={`/assets/home/faust-${face}.webp`} alt="" width={256} height={280} className={className} />
}

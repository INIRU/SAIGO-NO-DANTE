'use client'

import { useState } from 'react'
import { Play } from 'lucide-react'

/** YouTube facade: a thumbnail until clicked, so the ~3MB player loads only when someone wants to watch. */
export default function LiteYoutube({ id, title, label }: { id: string; title: string; label: string }) {
  const [playing, setPlaying] = useState(false)
  if (playing) {
    return <iframe src={`https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0`} title={title}
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen
      referrerPolicy="strict-origin-when-cross-origin" className="absolute inset-0 h-full w-full" />
  }
  return (
    <button type="button" onClick={() => setPlaying(true)} aria-label={`${label}: ${title}`}
      className="group absolute inset-0 block h-full w-full overflow-hidden focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--gold-light)]">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`https://i.ytimg.com/vi/${id}/hqdefault.jpg`} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02] motion-reduce:transition-none" />
      <span className="absolute left-1/2 top-1/2 grid h-14 w-14 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-[rgba(13,11,8,0.78)] text-[var(--gold-light)] ring-1 ring-[var(--gold)] transition-colors group-hover:bg-[var(--gold)] group-hover:text-[var(--bg-deep)]">
        <Play size={22} fill="currentColor" aria-hidden="true" />
      </span>
    </button>
  )
}

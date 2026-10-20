'use client'

import Image from 'next/image'
import { useState } from 'react'
import { Lock } from 'lucide-react'
import { getIdentityPortraitUrl } from '@/lib/utils/images'
import { formationThumbnail, type ThumbnailSlot } from '@/lib/decks/formation-thumbnail'

type Props = {
  slots: Parameters<typeof formationThumbnail>[0]
  /** Sinners whose formed identity is not in the viewer's collection: locked on the portrait. */
  missing?: ReadonlySet<string> | null
}

export function Portrait({ slot, dim, locked, ratio = '3 / 4', sizes = '(max-width: 640px) 17vw, (max-width: 1024px) 8vw, 6vw' }: { slot: ThumbnailSlot; dim: boolean; locked: boolean; ratio?: string; sizes?: string }) {
  const [awakenFailed, setAwakenFailed] = useState(false)
  const [failed, setFailed] = useState(false)
  const gacksung = slot.gacksung && !awakenFailed
  return (
    <div className="relative overflow-hidden" style={{ aspectRatio: ratio, background: '#0a0806' }}>
      {!failed && (
        <Image
          src={getIdentityPortraitUrl(slot.sinnerId, slot.folderName, slot.gameId, gacksung)}
          alt=""
          fill
          sizes={sizes}
          quality={60}
          className="transition-[filter,opacity] duration-200 group-hover:opacity-100 group-hover:grayscale-0"
          style={{ objectFit: 'cover', objectPosition: 'center top', opacity: dim ? 0.38 : 1, filter: dim ? 'grayscale(0.7)' : locked ? 'brightness(0.55)' : undefined }}
          onError={() => (gacksung ? setAwakenFailed(true) : setFailed(true))}
        />
      )}
      {locked && (
        <span aria-hidden="true" className="absolute right-0.5 top-0.5 z-[1] grid h-4 w-4 place-items-center rounded-[0.1875rem]"
          style={{ background: 'rgba(13,11,8,0.85)', color: '#c9b89f', boxShadow: 'inset 0 0 0 1px #4a3a24' }}>
          <Lock size={10} strokeWidth={2.5} />
        </span>
      )}
      {slot.order !== null && (
        <span
          className="absolute bottom-0 left-0 z-[1] grid place-items-center"
          style={{ minWidth: '1.125rem', height: '1.125rem', padding: '0 0.2rem', background: 'rgba(13,11,8,0.85)', color: '#e8b030', fontFamily: 'var(--font-title)', fontSize: '0.8125rem', lineHeight: 1, borderTopRightRadius: '0.25rem' }}
        >
          {slot.order + 1}
        </span>
      )}
    </div>
  )
}

/** 6×2 portrait strip for deck and plan cards. Sinners outside the formation are dimmed when the post has a formation. */
export default function FormationThumbnail({ slots, missing }: Props) {
  const thumbnail = formationThumbnail(slots)
  const hasFormation = thumbnail.some(slot => slot.order !== null)
  return (
    <div className="grid grid-cols-6 gap-px" style={{ background: '#17120c', borderBottom: '1px solid #2e2417' }}>
      {thumbnail.map(slot => <Portrait key={slot.sinnerId} slot={slot} dim={hasFormation && slot.order === null}
        locked={slot.order !== null && Boolean(missing?.has(slot.sinnerId))} />)}
    </div>
  )
}

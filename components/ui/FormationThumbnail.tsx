'use client'

import Image from 'next/image'
import { useState } from 'react'
import { getIdentityPortraitUrl } from '@/lib/utils/images'
import { formationThumbnail, type ThumbnailSlot } from '@/lib/decks/formation-thumbnail'

type Props = { slots: Parameters<typeof formationThumbnail>[0] }

function Portrait({ slot, dim }: { slot: ThumbnailSlot; dim: boolean }) {
  const [awakenFailed, setAwakenFailed] = useState(false)
  const [failed, setFailed] = useState(false)
  const gacksung = slot.gacksung && !awakenFailed
  return (
    <div className="relative overflow-hidden" style={{ aspectRatio: '3 / 4', background: '#0a0806' }}>
      {!failed && (
        <Image
          src={getIdentityPortraitUrl(slot.sinnerId, slot.folderName, slot.gameId, gacksung)}
          alt=""
          fill
          sizes="(max-width: 640px) 17vw, (max-width: 1024px) 8vw, 6vw"
          quality={60}
          className="transition-[filter,opacity] duration-200 group-hover:opacity-100 group-hover:grayscale-0"
          style={{ objectFit: 'cover', objectPosition: 'center top', opacity: dim ? 0.38 : 1, filter: dim ? 'grayscale(0.7)' : undefined }}
          onError={() => (gacksung ? setAwakenFailed(true) : setFailed(true))}
        />
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
export default function FormationThumbnail({ slots }: Props) {
  const thumbnail = formationThumbnail(slots)
  const hasFormation = thumbnail.some(slot => slot.order !== null)
  return (
    <div className="grid grid-cols-6 gap-px" style={{ background: '#17120c', borderBottom: '1px solid #2e2417' }}>
      {thumbnail.map(slot => <Portrait key={slot.sinnerId} slot={slot} dim={hasFormation && slot.order === null} />)}
    </div>
  )
}

'use client'

import Image from 'next/image'
import { useState } from 'react'
import { getIdentityPortraitUrl } from '@/lib/utils/images'
import { formationThumbnail, type ThumbnailSlot } from '@/lib/decks/formation-thumbnail'

type Props = {
  slots: Parameters<typeof formationThumbnail>[0]
  /** Sinners whose formed identity is not in the viewer's collection: locked on the portrait. */
  missing?: ReadonlySet<string> | null
}

export function Portrait({ slot, dim, ratio = '3 / 4', sizes = '(max-width: 768px) 17vw, (max-width: 1100px) 9vw, 6vw' }: { slot: ThumbnailSlot; dim: boolean; locked: boolean; ratio?: string; sizes?: string }) {
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
          style={{ objectFit: 'cover', objectPosition: 'center top', opacity: dim ? 0.38 : 1, filter: dim ? 'grayscale(0.7)' : undefined }}
          onError={() => (gacksung ? setAwakenFailed(true) : setFailed(true))}
        />
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

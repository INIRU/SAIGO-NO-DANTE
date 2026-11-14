'use client'

import { useRef } from 'react'
import { createPortal } from 'react-dom'
import Image from 'next/image'
import { SIN_COLORS, GRADE_COLORS, SIN_ICON_MAP, normalizeSin } from '@/lib/data/sinners'
import { useTranslations } from 'next-intl'
import { chipStyle } from '@/features/notes/lib/chip-style'
import type { NoteEgoEntry } from '@/features/notes/lib/note-entries'
import { TooltipPopup, useTooltip } from './NoteTooltip'

export default function NoteEgoChip({ entry, interactive = true }: { entry: NoteEgoEntry; interactive?: boolean }) {
  const t = useTranslations()
  const ref = useRef<HTMLSpanElement>(null)
  const { rect, show, scheduleHide, cancelHide, toggle } = useTooltip(ref)
  const sinEn = normalizeSin(entry.sin_affinity)
  const sc = sinEn ? (SIN_COLORS[sinEn] ?? '#667788') : '#667788'
  const gc = GRADE_COLORS[entry.grade] ?? '#667788'
  return (
    <span
      ref={ref}
      onMouseEnter={interactive ? show : undefined}
      onMouseLeave={interactive ? scheduleHide : undefined}
      onClick={interactive ? toggle : undefined}
      style={chipStyle(gc)}
    >
      {entry.image_url && (
        <Image src={entry.image_url} alt="" width={16} height={16} style={{ borderRadius: '50%', objectFit: 'cover' }} />
      )}
      <span style={{ color: '#888899', fontSize: '0.75rem' }}>{entry.sinnerName}</span>
      <span style={{ color: gc, fontSize: '0.75rem', fontWeight: 600 }}>{entry.name}</span>

      {interactive && rect && createPortal(
        <TooltipPopup rect={rect} minWidth={180} maxWidth={280} onMouseEnter={cancelHide} onMouseLeave={scheduleHide}>
          <div style={{ color: gc, fontSize: '0.8125rem', fontWeight: 700, marginBottom: 4 }}>
            {entry.sinnerName} · {entry.grade} E.G.O
          </div>
          <div style={{ color: '#c8a450', fontSize: '0.8125rem', fontWeight: 600, marginBottom: 4 }}>
            {entry.name}
          </div>
          {sinEn && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
              <Image src={SIN_ICON_MAP[sinEn]} alt="" width={14} height={14} />
              <span style={{ color: sc, fontSize: '0.8125rem', fontFamily: 'var(--font-mono)' }}>{sinEn ? t(`sin.${sinEn}`) : (entry.sin_affinity ?? '')}</span>
            </div>
          )}
        </TooltipPopup>,
        document.body,
      )}
    </span>
  )
}

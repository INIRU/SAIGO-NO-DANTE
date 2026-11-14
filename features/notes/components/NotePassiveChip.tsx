'use client'

import { useRef } from 'react'
import { createPortal } from 'react-dom'
import Image from 'next/image'
import { useFormatSkillDesc } from '@/components/providers/KeywordProvider'
import { MultipliedCount } from '@/features/catalog/components/PassiveParts'
import { passiveRequirements } from '@/lib/planner/passives'
import { SIN_COLORS, SIN_ICON_MAP } from '@/lib/data/sinners'
import { useTranslations } from 'next-intl'
import { chipStyle } from '@/features/notes/lib/chip-style'
import type { NotePassiveEntry } from '@/features/notes/lib/note-entries'
import { TooltipPopup, useTooltip } from './NoteTooltip'

export default function NotePassiveChip({ entry, interactive = true }: { entry: NotePassiveEntry; interactive?: boolean }) {
  const formatSkillDesc = useFormatSkillDesc()
  const t = useTranslations()
  const ref = useRef<HTMLSpanElement>(null)
  const { rect, show, scheduleHide, cancelHide, toggle } = useTooltip(ref)
  const requirements = passiveRequirements(entry)
  const sinList = requirements.map(req => req.sin)
  const sc = sinList[0] ? (SIN_COLORS[sinList[0]] ?? '#888888') : '#888888'
  return (
    <span
      ref={ref}
      onMouseEnter={interactive ? show : undefined}
      onMouseLeave={interactive ? scheduleHide : undefined}
      onClick={interactive ? toggle : undefined}
      style={chipStyle(sc)}
    >
      {entry.imageUrl && (
        <Image src={entry.imageUrl} alt="" width={12} height={18} quality={50} style={{ width: '12px', height: '18px', borderRadius: 2, objectFit: 'cover', objectPosition: 'top', flexShrink: 0 }} />
      )}
      {sinList.map((st, i) => <Image key={i} src={SIN_ICON_MAP[st]} alt="" width={14} height={14} />)}
      <span style={{ color: sc, fontSize: '0.75rem', fontWeight: 600 }}>{entry.name}</span>

      {interactive && rect && createPortal(
        <TooltipPopup rect={rect} onMouseEnter={cancelHide} onMouseLeave={scheduleHide}>
          <div style={{ color: sc, fontSize: '0.8125rem', fontWeight: 700, marginBottom: 4 }}>{entry.name}</div>
          {requirements.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              {requirements.map(req => (
                <span key={req.sin} style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                  <Image src={SIN_ICON_MAP[req.sin]} alt="" width={14} height={14} />
                  <MultipliedCount value={req.count} style={{ color: sc, fontSize: '0.8125rem', fontWeight: 700 }} />
                </span>
              ))}
              {entry.active_cond && (
                <span style={{ color: sc, fontSize: '0.8125rem' }}>
                  {t(`identity.passives.${entry.active_cond}` as Parameters<typeof t>[0])}
                </span>
              )}
            </div>
          )}
          {entry.description && (
            <div style={{ color: '#aaa', fontSize: '0.75rem', lineHeight: 1.7, whiteSpace: 'pre-line' }}>
              {formatSkillDesc(entry.description, sc)}
            </div>
          )}
        </TooltipPopup>,
        document.body,
      )}
    </span>
  )
}

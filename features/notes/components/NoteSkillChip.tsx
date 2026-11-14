'use client'

import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import Image from 'next/image'
import { useFormatSkillDesc } from '@/components/providers/KeywordProvider'
import { ATK_TYPE_ICON_MAP, getSkillOrderLabel } from '@/lib/data/sinners'
import { useTranslations } from 'next-intl'
import { skillDescriptionBlocks } from '@/lib/identity/skill-description'
import { sinColorOf } from '@/lib/constants/sin'
import { chipStyle } from '@/features/notes/lib/chip-style'
import type { NoteSkillEntry } from '@/features/notes/lib/note-entries'
import { TooltipPopup, useTooltip } from './NoteTooltip'

export default function NoteSkillChip({ entry, interactive = true }: { entry: NoteSkillEntry; interactive?: boolean }) {
  const formatSkillDesc = useFormatSkillDesc()
  const t = useTranslations()
  const ref = useRef<HTMLSpanElement>(null)
  const { rect, show, scheduleHide, cancelHide, toggle } = useTooltip(ref)
  const atkIcon = ATK_TYPE_ICON_MAP[entry.skill_type]
  const sc = sinColorOf(entry.sin_affinity, '#888888')
  const [imgSrc, setImgSrc] = useState(entry.iconUrl)
  useEffect(() => { setImgSrc(entry.iconUrl) }, [entry.iconUrl])
  return (
    <span
      ref={ref}
      onMouseEnter={interactive ? show : undefined}
      onMouseLeave={interactive ? scheduleHide : undefined}
      onClick={interactive ? toggle : undefined}
      style={chipStyle(sc)}
    >
      <span style={{ position: 'relative', width: 20, height: 20, flexShrink: 0, display: 'inline-block' }}>
        {imgSrc && <Image src={imgSrc} alt="" width={20} height={20} style={{ borderRadius: '50%' }} onError={() => { if (entry.iconFallbackUrl && imgSrc !== entry.iconFallbackUrl) setImgSrc(entry.iconFallbackUrl) }} />}
        {atkIcon && <Image src={atkIcon} alt="" width={10} height={10} style={{ position: 'absolute', bottom: -1, right: -1 }} />}
      </span>
      <span style={{ color: sc, fontSize: '0.75rem', fontWeight: 600 }}>{entry.name}</span>

      {interactive && rect && createPortal(
        <TooltipPopup rect={rect} minWidth={220} maxWidth={340} onMouseEnter={cancelHide} onMouseLeave={scheduleHide}>
          <div style={{ color: sc, fontSize: '0.8125rem', fontWeight: 700, marginBottom: 4 }}>
            {entry.sinnerName} · {entry.identityName} · {(['evade', 'defense', 'counter'].includes(entry.skill_type) ? t('identity.skillType.defense') : getSkillOrderLabel(entry.skill_order, entry.skill_type))}
          </div>
          {atkIcon && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
              <Image src={atkIcon} alt="" width={12} height={12} />
              <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontFamily: 'var(--font-mono)' }}>{t(`identity.skillType.${entry.skill_type}` as Parameters<typeof t>[0]) ?? entry.skill_type}</span>
            </div>
          )}
          {entry.description && (
            <div style={{ color: '#aaa', fontSize: '0.75rem', lineHeight: 1.7, whiteSpace: 'pre-line' }}>
              {skillDescriptionBlocks(entry.description).map(({ text, coinStart }, li) => (
                <div key={li}>
                  {coinStart && li > 0 && (
                    <div style={{ borderTop: `1px solid ${sc}25`, margin: '4px 0' }} />
                  )}
                  {formatSkillDesc(text, sc)}
                </div>
              ))}
            </div>
          )}
        </TooltipPopup>,
        document.body,
      )}
    </span>
  )
}

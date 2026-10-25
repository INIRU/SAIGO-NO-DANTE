'use client'

import { useMemo, useState } from 'react'
import Image from 'next/image'
import { useTranslations } from 'next-intl'
import { getSinnerLogoUrl } from '@/lib/utils/images'
import { buildPassivePanelModel, type PlannerPassiveIdentitySlot, type PlannerPassiveLike, type PlannerPassiveSinnerLike } from '@/lib/planner/passives'
import { PassiveEffect } from './PassiveEffect'
import { useOwnKeywordSets } from '@/lib/hooks/useOwnKeywords'

interface PlannerPassivePanelProps {
  identitySlots: PlannerPassiveIdentitySlot[]
  passives: PlannerPassiveLike[]
  sinners: PlannerPassiveSinnerLike[]
  deckSinCounts: Record<string, number>
  /** Lets a parent size the panel to its row and scroll the list inside. */
  className?: string
  listClassName?: string
}

export default function PassivePanel({
  identitySlots,
  passives,
  sinners,
  deckSinCounts,
  className,
  listClassName,
}: PlannerPassivePanelProps) {
  const t = useTranslations('decks.detail')
  const [passiveTab, setPassiveTab] = useState<'battle' | 'support'>('battle')
  const model = useMemo(
    () => buildPassivePanelModel(identitySlots, passives, sinners, deckSinCounts),
    [identitySlots, passives, sinners, deckSinCounts],
  )
  // Per identity: its keywords and what its own passives reference; plain words of older passive text are searched among these.
  const owners = useMemo(() => identitySlots.flatMap(slot => slot.identity_id ? [{
    id: slot.identity_id,
    keywords: slot.keywords,
    texts: passives.filter(passive => passive.identity_id === slot.identity_id).map(passive => passive.description),
  }] : []), [identitySlots, passives])
  const ownKeywords = useOwnKeywordSets(owners)

  return (
    <div className={className} style={{ flex: 1, background: 'var(--bg-panel)', border: '1px solid #221a0f', borderRadius: '0.375rem', overflow: 'hidden' }}>
      <div className="flex" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        {(['battle', 'support'] as const).map(tab => {
          const active = passiveTab === tab
          const cnt = model.counts[tab]
          return (
            <button key={tab} onClick={() => setPassiveTab(tab)} style={{
              flex: 1, padding: '0.5rem', fontSize: '0.75rem', fontWeight: active ? 700 : 400,
              color: active ? (tab === 'battle' ? '#c84050' : '#4898b0') : '#555',
              background: active ? (tab === 'battle' ? 'rgba(200,64,80,0.06)' : 'rgba(72,152,176,0.06)') : 'transparent',
              borderTop: 'none', borderLeft: 'none', borderRight: 'none',
              borderBottom: `2px solid ${active ? (tab === 'battle' ? '#c84050' : '#4898b0') : 'transparent'}`,
              cursor: 'pointer', fontFamily: 'var(--font-heading)',
            }}>
              {tab === 'battle' ? t('battlePassive') : t('supportPassive')} ({cnt})
            </button>
          )
        })}
      </div>
      {/* Switching battle/support passives changes the content height; the reserved gutter keeps rows from shifting. */}
      <div className={listClassName} style={{ maxHeight: listClassName ? undefined : '20rem', overflowY: 'auto', scrollbarGutter: 'stable' }}>
        {model.slots.map(({ slot, sinnerName: sName, ...tabs }, idx) => {
          const slotP = tabs[passiveTab]
          if (slotP.length === 0) return null
          return (
            <div key={`${slot.identity_id ?? idx}-${idx}`} className="flex items-start gap-2 px-3 py-2"
              style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', background: idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)' }}>
              <div style={{ width: '5.5rem', minWidth: 0, flexShrink: 0 }}>
                <div className="flex items-center gap-1">
                  {slot.sinner_id && (
                    <Image src={getSinnerLogoUrl(slot.sinner_id)} alt="" width={12} height={12} style={{ opacity: 0.4, width: '0.75rem', height: '0.75rem' }} />
                  )}
                  <span style={{ color: '#6a5e38', fontSize: '0.6875rem', fontFamily: 'var(--font-mono)' }}>{sName}</span>
                </div>
                <p className="truncate" style={{ color: '#c8a450', fontSize: '0.6875rem', fontWeight: 700, lineHeight: 1.3 }}>{slot.name_kr}</p>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                {slotP.map(({ passive: p, condition }, pi) => {
                  return (
                    <div key={`${p.passive_type}:${p.passive_order ?? pi}:${p.name}`} style={{ marginBottom: '0.375rem', opacity: condition.met ? 1 : 0.4 }}>
                      <PassiveEffect passive={p} condition={condition} allowedKeywords={ownKeywords.get(p.identity_id)} />
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

'use client'

import { useState } from 'react'
import Image from 'next/image'
import { useTranslations } from 'next-intl'
import { SIN_COLORS, SIN_KR_TO_EN, getSinIconUrl } from '@/lib/constants/sin'
import { getSinnerLogoUrl } from '@/lib/utils/images'
import SkillDescription from '@/components/skill/SkillDescription'
import type { SinType } from '@/lib/types'

export interface PlannerPassiveIdentitySlot {
  identity_id?: string
  sinner_id?: string
  name_kr?: string
}

export interface PlannerPassiveLike {
  identity_id: string
  name: string
  passive_type: string
  sin_affinity: string | null
  sin_count: number | null
  active_cond: string | null
  description: string | null
  passive_order?: number | null
}

export interface PlannerPassiveSinnerLike {
  id: string
  name_kr: string
}

interface PlannerPassivePanelProps {
  identitySlots: PlannerPassiveIdentitySlot[]
  passives: PlannerPassiveLike[]
  sinners: PlannerPassiveSinnerLike[]
  deckSinCounts: Record<string, number>
}

function normalizePassiveSins(sinAffinity: string | null): SinType[] {
  if (!sinAffinity) return []
  return sinAffinity
    .split(',')
    .map(sin => sin.trim())
    .map(sin => SIN_KR_TO_EN[sin] ?? sin)
    .filter((sin): sin is SinType => sin in SIN_COLORS)
}

function getCondition(passive: PlannerPassiveLike, deckSinCounts: Record<string, number>) {
  const sins = normalizePassiveSins(passive.sin_affinity)
  const required = passive.sin_count ?? 0
  const current = sins.length > 0
    ? sins.reduce((sum, sin) => sum + (deckSinCounts[sin] ?? 0), 0)
    : 0
  const met = required === 0 || current >= required
  const primarySin = sins[0] ?? null
  const color = primarySin ? (SIN_COLORS[primarySin as keyof typeof SIN_COLORS] ?? '#888') : '#888'

  return { sins, current, required, met, primarySin, color }
}

export default function PlannerPassivePanel({
  identitySlots,
  passives,
  sinners,
  deckSinCounts,
}: PlannerPassivePanelProps) {
  const t = useTranslations('decks.detail')
  const [passiveTab, setPassiveTab] = useState<'battle' | 'support'>('battle')
  const slotIds = new Set(identitySlots.map(s => s.identity_id).filter(Boolean))

  const isCondMet = (passive: PlannerPassiveLike) => getCondition(passive, deckSinCounts).met

  return (
    <div style={{ flex: 1, background: '#120e09', border: '1px solid #221a0f', borderRadius: '0.375rem', overflow: 'hidden' }}>
      <div className="flex" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        {(['battle', 'support'] as const).map(tab => {
          const active = passiveTab === tab
          const cnt = passives.filter(p => slotIds.has(p.identity_id) && p.passive_type === tab).length
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
      <div style={{ maxHeight: '20rem', overflowY: 'auto' }}>
        {identitySlots.map((slot, idx) => {
          const sName = sinners.find(s => s.id === slot.sinner_id)?.name_kr ?? slot.sinner_id ?? ''
          const slotP = passives
            .filter(p => p.identity_id === slot.identity_id && p.passive_type === passiveTab)
            .sort((a, b) => (isCondMet(b) ? 1 : 0) - (isCondMet(a) ? 1 : 0))
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
                {slotP.map((p, pi) => {
                  const condition = getCondition(p, deckSinCounts)
                  return (
                    <div key={`${p.passive_type}:${p.passive_order ?? pi}:${p.name}`} style={{ marginBottom: '0.375rem', opacity: condition.met ? 1 : 0.4 }}>
                      <div className="flex items-center gap-1.5" style={{ fontSize: '0.75rem' }}>
                        {condition.met && <span style={{ color: '#40a060', fontSize: '0.5625rem', flexShrink: 0 }}>●</span>}
                        {condition.primarySin && <Image src={getSinIconUrl(condition.primarySin)} alt="" width={12} height={12} style={{ width: '0.75rem', height: '0.75rem' }} />}
                        {condition.required > 0 && condition.primarySin && (
                          <span style={{ color: condition.met ? '#40a060' : condition.color, fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
                            {condition.current}/{condition.required}
                          </span>
                        )}
                        <span style={{ color: condition.color, fontWeight: 600 }}>
                          {p.active_cond === 'resonance' ? t('passiveResonance') : p.active_cond === 'stock' ? t('passiveStock') : ''}
                        </span>
                        <span style={{ color: condition.met ? '#9a8a70' : '#4a4030', fontWeight: 600 }}>{p.name}</span>
                      </div>
                      {p.description && (
                        <div style={{ marginLeft: '0.75rem', marginTop: '0.125rem' }}>
                          <SkillDescription description={p.description} accentColor={condition.color} variant="compact" />
                        </div>
                      )}
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

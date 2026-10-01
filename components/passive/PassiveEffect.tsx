'use client'

import { memo } from 'react'
import Image from 'next/image'
import { useTranslations } from 'next-intl'
import { SIN_COLORS, getSinIconUrl } from '@/lib/constants/sin'
import { getPassiveCondition, type PlannerPassiveLike } from '@/lib/planner/passives'
import SkillDescription from '@/components/skill/SkillDescription'

export const PassiveEffect = memo(function PassiveEffect({ passive, condition, variant = 'panel' }: {
  passive: PlannerPassiveLike
  condition: ReturnType<typeof getPassiveCondition>
  variant?: 'panel' | 'note'
}) {
  const t = useTranslations('decks.detail')
  const note = variant === 'note'
  return (
    <>
      <div className={note ? 'flex flex-wrap items-center gap-1.5' : 'flex items-center gap-1.5'} style={{ fontSize: note ? '0.875rem' : '0.75rem' }}>
        {condition.met && <span style={{ color: '#40a060', fontSize: note ? '0.625rem' : '0.5625rem', flexShrink: 0 }}>●</span>}
        {condition.requirements.map(req => (
          <span key={req.sin} className="inline-flex items-center gap-1" data-met={req.met}>
            <Image src={getSinIconUrl(req.sin)} alt="" width={12} height={12} style={{ width: '0.75rem', height: '0.75rem' }} />
            <span style={{ color: req.met ? '#40a060' : SIN_COLORS[req.sin] ?? condition.color, fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
              {req.current}/{req.count}
            </span>
          </span>
        ))}
        <span style={{ color: condition.color, fontWeight: 600 }}>
          {passive.active_cond === 'resonance' ? t('passiveResonance') : passive.active_cond === 'stock' ? t('passiveStock') : ''}
        </span>
        <span style={{ color: condition.met ? '#9a8a70' : note ? '#6a5e38' : '#4a4030', fontWeight: note ? 700 : 600 }}>{passive.name}</span>
      </div>
      {passive.description && (
        <div style={note ? { marginTop: '0.25rem' } : { marginLeft: '0.75rem', marginTop: '0.125rem' }}>
          <SkillDescription description={passive.description} accentColor={condition.color} variant="compact" />
        </div>
      )}
    </>
  )
})

export function PassiveNoteRow({
  passive,
  deckSinCounts = {},
  imageUrl,
}: {
  passive: PlannerPassiveLike
  deckSinCounts?: Record<string, number>
  imageUrl?: string
}) {
  const condition = getPassiveCondition(passive, deckSinCounts)

  return (
    <div
      className="flex items-start gap-2 rounded px-3 py-2"
      style={{
        background: '#120e09',
        border: '1px solid #221a0f',
        opacity: condition.met ? 1 : 0.55,
        maxWidth: '32rem',
      }}
    >
      {imageUrl && (
        <Image
          src={imageUrl}
          alt=""
          width={24}
          height={36}
          quality={50}
          style={{ width: '1.5rem', height: '2.25rem', borderRadius: '0.125rem', objectFit: 'cover', objectPosition: 'top', flexShrink: 0 }}
        />
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <PassiveEffect passive={passive} condition={condition} variant="note" />
      </div>
    </div>
  )
}


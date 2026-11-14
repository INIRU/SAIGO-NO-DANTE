'use client'

import Image from 'next/image'
import { useTranslations } from 'next-intl'
import { getGameUiAsset } from '@/lib/utils/game-ui'
import { GRADE_ROMAN } from '@/lib/planner/gift-plan-constants'

/** 관찰 탭 위쪽 줄: 별빛 비용, 고른 수/최대, 등급 범위. */
export default function GiftObserveInfoBar({ count, max, cost }: { count: number; max: number; cost: number }) {
  const t = useTranslations('planner.giftTab')
  return (
    <div className="planner-gift-info-bar" style={{
      display: 'flex',
      alignItems: 'center',
      gap: '0.75rem',
      flexWrap: 'wrap',
      padding: '0.5rem 0.625rem',
      background: 'rgba(26,21,16,0.5)',
      borderRadius: '0.375rem',
      border: '1px solid #1f1a14',
    }}>
      <span style={{ fontSize: '0.75rem', color: '#9ca3af', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
        {t('observe.cost')}
        <Image
          src={getGameUiAsset('start-buffs/starlight')}
          alt={t('observe.starlightAlt')}
          width={16}
          height={16}
          style={{ width: '1rem', height: '1rem', verticalAlign: 'middle' }}
        />
        <span style={{ color: 'var(--gold-light)', fontWeight: 700 }}>{cost}</span>
      </span>
      <span style={{
        fontSize: '0.6875rem',
        color: count >= 3 ? '#dc2626' : 'var(--gold)',
        background: count >= 3 ? 'rgba(220,38,38,0.1)' : 'rgba(200,144,10,0.1)',
        padding: '0.125rem 0.5rem',
        borderRadius: '0.25rem',
        border: `1px solid ${count >= 3 ? 'rgba(220,38,38,0.25)' : 'rgba(200,144,10,0.25)'}`,
        fontWeight: 600,
      }}>
        {t('observe.selected', { count, max })}
      </span>
      <span style={{ fontSize: '0.625rem', color: 'var(--text-muted)' }}>
        {t('observe.gradeRange', { from: GRADE_ROMAN['1'], to: GRADE_ROMAN['3'] })}
      </span>
    </div>
  )
}

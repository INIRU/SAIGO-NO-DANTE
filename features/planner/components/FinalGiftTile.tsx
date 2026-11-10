'use client'

import { giftConditionKey } from '@/lib/planner/gift-condition-status'
import { memo } from 'react'
import { useTranslations } from 'next-intl'
import GiftCard, { EnhanceSprite } from '@/features/mirror-dungeon/components/GiftCard'
import { nextEnhanceLevel, type FinalGift } from '@/features/planner/lib/final-gifts'
import type { GiftData } from '@/lib/planner/types'

// The game's enhancement sprites, idle and lit (GiftCard owns them).
const LEVELS = [['minus', 'minus'], ['plusIdle', 'plus'], ['plusplusIdle', 'plusplus']] as const

/**
 * One gift in the final set. Clicking or tapping the card cycles its enhancement; with a mouse a band of the game's
 * −/+/++ sprites sets it directly, and on any device holding the gift opens its detail, whose keys set it too. Picked
 * gifts leave through GiftCard's corner ×; start and observed gifts are tagged and stay, since they come from the start plan.
 */
type Props = {
  gift: GiftData
  entry: FinalGift
  conditionStatus?: import('@/lib/planner/gift-condition-status').GiftConditionStatus | null
  onEnhance: (entry: FinalGift, level: number) => void
  onRemove: (giftId: number) => void
}

const sameFields = (a: object, b: object) => {
  const ka = Object.keys(a)
  return ka.length === Object.keys(b).length && ka.every(k => (a as Record<string, unknown>)[k] === (b as Record<string, unknown>)[k])
}

// gift·entry는 누를 때마다 새 객체로 온다: 값이 같으면 다시 그리지 않는다(최종 기프트 하나를 더해도 모든 칸이 다시 그려지던 지연)
export default memo(function FinalGiftTile({ gift, entry, conditionStatus, onEnhance: setLevel, onRemove: removeGift }: Props) {
  const onEnhance = (level: number) => setLevel(entry, level)
  const onRemove = () => removeGift(gift.game_id)
  const t = useTranslations('planner.floorTab')
  const te = useTranslations('giftEnhance')
  const max = gift.effect_plusplus ? 2 : gift.effect_plus ? 1 : 0
  const removable = entry.source === 'final'
  const levelName = entry.level === 2 ? te('plusplus') : entry.level === 1 ? te('plus') : null
  const label = [
    gift.name,
    levelName,
    entry.source !== 'final' && t(entry.source === 'start' ? 'finalAutoStart' : 'finalAutoObserve'),
    max > 0 && t('finalEnhanceHint'),
    removable && t('finalRemoveHint'),
  ].filter(Boolean).join('. ')

  return (
    <li
      className="group relative w-full min-w-0 max-w-[5rem] select-none [-webkit-touch-callout:none]"
      onKeyDown={event => { if (removable && (event.key === 'Delete' || event.key === 'Backspace')) onRemove() }}
    >
      <div className="relative">
        <GiftCard
          gift={gift}
          size="100%"
          showName={false}
          className={`hover:transform-none! ${max === 0 ? 'cursor-default!' : ''}`}
          enhance={entry.level || undefined}
          conditionStatus={conditionStatus}
          bandLabel={entry.source !== 'final' ? t(entry.source === 'start' ? 'finalAutoStartTag' : 'finalAutoObserveTag') : undefined}
          onClick={() => { if (max > 0) onEnhance(nextEnhanceLevel(gift, entry.level)) }}
          ariaLabel={label}
          title={label}
          onRemove={removable ? onRemove : undefined}
          removeLabel={removable ? t('removeFinalGift', { gift: gift.name }) : undefined}
        />
        {max > 0 && (
          // Pointer shortcut; keyboard users cycle with the card itself.
          <div
            aria-hidden="true"
            className="absolute inset-x-[4%] bottom-[5%] z-30 flex h-[1.5rem] items-stretch overflow-hidden rounded-[0.1875rem] opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100 motion-reduce:transition-none [@media(hover:none)]:hidden"
            style={{ background: 'rgba(13,11,8,0.9)', boxShadow: 'inset 0 0 0 1px #2e2417' }}
          >
            {LEVELS.slice(0, max + 1).map(([idle, lit], level) => {
              const on = entry.level === level
              return (
                <button
                  key={level}
                  type="button"
                  tabIndex={-1}
                  onClick={() => onEnhance(level)}
                  className="flex min-w-0 flex-1 items-center justify-center transition-opacity hover:opacity-100"
                  style={{ opacity: on ? 1 : 0.45, background: on ? 'rgba(200,144,10,0.16)' : undefined }}
                >
                  <span className="flex" style={{ height: level === 0 ? '0.4375rem' : on ? '1rem' : '0.75rem' }}>
                    <EnhanceSprite sprite={on ? lit : idle} />
                  </span>
                </button>
              )
            })}
          </div>
        )}
      </div>
      <span aria-hidden="true" className="mt-1 block truncate text-center text-[0.6875rem] leading-tight" style={{ color: entry.level ? 'var(--gold-light)' : '#b9aa98' }}>
        {gift.name}
      </span>
    </li>
  )
}, (prev, next) => prev.onEnhance === next.onEnhance && prev.onRemove === next.onRemove &&
  giftConditionKey(prev.conditionStatus) === giftConditionKey(next.conditionStatus) &&
  sameFields(prev.gift, next.gift) && sameFields(prev.entry, next.entry))

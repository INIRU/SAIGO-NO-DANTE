'use client'

import { memo, useRef } from 'react'
import Image from 'next/image'
import { X } from 'lucide-react'
import { useTranslations } from 'next-intl'
import GiftCard from '@/components/ui/GiftCard'
import { getGameUiAsset } from '@/lib/utils/game-ui'
import { nextEnhanceLevel, type FinalGift } from '@/lib/planner/final-gifts'
import type { GiftData } from '@/lib/planner/types'

// The game's enhancement sprites (intrinsic sizes), idle and lit.
const LEVELS = [
  { idle: ['gift/enhance-minus', 30, 18], lit: ['gift/enhance-minus', 30, 18] },
  { idle: ['gift/enhance-plus-idle', 31, 30], lit: ['gift/enhance-plus', 40, 41] },
  { idle: ['gift/enhance-plusplus-idle', 61, 30], lit: ['gift/enhance-plusplus', 70, 41] },
] as const

/**
 * One gift in the final set. Clicking or tapping the card cycles its enhancement; on hover or focus a band of the game's
 * −/+/++ sprites sets it directly. Picked gifts leave through the corner × or a long press; start and observed gifts are
 * tagged and stay, since they come from the start plan.
 */
type Props = {
  gift: GiftData
  entry: FinalGift
  conditionStatus?: { level: 'warn' | 'unmet'; text: string } | null
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
  const press = useRef<{ timer?: ReturnType<typeof setTimeout>; fired?: boolean }>({})
  const cancelPress = () => clearTimeout(press.current.timer)
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
      onContextMenu={event => { if (removable) event.preventDefault() }}
      onPointerDown={event => {
        if (!removable || event.pointerType === 'mouse') return
        press.current.fired = false
        press.current.timer = setTimeout(() => { press.current.fired = true; navigator.vibrate?.(12); onRemove() }, 550)
      }}
      onPointerUp={cancelPress}
      onPointerLeave={cancelPress}
      onPointerCancel={cancelPress}
    >
      <div className="relative">
        <GiftCard
          gift={gift}
          size="100%"
          showName={false}
          className={`hover:transform-none! ${max === 0 ? 'cursor-default!' : ''}`}
          enhance={entry.level || undefined}
          conditionStatus={conditionStatus}
          onClick={() => {
            if (press.current.fired) { press.current.fired = false; return }
            if (max > 0) onEnhance(nextEnhanceLevel(gift, entry.level))
          }}
          ariaLabel={label}
          title={label}
        />
        {entry.source !== 'final' && (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute bottom-[7%] left-[7%] z-20 rounded-[0.1875rem] border px-1 text-[0.625rem] leading-[1rem] transition-opacity group-hover:opacity-0 group-focus-within:opacity-0"
            style={{ background: 'rgba(13,11,8,0.88)', borderColor: 'rgba(200,144,10,0.45)', color: '#e8b030' }}
          >
            {t(entry.source === 'start' ? 'finalAutoStartTag' : 'finalAutoObserveTag')}
          </span>
        )}
        {max > 0 && (
          // Pointer shortcut; keyboard users cycle with the card itself.
          <div
            aria-hidden="true"
            className="absolute inset-x-[10%] bottom-[6%] z-30 flex h-[1.375rem] items-center justify-center gap-[0.1875rem] rounded-[0.1875rem] px-1 opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100 motion-reduce:transition-none [@media(hover:none)]:hidden"
            style={{ background: 'rgba(13,11,8,0.9)', boxShadow: 'inset 0 0 0 1px #2e2417' }}
          >
            {LEVELS.slice(0, max + 1).map(({ idle, lit }, level) => {
              const on = entry.level === level
              const [src, width, height] = on ? lit : idle
              return (
                <button
                  key={level}
                  type="button"
                  tabIndex={-1}
                  onClick={() => onEnhance(level)}
                  className="flex h-full items-center px-px transition-opacity hover:opacity-100"
                  style={{ opacity: on ? 1 : 0.45 }}
                >
                  <Image src={getGameUiAsset(src)} alt="" width={width} height={height} draggable={false}
                    style={{ width: 'auto', height: level === 0 ? '0.4375rem' : on ? '1rem' : '0.75rem' }} />
                </button>
              )
            })}
          </div>
        )}
        {removable && (
          <button
            type="button"
            onClick={onRemove}
            aria-label={t('removeFinalGift', { gift: gift.name })}
            title={t('removeFinalGift', { gift: gift.name })}
            className="absolute -right-3 -top-3 z-40 flex h-5 w-5 items-center justify-center rounded-full border opacity-0 transition-[opacity,color] hover:text-[#ff8b8b] focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gold)] group-hover:opacity-100 motion-reduce:transition-none [@media(hover:none)]:hidden"
            style={{ background: '#17120c', borderColor: '#4a3a24', color: '#c9b89f' }}
          >
            <X size={12} aria-hidden="true" />
          </button>
        )}
      </div>
      <span aria-hidden="true" className="mt-1 block truncate text-center text-[0.6875rem] leading-tight" style={{ color: entry.level ? '#e8b030' : '#b9aa98' }}>
        {gift.name}
      </span>
    </li>
  )
}, (prev, next) => prev.onEnhance === next.onEnhance && prev.onRemove === next.onRemove &&
  prev.conditionStatus?.level === next.conditionStatus?.level && prev.conditionStatus?.text === next.conditionStatus?.text &&
  sameFields(prev.gift, next.gift) && sameFields(prev.entry, next.entry))

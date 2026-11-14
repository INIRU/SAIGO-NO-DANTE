'use client'

import { useTranslations } from 'next-intl'
import GiftCard from '@/features/mirror-dungeon/components/GiftCard'
import { themeExclusiveGiftIds } from '@/lib/planner/fusion'
import type { GiftData, ThemeData } from '@/lib/planner/types'

/** The open floor's gifts: planned ones can be removed, clear rewards are fixed, and the last tile opens the gift picker. */
export default function FloorAcquiredGifts({ floorGifts, plannedIds, selectedTheme, onToggle, onOpenPicker }: {
  floorGifts: GiftData[]
  plannedIds: Set<string>
  selectedTheme: ThemeData | null
  onToggle: (giftGameId: string) => void
  onOpenPicker: () => void
}) {
  const t = useTranslations('planner.floorTab')
  const exclusiveLabel = t('ladder.packExclusive')
  return (
    <div className="col-span-2 min-w-0 sm:col-span-1 sm:col-start-2">
      <h5 className="mb-2 text-[0.9375rem]" style={{ fontFamily: 'var(--font-heading)', color: 'var(--text-primary)' }}>
        {t('acquiredGiftCount', { count: floorGifts.length })}
      </h5>
      <div className="flex flex-wrap items-start gap-2">
        {floorGifts.map(gift => {
          const warning = selectedTheme && themeExclusiveGiftIds(selectedTheme).includes(gift.game_id) ? exclusiveLabel : undefined
          if (!plannedIds.has(String(gift.game_id))) {
            return (
              <div key={gift.game_id} className="w-[4rem]">
                <GiftCard
                  gift={gift}
                  size="4rem"
                  showName={false}
                  warning={warning}
                  onClick={() => undefined}
                  title={t('ladder.rewardTitle', { gift: gift.name })}
                  ariaLabel={t('ladder.rewardTitle', { gift: gift.name })}
                />
                <span className="mt-1 block text-center text-[0.75rem]" style={{ color: '#9c8b73' }}>{t('ladder.reward')}</span>
              </div>
            )
          }
          return (
            <GiftCard
              key={gift.game_id}
              gift={gift}
              size="4rem"
              showName={false}
              warning={warning}
              onClick={() => onToggle(String(gift.game_id))}
              onRemove={() => onToggle(String(gift.game_id))}
            />
          )
        })}
        <GiftCard
          gift={{ name: t('addGift') }}
          variant="insert"
          size="4rem"
          showName
          ariaLabel={t('giftPickerTitle')}
          onClick={onOpenPicker}
        />
      </div>
    </div>
  )
}

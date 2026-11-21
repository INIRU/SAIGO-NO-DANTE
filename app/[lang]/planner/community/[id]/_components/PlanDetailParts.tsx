import Image from 'next/image'
import type { ReactNode } from 'react'
import GiftCard from '@/features/mirror-dungeon/components/GiftCard'
import type { GiftConditionStatus } from '@/lib/planner/gift-condition-status'
import type { GiftData } from '@/lib/planner/types'
import type { SupportedLang } from '@/lib/i18n/types'
import { getLocalizedName } from '@/lib/i18n/localize'
import { getGameUiAsset } from '@/lib/utils/game-ui'
import styles from '../PlanDetailHeader.module.css'

export function SectionHead({ id, title, meta }: { id: string; title: string; meta?: ReactNode }) {
  return (
    <div className="mb-5 flex min-w-0 flex-wrap items-end justify-between gap-x-4 gap-y-1">
      <h2 id={id} className="min-w-0 font-[family-name:var(--font-heading)] text-[1.375rem] leading-snug text-[var(--text-primary)] sm:text-[1.5rem]">{title}</h2>
      {meta != null && <div className="shrink-0 text-[0.9375rem] tabular-nums text-[#9c8b73]">{meta}</div>}
    </div>
  )
}

/** Same starlight chip as the planner's blessing and observation costs. */
export function StarlightCost({ label, value }: { label: string; value: number }) {
  return (
    <span className="inline-flex min-h-9 items-center gap-1.5 rounded-md border border-[rgba(92,73,54,0.86)] bg-[rgba(18,15,12,0.72)] px-2.5 text-[0.875rem] text-[#d8c1a0]">
      <Image src={getGameUiAsset('start-buffs/starlight')} alt="" width={18} height={18} className="h-[1.125rem] w-[1.125rem]" />
      {label}
      <span className="font-semibold tabular-nums text-[var(--gold-light)]">{value}</span>
    </span>
  )
}

export function SubHead({ title, meta }: { title: string; meta: ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h3 className="font-[family-name:var(--font-heading)] text-[1.0625rem] text-[var(--text-primary)]">{title}</h3>
      <span className="flex items-center gap-2 text-[0.875rem] tabular-nums text-[#9c8b73]">{meta}</span>
    </div>
  )
}

export function Section({ id, children }: { id: string; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className={styles.section}>
      {children}
    </section>
  )
}

export function GiftGrid({ gifts, getCondition, onGiftClick, locale }: {
  gifts: { gift: GiftData; enhance: number }[]
  getCondition?: (gift: GiftData) => GiftConditionStatus | null
  onGiftClick?: (gift: GiftData, enhance: number) => void
  locale: SupportedLang
}) {
  return (
    <ul className={styles.giftGrid}>
      {gifts.map(({ gift, enhance }) => {
        const cond = getCondition?.(gift)
        const giftName = getLocalizedName({ name_kr: gift.name, name_en: gift.name_en, name_jp: gift.name_jp }, locale)
        return (
          <li key={`${gift.game_id}_${enhance}`} className={styles.giftCell}>
            <GiftCard
              gift={gift}
              onClick={() => onGiftClick?.(gift, enhance)}
              disabled={!onGiftClick}
              enhance={enhance}
              conditionStatus={cond}
              title={giftName}
              ariaLabel={giftName}
              size="100%"
              className="max-w-[5rem]"
            />
          </li>
        )
      })}
    </ul>
  )
}

'use client'

import type { ReactNode } from 'react'
import { useLocale } from 'next-intl'
import { GiftCatalogItem, type GiftCatalogCardProps } from '@/components/gifts/GiftCatalog'
import type { EgoGift } from '@/components/mirror-dungeon/types'
import type { SupportedLang } from '@/lib/i18n/types'

interface GiftCheckWindowProps {
  title: string
  sections: { label: string; note?: string; gifts: EgoGift[] }[]
  checkedIds: ReadonlySet<string>
  checkedLabel: string
  onCheck: (gift: EgoGift) => void
  /** The fusion and pack-only marks of check mode, by gift id. */
  marks: ReadonlyMap<string, { badge: ReactNode; card: GiftCatalogCardProps }>
}

/** The chosen preset for the small always-on-top window: group by group, a press records the gift as obtained. */
export default function GiftCheckWindow({ title, sections, checkedIds, checkedLabel, onCheck, marks }: GiftCheckWindowProps) {
  const lang = useLocale() as SupportedLang
  const all = sections.flatMap(section => section.gifts)
  return (
    <div className="min-h-full bg-[var(--bg-deep)] p-3 text-[var(--text-primary)]">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h1 className="min-w-0 truncate text-[1rem]" style={{ fontFamily: 'var(--font-heading)' }}>{title}</h1>
        <p className="shrink-0 text-[0.8125rem] text-[#9c8b73]">
          {checkedLabel} <span className="tabular-nums text-[var(--gold-light)]" style={{ fontFamily: 'var(--font-title)', fontSize: '1.125rem', lineHeight: 1 }}>
            {all.filter(gift => checkedIds.has(gift.id)).length} / {all.length}
          </span>
        </p>
      </div>
      {sections.map((section, index) => (
        <section key={index} aria-label={section.label} className="mb-4 last:mb-0">
          <h2 className="mb-2 flex items-center gap-2" style={{ borderBottom: '1px solid rgba(200,144,10,0.35)', paddingBottom: '0.375rem' }}>
            <span style={{ color: 'var(--gold-light)', fontFamily: 'var(--font-heading)', fontSize: '1rem' }}>{section.label}</span>
            <span className="tabular-nums" style={{ color: '#9c8b73', fontFamily: 'var(--font-title)', fontSize: '1.125rem', lineHeight: 1 }}>{section.gifts.length}</span>
          </h2>
          {section.note && <p className="mb-2 whitespace-pre-wrap break-words text-[0.8125rem] leading-[1.5] text-[var(--text-secondary)]">{section.note}</p>}
          <div className="gift-grid [&_.gift-card:hover]:[transform:none]!" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(3rem, 1fr))', gap: '0.5rem 0.375rem' }}>
            {section.gifts.map(gift => {
              const isMarked = checkedIds.has(gift.id)
              const mark = isMarked ? undefined : marks.get(gift.id)
              return <GiftCatalogItem key={gift.id} gift={gift} onSelect={onCheck} lang={lang} compact isMarked={isMarked} markedLabel={checkedLabel} badge={mark?.badge} extra={mark?.card} />
            })}
          </div>
        </section>
      ))}
    </div>
  )
}

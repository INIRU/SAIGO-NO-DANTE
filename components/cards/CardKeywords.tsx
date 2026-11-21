'use client'

import Image from 'next/image'
import { useLocale } from 'next-intl'
import { useKeywordData, useKeywords } from '@/components/providers/KeywordProvider'
import { localizeDeckKeyword } from '@/lib/decks/decks-types'
import type { SupportedLang } from '@/lib/i18n'

/**
 * A card's main keywords, the same on deck and plan cards: icon and name, no box. They go in the card's own row under
 * the description; past `max` the rest is a count.
 */
export default function CardKeywords({ keywords: list, max = 3 }: { keywords: readonly string[]; max?: number }) {
  const locale = useLocale() as SupportedLang
  const { getIconUrl } = useKeywordData()
  const keywords = useKeywords()
  return (
    <>
      {list.slice(0, max).map(keyword => {
        const iconUrl = getIconUrl(keyword)
        return (
          <span key={keyword} data-card-keyword className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap text-[0.875rem] leading-none text-[#9f8b68]">
            {iconUrl && <Image src={iconUrl} alt="" width={14} height={14} className="size-[0.875rem] shrink-0" />}
            {localizeDeckKeyword(keyword, keywords[keyword], locale)}
          </span>
        )
      })}
      {list.length > max && <span className="shrink-0 text-[0.875rem] leading-none text-[var(--text-muted)]">+{list.length - max}</span>}
    </>
  )
}

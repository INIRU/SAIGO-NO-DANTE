'use client'

import type { Ref } from 'react'
import Image from 'next/image'
import KeywordIcon from '@/components/ui/KeywordIcon'
import Skeleton, { SkeletonLine } from '@/components/ui/Skeleton'
import { getSinIconUrl, normalizeSin } from '@/lib/constants/sin'
import { translations } from '@/lib/i18n/translations'
import type { SupportedLang } from '@/lib/i18n/types'
import { getLocalizedKeywordDesc } from '@/lib/i18n/localize'
import { localizeDeckKeyword } from '@/features/decks'
import { keywordAccentColor, resolveKeywordIconUrl, useKeywords } from '@/components/providers/KeywordProvider'
import { PlaceholderText } from '@/components/ui/PlaceholderLabel'
import { usePlainGameText } from '@/hooks/usePlainGameText'

export interface KeywordEntry {
  name: string
  description: string | null
  max_stack: number | null
  icon_slug: string | null
  sin_affinity: string | null
  category: string | null
  name_en?: string | null
  name_jp?: string | null
  description_en?: string | null
  description_jp?: string | null
}

export const kt = (key: string, lang: SupportedLang) => {
  const entry = translations[key as keyof typeof translations]
  return entry ? entry[lang] ?? entry.ko : key
}

export const keywordName = (kw: KeywordEntry, lang: SupportedLang) =>
  localizeDeckKeyword(kw.name, { nameEn: kw.name_en, nameJp: kw.name_jp }, lang)

export const keywordDesc = (kw: KeywordEntry, lang: SupportedLang) =>
  getLocalizedKeywordDesc(kw.description ?? '', { nameEn: null, nameJp: null, descEn: kw.description_en, descJp: kw.description_jp }, lang)

/** Name colour used by the in-game keyword tooltip. */
export function useKeywordColor(name: string) {
  return keywordAccentColor(name, useKeywords()[name])
}

const CARD = 'kw-card flex h-full w-full flex-col rounded-md border border-[#2e2417] bg-[#17120c] text-left'
const DETAIL = `${CARD} p-4`
const TILE = `${CARD} items-center gap-2 px-1.5 pb-2.5 pt-3`
const INTERACTIVE = 'cursor-pointer transition-colors hover:border-[var(--border)] hover:bg-[#1d160e] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gold-light)] motion-reduce:transition-none'

export default function KeywordCard({ keyword: kw, counts, onClick, lang, compact = false }: {
  keyword: KeywordEntry
  counts: { identity: number; ego: number; gift: number }
  onClick: () => void
  lang: SupportedLang
  compact?: boolean
}) {
  const color = useKeywordColor(kw.name)
  const iconUrl = resolveKeywordIconUrl(kw.name, kw.icon_slug)
  const name = keywordName(kw, lang)
  const plainText = usePlainGameText(lang)

  if (compact) {
    return (
      <button type="button" onClick={onClick} className={`${TILE} ${INTERACTIVE}`}>
        <span className="flex size-10 items-center justify-center">
          {iconUrl && <KeywordIcon src={iconUrl} alt="" width={36} height={36} className="size-9 object-contain" />}
        </span>
        <span className="line-clamp-2 min-h-[2.025rem] w-full break-keep text-center text-[0.75rem] leading-[1.35]" style={{ color }}>{name}</span>
      </button>
    )
  }

  const sin = normalizeSin(kw.sin_affinity)
  const stats = [
    { label: kt('keyword.stat.identities', lang), value: counts.identity },
    { label: 'E.G.O', value: counts.ego },
    { label: kt('keyword.stat.gifts', lang), value: counts.gift },
  ]
  return (
    <button type="button" onClick={onClick} className={`${DETAIL} ${INTERACTIVE}`}>
      <span className="flex h-11 w-full items-center gap-3">
        <span className="flex size-11 shrink-0 items-center justify-center rounded bg-[var(--bg-deep)]">
          {iconUrl && <KeywordIcon src={iconUrl} alt="" width={32} height={32} className="size-8 object-contain" />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5">
            <span className="truncate font-[family-name:var(--font-heading)] text-[0.9375rem] leading-tight" style={{ color }}>{name}</span>
            {sin && <Image src={getSinIconUrl(sin)} alt={kt(`sin.${sin}`, lang)} width={16} height={16} className="size-4 shrink-0" />}
          </span>
          {kw.max_stack ? (
            <span className="mt-0.5 block text-[0.75rem] leading-tight text-[#9c8b73]">
              {kt('keyword.maxStack', lang)} <span className="font-[family-name:var(--font-title)] text-[0.9375rem] tabular-nums text-[var(--gold-light)]">{kw.max_stack}</span>
            </span>
          ) : null}
        </span>
      </span>
      <span className="mt-3 line-clamp-2 min-h-[2.6rem] w-full text-[0.8125rem] leading-[1.6] text-[#bfae92]"><PlaceholderText text={plainText(keywordDesc(kw, lang))} /></span>
      <span className="mt-auto grid w-full grid-cols-3 border-t border-[#2e2417] pt-2.5">
        {stats.map(s => (
          <span key={s.label} className="flex h-6 items-baseline gap-1.5">
            <span className="font-[family-name:var(--font-title)] text-[1.25rem] leading-6 tabular-nums" style={{ color: s.value ? 'var(--text-primary)' : 'var(--text-muted)' }}>{s.value}</span>
            <span className="truncate text-[0.75rem] text-[#9c8b73]">{s.label}</span>
          </span>
        ))}
      </span>
    </button>
  )
}

/**
 * Off screen the browser skips what these boxes hold, so the placeholder cards waiting below the list (the scroll sentinel)
 * stop their endless shimmer until they come into view. Each box has its own fixed size, so skipping never changes the layout.
 */
const OFFSCREEN_STILL = '[content-visibility:auto]'

/** Same box as KeywordCard; used by loading.tsx and while more cards are revealed. */
export function KeywordCardSkeleton({ compact = false, ref }: { compact?: boolean; ref?: Ref<HTMLDivElement> }) {
  if (compact) {
    return (
      <div ref={ref} aria-hidden="true" className={TILE}>
        <div className={`size-10 ${OFFSCREEN_STILL}`}><Skeleton raised className="size-10" /></div>
        <span className={`flex min-h-[2.025rem] w-full items-start justify-center pt-0.5 ${OFFSCREEN_STILL}`}><SkeletonLine raised w="70%" h="0.75rem" /></span>
      </div>
    )
  }
  return (
    <div ref={ref} aria-hidden="true" className={DETAIL}>
      <div className={`flex h-11 w-full items-center gap-3 ${OFFSCREEN_STILL}`}>
        <Skeleton raised className="size-11 shrink-0" />
        <div className="min-w-0 flex-1 space-y-1.5"><SkeletonLine raised w="6rem" h="0.9375rem" /><SkeletonLine raised w="3rem" h="0.75rem" /></div>
      </div>
      <div className={`mt-3 min-h-[2.6rem] w-full space-y-2 pt-1 ${OFFSCREEN_STILL}`}><SkeletonLine raised w="95%" h="0.8125rem" /><SkeletonLine raised w="65%" h="0.8125rem" /></div>
      <div className="mt-auto grid w-full grid-cols-3 border-t border-[#2e2417] pt-2.5">
        {[0, 1, 2].map(i => <div key={i} className={`flex h-6 items-center ${OFFSCREEN_STILL}`}><SkeletonLine raised w="3.5rem" h="0.875rem" /></div>)}
      </div>
    </div>
  )
}

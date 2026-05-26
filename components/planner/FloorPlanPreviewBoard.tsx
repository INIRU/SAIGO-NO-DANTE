'use client'

import { useLocale, useTranslations } from 'next-intl'
import { motion, useReducedMotion } from 'motion/react'
import ImageWithFallback from '@/components/ui/ImageWithFallback'
import GiftCard from '@/components/ui/GiftCard'
import { getLegacyPlanFloorDifficulty, isAllowedFloorDifficulty, isFloorDifficulty } from '@/lib/planner/floor-difficulty'
import type { Difficulty, FloorDifficulty, GiftData, ThemeData } from '@/lib/planner/types'
import { getLocalizedName } from '@/lib/i18n/localize'
import type { SupportedLang } from '@/lib/i18n/types'
import {
  getThemePackCompositeImageUrl,
  getThemePackVisualConfig,
} from '@/lib/data/theme-pack-visuals'
import { staggerContainer, workbenchStaggerItem } from '@/lib/animations'

type FloorPreviewEntry = {
  floor: number
  difficulty?: FloorDifficulty
  theme_id: string | null
  gift_ids: string[]
  memo: string
}

type FloorPlanPreviewBoardProps = {
  floorPlan: FloorPreviewEntry[]
  planDifficulty: Difficulty
  themeMap: Map<string, ThemeData>
  giftMap: Map<number, GiftData>
  onGiftClick?: (gift: GiftData) => void
  renderMemo?: (memo: string) => React.ReactNode
}

const FLOOR_PLAN_SEGMENTS = [
  { start: 1, end: 5, labelKey: 'early' },
  { start: 6, end: 10, labelKey: 'loop' },
  { start: 11, end: 15, labelKey: 'extreme' },
] as const

function isEntryConfigured(entry: FloorPreviewEntry) {
  return Boolean(entry.theme_id || entry.gift_ids.length > 0 || entry.memo.trim())
}

function getVisibleEntriesForSegment(floorPlan: FloorPreviewEntry[], start: number, end: number) {
  let highestConfiguredFloor = 0
  for (const entry of floorPlan) {
    if (entry.floor >= start && entry.floor <= end && isEntryConfigured(entry)) {
      highestConfiguredFloor = Math.max(highestConfiguredFloor, entry.floor)
    }
  }
  if (highestConfiguredFloor < start) return []
  return floorPlan.filter(entry => entry.floor >= start && entry.floor <= highestConfiguredFloor)
}

function getFloorDifficulty(entry: FloorPreviewEntry, planDifficulty: Difficulty) {
  return isFloorDifficulty(entry.difficulty) && isAllowedFloorDifficulty(entry.difficulty, entry.floor)
    ? entry.difficulty
    : getLegacyPlanFloorDifficulty(planDifficulty, entry.floor)
}

function getMemoPreview(memo: string) {
  return memo
    .replace(/\[(?:s|p|e|k|i|g):([^\]]+)\]/g, '$1')
    .replace(/\{\{([^}|]+)(?:\|[^}]*)?\}\}/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[#*_`>~-]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function getThemeImageSrc(theme: ThemeData) {
  const numericId = parseInt(String(theme.id), 10)
  return getThemePackVisualConfig(numericId)
    ? getThemePackCompositeImageUrl(numericId)
    : theme.image_url
}

export default function FloorPlanPreviewBoard({
  floorPlan,
  planDifficulty,
  themeMap,
  giftMap,
  onGiftClick,
  renderMemo,
}: FloorPlanPreviewBoardProps) {
  const locale = useLocale() as SupportedLang
  const tFloor = useTranslations('planner.floorTab')
  const shouldReduceMotion = useReducedMotion()
  const segments = FLOOR_PLAN_SEGMENTS
    .map(segment => ({
      ...segment,
      entries: getVisibleEntriesForSegment(floorPlan, segment.start, segment.end),
    }))
    .filter(segment => segment.entries.length > 0)

  if (segments.length === 0) {
    return (
      <div className="rounded-md border border-[#1f1710] bg-[#120e09] px-4 py-5 text-center text-[0.875rem] text-[#6b6255]">
        {tFloor('empty')}
      </div>
    )
  }

  return (
    <motion.div
      className="space-y-3"
      variants={shouldReduceMotion ? undefined : staggerContainer(0.045)}
      initial={shouldReduceMotion ? false : 'initial'}
      whileInView={shouldReduceMotion ? undefined : 'animate'}
      viewport={shouldReduceMotion ? undefined : { once: true, margin: '-60px' }}
    >
      {segments.map(segment => (
        <motion.section
          key={segment.start}
          variants={shouldReduceMotion ? undefined : workbenchStaggerItem}
          className="overflow-hidden rounded-md border border-[#241c14] bg-[#120e09]"
          aria-label={tFloor(`segment.${segment.labelKey}`, { start: segment.start, end: segment.end })}
        >
          <div className="flex items-center justify-between border-b border-[#241c14] bg-[#18120d] px-3 py-2">
            <h3 className="text-[1rem] font-semibold text-[#e8dcc8]">
              {segment.start}-{segment.end}
            </h3>
            <span className="min-w-0 truncate text-[0.875rem] font-medium text-[#9d8d72]">
              {tFloor(`segment.${segment.labelKey}`, { start: segment.start, end: segment.end })}
            </span>
          </div>

          <div className="divide-y divide-[#201810]">
            {segment.entries.map(entry => {
              const floorDifficulty = getFloorDifficulty(entry, planDifficulty)
              const theme = entry.theme_id ? themeMap.get(String(entry.theme_id)) : null
              const themeName = theme
                ? getLocalizedName({ name_kr: theme.name, name_en: theme.name_en, name_jp: theme.name_jp }, locale)
                : tFloor('empty')
              const floorGifts = entry.gift_ids
                .map(id => giftMap.get(parseInt(id, 10)))
                .filter((gift): gift is GiftData => Boolean(gift))
              const shownGifts = floorGifts.slice(0, 4)
              const memoPreview = getMemoPreview(entry.memo)

              const themeImageSrc = theme ? getThemeImageSrc(theme) : null

              return (
                <motion.div
                  key={entry.floor}
                  variants={shouldReduceMotion ? undefined : workbenchStaggerItem}
                  className="grid min-w-0 grid-cols-[2.5rem_minmax(5.75rem,6.75rem)_minmax(0,1fr)] items-stretch gap-3 px-2.5 py-3 sm:min-h-[10.5rem] sm:grid-cols-[2.75rem_minmax(7.25rem,8.5rem)_minmax(0,1fr)] sm:px-3"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded border border-[#3a2a10] bg-[#1a1510] font-mono text-[0.9375rem] font-bold tabular-nums text-[#e8b030] sm:h-11 sm:w-11">
                    {entry.floor}
                  </div>

                  <div className="min-w-0 self-start">
                    <div
                      className="overflow-hidden rounded-md border p-1"
                      style={{
                        borderColor: theme ? 'rgba(200,144,10,0.34)' : '#2a2118',
                        background: theme ? '#1a1510' : '#0d0b08',
                      }}
                    >
                      <div className="relative aspect-[416/684] w-full overflow-hidden rounded-sm bg-[#151210]">
                        {themeImageSrc ? (
                          <ImageWithFallback
                            src={themeImageSrc}
                            alt={themeName}
                            fill
                            fallbackType="theme"
                            sizes="(max-width: 640px) 6.75rem, 8.5rem"
                            className="object-cover saturate-[0.9]"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-[1rem] text-[#3a2a10]">-</div>
                        )}
                        {themeImageSrc && <div className="absolute inset-0 bg-[#080604]/18" aria-hidden="true" />}
                      </div>
                    </div>
                  </div>

                  <div className="flex min-w-0 flex-col justify-between gap-2">
                    <div className="min-w-0 space-y-1.5">
                      <div className="flex min-w-0 flex-wrap items-center gap-2">
                        <span className="inline-flex min-h-8 max-w-full items-center rounded border border-[#3a2a10] bg-[#1a1510] px-2 text-[0.875rem] font-semibold text-[#b9a47f] sm:min-h-9">
                          {tFloor(`difficulty.${floorDifficulty}`)}
                        </span>
                        {theme && (
                          <span className="min-w-0 truncate text-[0.875rem] text-[#6f6354]">
                            {tFloor('themeGiftCount', { count: theme.ego_gift_ids?.length ?? 0 })}
                          </span>
                        )}
                      </div>
                      <div className="min-w-0 text-[1rem] font-semibold leading-snug text-[#e8dcc8]">
                        {themeName}
                      </div>
                    </div>

                    <div
                      className="flex min-w-0 items-center gap-2 rounded-md border px-2 py-1.5"
                      style={{
                        minHeight: '4.5rem',
                        borderColor: floorGifts.length > 0 ? 'rgba(200,144,10,0.22)' : '#241c14',
                        background: floorGifts.length > 0 ? 'rgba(13,11,8,0.62)' : 'rgba(13,11,8,0.34)',
                      }}
                    >
                      {shownGifts.length > 0 ? (
                        <>
                          <div className="flex min-w-0 flex-wrap items-start gap-1.5 overflow-visible">
                            {shownGifts.map(gift => {
                              const giftName = getLocalizedName({ name_kr: gift.name, name_en: gift.name_en, name_jp: gift.name_jp }, locale)
                              return (
                                <div
                                  key={gift.game_id}
                                  className="flex h-12 w-12 flex-shrink-0 items-center justify-center overflow-visible rounded-sm bg-[#17120d]/70 p-0.5"
                                >
                                  <GiftCard
                                    gift={gift}
                                    onClick={() => onGiftClick?.(gift)}
                                    disabled={!onGiftClick}
                                    title={giftName}
                                    ariaLabel={giftName}
                                    size="2.75rem"
                                    showName={false}
                                    className="focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#c8900a]"
                                  />
                                </div>
                              )
                            })}
                          </div>
                          {floorGifts.length > shownGifts.length && (
                            <span className="ml-auto inline-flex min-h-8 shrink-0 items-center rounded border border-[#3a2a10] bg-[#17120d] px-2 font-mono text-[0.875rem] font-semibold text-[#d6bd83]">
                              +{floorGifts.length - shownGifts.length}
                            </span>
                          )}
                        </>
                      ) : (
                        <span className="text-[0.875rem] text-[#5d5144]">{tFloor('acquiredGiftCount', { count: 0 })}</span>
                      )}
                    </div>

                    {memoPreview ? (
                      <details className="group min-w-0 rounded border border-[#241c14] bg-[#0d0b08] px-2.5 py-2">
                        <summary className="min-h-8 cursor-pointer list-none text-[0.9375rem] font-medium leading-snug text-[#9d8d72] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#c8900a] [&::-webkit-details-marker]:hidden">
                          <span className="group-open:hidden">
                            <span className="line-clamp-2">{memoPreview}</span>
                            <span className="mt-1 block font-semibold text-[#c8900a]">{tFloor('memoExpand')}</span>
                          </span>
                          <span className="hidden font-semibold text-[#c8900a] group-open:inline">{tFloor('memoCollapse')}</span>
                        </summary>
                        <div className="mt-2 whitespace-pre-wrap text-[0.9375rem] leading-relaxed text-[#cfc2ad]">
                          {renderMemo ? renderMemo(entry.memo.trim()) : entry.memo.trim()}
                        </div>
                      </details>
                    ) : (
                      <p className="min-w-0 text-[0.875rem] leading-snug text-[#4c4135]">
                        {tFloor('memo')}
                      </p>
                    )}
                  </div>
                </motion.div>
              )
            })}
          </div>
        </motion.section>
      ))}
    </motion.div>
  )
}

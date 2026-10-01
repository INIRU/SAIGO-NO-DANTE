'use client'

import FloorMemoView from './FloorMemoView'

import { isConfiguredFloor } from '@/lib/planner/stripPlanForList'

import './floor-preview.css'
import FloorConstraints from './FloorConstraints'
import FloorGuidance from './FloorGuidance'

import { useLocale, useTranslations } from 'next-intl'
import { useReducedMotion } from 'motion/react'
import * as m from 'motion/react-m'
import ImageWithFallback from '@/components/ui/ImageWithFallback'
import GiftCard from '@/components/ui/GiftCard'
import { getLegacyPlanFloorDifficulty, isAllowedFloorDifficulty, isFloorDifficulty } from '@/lib/planner/floor-difficulty'
import type { Difficulty, FloorDifficulty, GiftData, ThemeData, RecipeData } from '@/lib/planner/types'
import { themeExclusiveGiftIds, withThemeRewards } from '@/lib/planner/fusion'
import { getLocalizedName } from '@/lib/i18n/localize'
import type { SupportedLang } from '@/lib/i18n/types'
import {
  getThemePackCompositeImageUrl,
  getThemePackVisualConfig,
} from '@/lib/data/theme-pack-visuals'
import { staggerContainer, workbenchStaggerItem } from '@/lib/animations'

type FloorPreviewEntry = {
  constraints?: number[]
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
  inventory?: string[]
  recipes?: RecipeData[]
  onGiftClick?: (gift: GiftData) => void
  renderMemo?: (memo: string) => React.ReactNode
  events?: React.ComponentProps<typeof FloorGuidance>['events']
  onEventClick?: (eventId: number) => void
  onEventPrefetch?: () => void
}

const FLOOR_PLAN_SEGMENTS = [
  { start: 1, end: 5, labelKey: 'early' },
  { start: 6, end: 10, labelKey: 'loop' },
  { start: 11, end: 15, labelKey: 'extreme' },
] as const

function isEntryConfigured(entry: FloorPreviewEntry) {
  return isConfiguredFloor(entry)
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
  inventory = [],
  recipes = [],
  onGiftClick,
  renderMemo,
  events,
  onEventClick,
  onEventPrefetch,
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
    <m.div
      className="floor-preview space-y-6"
      variants={shouldReduceMotion ? undefined : staggerContainer(0.045)}
      initial={shouldReduceMotion ? false : 'initial'}
      whileInView={shouldReduceMotion ? undefined : 'animate'}
      viewport={shouldReduceMotion ? undefined : { once: true, margin: '-60px' }}
    >
      {segments.map(segment => (
        <m.section
          key={segment.start}
          variants={shouldReduceMotion ? undefined : workbenchStaggerItem}
          className="space-y-3"
          aria-label={tFloor(`segment.${segment.labelKey}`, { start: segment.start, end: segment.end })}
        >
          <div className="flex items-center justify-between gap-4 px-1 py-2">
            <h3 className="text-[1rem] font-semibold text-[#e8dcc8]">
              {segment.start}-{segment.end}
            </h3>
            <span className="min-w-0 truncate text-[0.875rem] font-medium text-[#9d8d72]">
              {tFloor(`segment.${segment.labelKey}`, { start: segment.start, end: segment.end })}
            </span>
          </div>

          <div className="space-y-3">
            {segment.entries.map(entry => {
              const floorDifficulty = getFloorDifficulty(entry, planDifficulty)
              const theme = entry.theme_id ? themeMap.get(String(entry.theme_id)) : null
              const themeName = theme
                ? getLocalizedName({ name_kr: theme.name, name_en: theme.name_en, name_jp: theme.name_jp }, locale)
                : tFloor('empty')
              // A pack's clear rewards belong to the floor that has it even when the plan did not list them.
              const floorGifts = withThemeRewards(entry.gift_ids, theme)
                .map(id => giftMap.get(parseInt(id, 10)))
                .filter((gift): gift is GiftData => Boolean(gift))
              const memoPreview = getMemoPreview(entry.memo)

              const themeImageSrc = theme ? getThemeImageSrc(theme) : null

              return (
                <m.div
                  key={entry.floor}
                  variants={shouldReduceMotion ? undefined : workbenchStaggerItem}
                  className="floor-preview-row"
                >
                  <div className="floor-preview-number">
                    {String(entry.floor).padStart(2, '0')}
                  </div>

                  <div className="floor-preview-cover">
                    <div
                      className="overflow-hidden rounded-md"
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
                            sizes="(max-width: 640px) 80px, 112px"
                            className="object-cover saturate-[0.9]"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-[1rem] text-[#3a2a10]">-</div>
                        )}
                        {themeImageSrc && <div className="absolute inset-0 bg-[#080604]/18" aria-hidden="true" />}
                      </div>
                    </div>
                  </div>

                  <div className="floor-preview-content flex min-w-0 flex-col gap-4">
                    <div className="min-w-0 space-y-1.5">
                      <div className="flex min-w-0 flex-wrap items-center gap-2">
                        <span className="inline-flex items-center rounded bg-[#c8900a14] px-2 py-1 text-xs font-medium text-[#b9a47f]">
                          {tFloor(`difficulty.${floorDifficulty}`)}
                        </span>
                        {theme && (
                          <span className="min-w-0 truncate text-[0.875rem] text-[#6f6354]">
                            {tFloor('themeGiftCount', { count: theme.ego_gift_ids?.length ?? 0 })}
                          </span>
                        )}
                      </div>
                      <div className="min-w-0 font-[family-name:var(--font-paperlogy)] text-lg font-semibold leading-snug text-[#e8dcc8]">
                        {themeName}
                      </div>
                    </div>

                    <div className="flex min-w-0 items-start">
                      {floorGifts.length > 0 ? (
                        <div className="flex min-w-0 flex-1 flex-wrap items-start gap-1.5 overflow-visible">
                          {floorGifts.map(gift => {
                            const giftName = getLocalizedName({ name_kr: gift.name, name_en: gift.name_en, name_jp: gift.name_jp }, locale)
                            return (
                              <div
                                key={gift.game_id}
                                className="relative flex h-14 w-14 flex-shrink-0 items-center justify-center overflow-visible"
                              >
                                <GiftCard
                                  gift={gift}
                                  warning={themeExclusiveGiftIds(theme).includes(gift.game_id) ? (locale === 'ko' ? '테마팩 전용 · 이 층에서 획득' : locale === 'ja' ? 'テーマ専用・この階で入手' : 'Pack exclusive · obtain on this floor') : undefined}
                                  onClick={() => onGiftClick?.(gift)}
                                  disabled={!onGiftClick}
                                  title={giftName}
                                  ariaLabel={giftName}
                                  size="3.25rem"
                                  showName={false}
                                  className="focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#c8900a]"
                                />
                              </div>
                            )
                          })}
                        </div>
                      ) : (
                        <span className="text-[0.875rem] text-[#5d5144]">{tFloor('acquiredGiftCount', { count: 0 })}</span>
                      )}
                    </div>

                    {memoPreview ? (
                      <FloorMemoView moreLabel={tFloor('memoExpand')} lessLabel={tFloor('memoCollapse')}>
                        {renderMemo ? renderMemo(entry.memo.trim()) : entry.memo.trim()}
                      </FloorMemoView>
                    ) : null}
                  </div>
                  <div className="floor-preview-guidance"><FloorGuidance entry={entry} entries={floorPlan} inventory={inventory} recipes={recipes} gifts={giftMap} onGiftClick={onGiftClick} events={events} onEventClick={onEventClick} onEventPrefetch={onEventPrefetch} /></div>
                  {entry.floor >= 11 && <div className="col-span-full"><FloorConstraints floor={entry.floor} entries={floorPlan} /></div>}
                </m.div>
              )
            })}
          </div>
        </m.section>
      ))}
    </m.div>
  )
}

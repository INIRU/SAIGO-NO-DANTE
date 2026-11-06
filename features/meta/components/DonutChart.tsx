'use client'

import Image from 'next/image'
import { useReducedMotion } from 'motion/react'
import * as m from 'motion/react-m'
import type { ReactNode } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { useKeywordData, useKeywords } from '@/components/providers/KeywordProvider'
import { localizeDeckKeyword } from '@/features/decks'
import { CONTENT_TYPE_COLORS } from '@/lib/constants/deck-tokens'
import { GIFT_KEYWORD_COLORS } from '@/lib/constants/gift'
import type { CountStat, MetaUsage } from '@/lib/meta/types'
import styles from '@/styles/components/MetaAnalysis.module.css'

export type DonutSegment = { key: string; label: ReactNode; colors: string[]; count: number }

export const OTHER = '__other'
const LEGEND_LIMIT = 6
/** Keeps the largest slices readable; the rest share one slice. */
export function collapse(rows: CountStat[]): CountStat[] {
  if (rows.length <= LEGEND_LIMIT + 1) return rows
  return [...rows.slice(0, LEGEND_LIMIT), { key: OTHER, count: rows.slice(LEGEND_LIMIT).reduce((sum, row) => sum + row.count, 0) }]
}

/** Content and keyword deck donut slices. */
export function useSegments() {
  const t = useTranslations('meta.analysis')
  return {
    usage: (rows: CountStat[]): DonutSegment[] => rows.map(row => ({ key: row.key, count: row.count, colors: [usageColor(row.key as MetaUsage)], label: t('usage.' + row.key) })),
    combo: (rows: CountStat[]): DonutSegment[] => collapse(rows).map(row => row.key === OTHER
      ? { key: OTHER, count: row.count, colors: ['#3a2a15'], label: t('others', { count: rows.length - LEGEND_LIMIT }) }
      : { key: row.key, count: row.count, colors: comboColors(row.key), label: <ComboLabel combo={row.key} /> }),
  }
}

const RADIUS = 40
const GAP = 0.008
const MUTED = '#6a6058'
const USAGE_COLOR_KEY: Record<MetaUsage, string | null> = {
  mirrorDungeon: '거던15층', story: '스토리', expDungeon: '경험치 던전', threadDungeon: '끈 던전',
  refractionRailway: '거굴철', reflectrial: '사영 전투', none: null,
}

export function usageColor(usage: MetaUsage): string {
  const key = USAGE_COLOR_KEY[usage]
  return key ? CONTENT_TYPE_COLORS[key].color : MUTED
}

export function comboColors(combo: string): string[] {
  return combo ? combo.split('+').slice(0, 2).map(keyword => GIFT_KEYWORD_COLORS[keyword] ?? MUTED) : [MUTED]
}

/** '화상+진동' as keyword icons and localized names; '' is a formation no keyword reached. */
export function ComboLabel({ combo }: { combo: string }) {
  const t = useTranslations('meta.analysis')
  const locale = useLocale()
  const keywords = useKeywords()
  const { getIconUrl } = useKeywordData()
  if (!combo) return <>{t('mixed')}</>
  return <span className={styles.combo}>{combo.split('+').map((keyword, i) => {
    const icon = getIconUrl(keyword)
    return <span key={keyword}>{i > 0 && <b aria-hidden="true">+</b>}{icon && <Image src={icon} alt="" width={16} height={16} />}{localizeDeckKeyword(keyword, keywords[keyword], locale)}</span>
  })}</span>
}

/**
 * Ring plus legend. The centre shows the clicked segment (the largest one until then);
 * a two-keyword combo is drawn as an outer and inner half ring in both keyword colours.
 */
export default function DonutChart({ segments, active, onSelect, label }: {
  segments: DonutSegment[]
  active: string | null
  onSelect: (key: string | null) => void
  label: string
}) {
  const t = useTranslations('meta.analysis')
  const reduceMotion = useReducedMotion()
  const total = segments.reduce((sum, segment) => sum + segment.count, 0)
  const focus = segments.find(segment => segment.key === active) ?? segments[0]
  const share = (count: number) => (total ? count / total * 100 : 0)
  let start = 0
  return <div className={styles.donut}>
    <div className={styles.donutRing}>
      <svg viewBox="0 0 100 100" aria-hidden="true">
        <circle cx="50" cy="50" r={RADIUS} className={styles.donutTrack} />
        <g transform="rotate(-90 50 50)">
          {segments.flatMap((segment, i) => {
            const fraction = total ? segment.count / total : 0
            const offset = start
            start += fraction
            const length = Math.max(fraction - (segments.length > 1 ? GAP : 0), 0.001)
            const rings: [number, string, number][] = segment.colors.length > 1
              ? [[RADIUS + 3.25, segment.colors[0], 6.5], [RADIUS - 3.25, segment.colors[1], 6.5]]
              : [[RADIUS, segment.colors[0], 13]]
            const dimmed = active !== null && focus?.key !== segment.key
            return rings.map(([r, color, width], ring) => <m.circle key={segment.key + ring} cx="50" cy="50" r={r} fill="none" stroke={color} strokeWidth={width}
              initial={reduceMotion ? false : { pathLength: 0, pathOffset: offset }}
              animate={{ pathLength: length, pathOffset: offset, opacity: dimmed ? 0.28 : 1 }}
              transition={reduceMotion ? { duration: 0 } : { duration: 0.7, delay: i * 0.05, ease: [0.22, 1, 0.36, 1] }} />)
          })}
        </g>
      </svg>
      {focus && <div className={styles.donutCenter}>
        <strong>{share(focus.count).toFixed(0)}<small>%</small></strong>
        <span>{focus.label}</span>
        <em>{t('count', { count: focus.count })}</em>
      </div>}
    </div>
    <ul className={styles.legend} aria-label={label}>
      {segments.map(segment => <li key={segment.key}>
        <button type="button" aria-pressed={active === segment.key} onClick={() => onSelect(active === segment.key ? null : segment.key)} className={styles.legendRow}>
          <i style={{ background: segment.colors.length > 1 ? 'linear-gradient(135deg, ' + segment.colors[0] + ' 50%, ' + segment.colors[1] + ' 50%)' : segment.colors[0] }} />
          <span className={styles.legendLabel}>{segment.label}</span>
          <span className={styles.legendShare}>{share(segment.count).toFixed(1)}<small>%</small></span>
          <span className={styles.legendCount}>{t('count', { count: segment.count })}</span>
        </button>
      </li>)}
    </ul>
  </div>
}

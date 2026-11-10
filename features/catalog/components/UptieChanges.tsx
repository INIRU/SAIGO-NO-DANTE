'use client'

import { useMemo } from 'react'
import Image from 'next/image'
import { useLocale, useTranslations } from 'next-intl'
import { useFormatSkillDesc } from '@/components/providers/KeywordProvider'
import CoinBadge from '@/features/catalog/components/CoinBadge'
import { gameTextToPlain, mayBeRawGameText, refNameLabels } from '@/lib/game-text/rich-text'
import { useGameTextRefs, wantGameTextRefs } from '@/lib/hooks/useGameTextRefs'
import type { LineChange, NumDiff } from '@/lib/utils/uptie-diff'

export const UPTIE_NUMERALS = ['', 'I', 'II', 'III', 'IV'] as const

/** The game's numeral sprite shared with E.G.O stages; the 224×192 canvas pads the glyph, hence the 1.08 scale. */
export function UptieNumeral({ level, height = '1.25rem' }: { level: number; height?: string }) {
  return (
    <Image src={`/assets/ego-stages/${level}.webp`} alt="" width={224} height={192} unoptimized
      style={{ width: 'auto', height: `calc(${height} * 1.08)`, maxWidth: 'none' }} />
  )
}

export type StatChange = { label: string; diff: NumDiff; signed?: boolean }

const signed = (n: number) => (n > 0 ? `+${n}` : `${n}`)

/** What changes at the next uptie: stat deltas, then removed (struck) and added (highlighted) lines. */
export function UptieChangePanel({ level, title, stats = [], lines, accentColor, skillNameColors, allowedKeywords, matchPlainKeywords }: {
  level: number
  title?: React.ReactNode
  stats?: StatChange[]
  lines: LineChange[]
  accentColor: string
  skillNameColors?: Record<string, string>
  allowedKeywords?: ReadonlySet<string>
  /** The text is a skill or passive of an identity / E.G.O: draw `allowedKeywords` written as plain words. */
  matchPlainKeywords?: boolean
}) {
  const t = useTranslations()
  const format = useFormatSkillDesc()
  const locale = useLocale()
  const { names } = useGameTextRefs({ lazy: true })
  const labels = useMemo(() => (names ? refNameLabels(names) : undefined), [names])
  // A removed line is struck-through plain text: game text loses its tags and shows names, older text stays as written.
  const plain = (text: string) => {
    if (!mayBeRawGameText(text)) return text
    wantGameTextRefs()
    return gameTextToPlain(text, { names: labels, locale })
  }
  if (!title && stats.length === 0 && lines.length === 0) return null
  return (
    <section
      aria-label={t('identity.uptie.changesAt', { level: UPTIE_NUMERALS[level] ?? level })}
      className="mt-3 rounded-sm border border-[var(--border)] bg-[var(--bg-panel)] px-3 py-2.5 text-[.8125rem] leading-[1.7]"
    >
      <div className="mb-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs" style={{ color: 'var(--gold)', fontFamily: 'var(--font-heading)' }}>
        <UptieNumeral level={level} height="0.875rem" />
        <span>{t('identity.uptie.changes')}</span>
        {title}
      </div>
      {stats.length > 0 && (
        <ul className="mb-1 flex flex-wrap gap-x-4 gap-y-1">
          {stats.map(({ label, diff, signed: sign }) => (
            <li key={label} className="text-[var(--text-secondary)]">
              {label}{' '}
              <span className="tabular-nums text-[var(--text-muted)]">{sign ? signed(diff.from) : diff.from}</span>
              <span aria-hidden className="mx-1 text-[var(--text-muted)]">→</span>
              <b className="tabular-nums" style={{ color: diff.to > diff.from ? 'var(--gold-light)' : '#e69b86' }}>{sign ? signed(diff.to) : diff.to}</b>
            </li>
          ))}
        </ul>
      )}
      {lines.length > 0 && (
        <ul className="space-y-0.5">
          {lines.map((line, i) => (
            <li key={i} className="flex items-start gap-2">
              <span aria-hidden className="w-2.5 shrink-0 text-center font-bold" style={{ color: line.kind === 'added' ? 'var(--gold-light)' : '#6f6352' }}>
                {line.kind === 'added' ? '+' : '−'}
              </span>
              {line.coin > 0 && <span className="mt-[.2rem]"><CoinBadge number={line.coin} size="1.25rem" /></span>}
              <span className="sr-only">{t(line.kind === 'added' ? 'identity.uptie.added' : 'identity.uptie.removed')}: </span>
              {line.kind === 'added'
                ? <span className="min-w-0 text-[#d8cfbf]">{format(line.text, accentColor, skillNameColors, allowedKeywords, matchPlainKeywords ? { matchPlainKeywords } : undefined)}</span>
                : <s className="min-w-0 text-[#8f8270] decoration-[#8f8270]">{plain(line.text)}</s>}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

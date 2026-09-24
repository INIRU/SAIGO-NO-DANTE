'use client'

import { useLocale, useTranslations } from 'next-intl'
import { ArrowRight } from 'lucide-react'
import ImageWithFallback from '@/components/ui/ImageWithFallback'
import { SINNER_SLUGS } from '@/lib/constants/game'
import { SIN_COLORS, normalizeSin } from '@/lib/constants/sin'
import { translations } from '@/lib/i18n/translations'
import type { SupportedLang } from '@/lib/i18n/types'
import { getIdentitySkillDistribution, type IdentitySlot, type SkillSummary } from '@/lib/planner/types'
import { getSkillIconUrl } from '@/lib/utils/images'
import { skillExchangeMoves, type SkillExchangeRead } from '@/lib/vision/skill-exchange'

/** Sinner number (1 = Yi Sang … 12 = Gregor) of a deck slot: from its identity id (10801 → 8), else its slug. */
const slotSinner = (slot: IdentitySlot) => slot.game_id && /^1\d{4}$/.test(slot.game_id) ? Number(slot.game_id.slice(1, 3))
  : SINNER_SLUGS.indexOf(slot.sinner_id) + 1

/**
 * Shop skill replacement window: the planned identity's three skills as game-style frames with their current and planned
 * copies, and the replacements to buy.
 */
export default function CompanionSkillExchange({ exchange, slots, skills }: { exchange: SkillExchangeRead; slots: IdentitySlot[]; skills: SkillSummary[] }) {
  const t = useTranslations('planner.run')
  const locale = useLocale() as SupportedLang
  const slug = SINNER_SLUGS[exchange.sinner - 1]
  const names = translations[`sinner.${slug}` as keyof typeof translations] as Record<SupportedLang, string>
  const slot = slots.find(item => slotSinner(item) === exchange.sinner)
  const target = slot ? getIdentitySkillDistribution(slot) : null
  const moves = target && exchange.current ? skillExchangeMoves(exchange.current, target) : undefined
  // The highest uptie version of each skill, as on the plan summary.
  const skill = (order: number) => slot ? skills.filter(item => item.identity_id === slot.identity_id && item.skill_order === order)
    .sort((a, b) => (b.uptie_level ?? 0) - (a.uptie_level ?? 0))[0] ?? null : null
  const color = (order: number) => SIN_COLORS[normalizeSin(skill(order)?.sin_affinity ?? null) ?? 'wrath'] ?? '#888'
  const icon = (order: number, size: number) => slot?.game_id
    ? <span className="relative block shrink-0 overflow-hidden rounded-full border-2" style={{ width: size, height: size, borderColor: color(order) }}>
      <ImageWithFallback src={getSkillIconUrl({ sinner_id: slug, game_id: slot.game_id }, order)} alt="" fill fallbackType="skill" sizes={`${size}px`} className="object-cover" />
    </span>
    : <span className="grid shrink-0 place-items-center rounded-full border-2 text-xs font-bold" style={{ width: size, height: size, borderColor: color(order), color: color(order) }}>S{order}</span>
  return <section data-skill-exchange={exchange.sinner} role="status" className="space-y-2">
    <h3 className="text-sm font-bold text-[var(--gold-light)]">{t('skillExchangeTitle', { sinner: names[locale] ?? names.ko })}</h3>
    {!target ? <p className="text-xs text-[var(--text-secondary)]">{t('skillExchangeNotInPlan')}</p> : <>
      {locale === 'ko' && slot?.name_kr && <p className="text-xs text-[var(--text-secondary)]">{slot.name_kr}</p>}
      <ul className="space-y-1.5">{[1, 2, 3].map(order => {
        const now = exchange.current?.[order - 1]
        const planned = target[order - 1]
        const changed = now !== undefined && now !== planned
        return <li key={order} data-skill-row={order} className="flex items-center gap-2 rounded border border-[var(--border)] bg-[var(--bg-elevated)] p-1.5">
          {icon(order, 40)}
          <span className="min-w-0 flex-1">
            <span className="block text-[0.65rem] font-bold text-[var(--text-tertiary)]">SKILL {order}</span>
            <span className="block truncate px-1.5 py-0.5 text-xs font-bold text-white" style={{ background: `linear-gradient(90deg, ${color(order)} 70%, transparent)` }}>{skill(order)?.name ?? `S${order}`}</span>
          </span>
          <span className="shrink-0 text-right font-[family-name:var(--font-mono)] text-sm" aria-label={now === undefined ? t('skillExchangePlanOnly', { target: planned }) : t('skillExchangeCounts', { current: now, target: planned })}>
            {now !== undefined && <span className="text-[var(--text-secondary)]">×{now} → </span>}
            <span className={changed ? 'font-bold text-[var(--gold-light)]' : 'text-[var(--text-primary)]'}>×{planned}</span>
          </span>
        </li>
      })}</ul>
      {moves === undefined ? <p className="text-xs text-[var(--text-tertiary)]">{t('skillExchangeReading')}</p>
        : moves === null ? <p className="text-xs text-[var(--text-secondary)]">{t('skillExchangeUnreachable')}</p>
        : moves.length === 0 ? <p className="text-xs text-[var(--text-secondary)]">{t('skillExchangeDone')}</p>
        : <ul className="flex flex-wrap gap-1.5" aria-label={t('skillExchangeBuy')}>{moves.map(move => <li key={`${move.from}-${move.to}`} data-skill-move={`${move.from}-${move.to}`}
          aria-label={t('skillExchangeMove', { ...move })} className="flex items-center gap-1 rounded border border-[var(--border-gold)] px-2 py-1 text-sm font-bold text-[var(--gold-light)]">
          {icon(move.from, 24)}<ArrowRight size={14} aria-hidden="true" />{icon(move.to, 24)}<span>×{move.count}</span>
        </li>)}</ul>}
    </>}
  </section>
}

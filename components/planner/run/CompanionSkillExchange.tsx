'use client'

import { useLocale, useTranslations } from 'next-intl'
import { SINNER_SLUGS } from '@/lib/constants/game'
import { translations } from '@/lib/i18n/translations'
import type { SupportedLang } from '@/lib/i18n/types'
import { getIdentitySkillDistribution, type IdentitySlot } from '@/lib/planner/types'
import { skillExchangeMoves, type SkillExchangeRead } from '@/lib/vision/skill-exchange'

/** Sinner number (1 = Yi Sang … 12 = Gregor) of a deck slot: from its identity id (10801 → 8), else its slug. */
const slotSinner = (slot: IdentitySlot) => slot.game_id && /^1\d{4}$/.test(slot.game_id) ? Number(slot.game_id.slice(1, 3))
  : SINNER_SLUGS.indexOf(slot.sinner_id) + 1

/** Shop skill replacement window: the plan's skill counts for the sinner on screen and the replacements to buy. */
export default function CompanionSkillExchange({ exchange, slots }: { exchange: SkillExchangeRead; slots: IdentitySlot[] }) {
  const t = useTranslations('planner.run')
  const locale = useLocale() as SupportedLang
  const slug = SINNER_SLUGS[exchange.sinner - 1]
  const names = translations[`sinner.${slug}` as keyof typeof translations] as Record<SupportedLang, string>
  const slot = slots.find(item => slotSinner(item) === exchange.sinner)
  const target = slot ? getIdentitySkillDistribution(slot) : null
  const moves = target && exchange.current ? skillExchangeMoves(exchange.current, target) : undefined
  return <section data-skill-exchange={exchange.sinner} role="status" className="space-y-1.5 rounded border border-[var(--border-gold)] bg-[var(--bg-elevated)] p-2">
    <h3 className="text-xs font-bold text-[var(--gold-light)]">{t('skillExchangeTitle', { sinner: names[locale] ?? names.ko })}</h3>
    {!target ? <p className="text-xs text-[var(--text-secondary)]">{t('skillExchangeNotInPlan')}</p> : <>
      <p className="text-xs text-[var(--text-secondary)]">{exchange.current
        ? t('skillExchangeCounts', { current: exchange.current.join('·'), target: target.join('·') })
        : t('skillExchangePlanOnly', { target: target.join('·') })}</p>
      {moves === undefined ? <p className="text-xs text-[var(--text-tertiary)]">{t('skillExchangeReading')}</p>
        : moves === null ? <p className="text-xs text-[var(--text-secondary)]">{t('skillExchangeUnreachable')}</p>
        : moves.length === 0 ? <p className="text-xs text-[var(--text-secondary)]">{t('skillExchangeDone')}</p>
        : <ul className="flex flex-wrap gap-1.5">{moves.map(move => <li key={`${move.from}-${move.to}`} data-skill-move={`${move.from}-${move.to}`}
          className="rounded border border-[var(--border)] px-2 py-1 text-sm font-semibold text-[var(--text-primary)]">{t('skillExchangeMove', { ...move })}</li>)}</ul>}
    </>}
  </section>
}

'use client'

import Image from 'next/image'
import { useLocale, useTranslations } from 'next-intl'
import { getLocalizedAffiliation, localizeGiftKeyword } from '@/lib/i18n/localize'
import { getAffiliationIconUrl } from '@/lib/constants/affiliation-icons'
import { getGiftKeywordIconUrl, getGiftKeywordSlug } from '@/lib/constants/gift'
import { STORAGE_BASE } from '@/lib/constants/game'
import type { GiftConditionScope, GiftConditionStatus } from '@/lib/planner/gift-condition-status'
import type { SupportedLang } from '@/lib/i18n/types'
import styles from './GiftCondition.module.css'

/** A condition status in the page language: its subject (keywords or affiliations) and both counts. */
export function useGiftConditionText() {
  const t = useTranslations('planner.giftTab.conditionStatus')
  const lang = useLocale() as SupportedLang
  return (status: GiftConditionStatus) => {
    const subject = status.subjects
      .map(value => status.kind === 'keyword' ? localizeGiftKeyword(value, lang) : status.kind === 'skill' ? value : getLocalizedAffiliation(value, lang))
      .join(status.kind === 'keyword' ? '+' : '/')
    const formation = t('formation', { have: status.formation, need: status.need })
    const withBench = t('withBench', { have: status.all, need: status.need })
    const tier = status.tier ? t('tier', { reached: status.tier.reached, total: status.tier.total }) : ''
    // A gift that says which head count it reads shows that one count only.
    const counts = status.scope === 'deployed' ? formation : status.scope === 'formation' ? withBench : formation + ', ' + withBench
    const summary = subject + ' ' + counts + (tier ? ', ' + tier : '') + (status.partial ? ', ' + t('partial') : '')
    return { subject, formation, withBench, tier, summary, title: t(status.level === 'unmet' ? 'unmetTitle' : 'warnTitle', { text: summary }) }
  }
}

function subjectIcon(status: GiftConditionStatus): string | null {
  const first = status.subjects[0]
  if (!first || status.kind === 'skill') return null
  return status.kind === 'keyword' ? getGiftKeywordIconUrl(getGiftKeywordSlug(first) ?? 'general') : getAffiliationIconUrl(first)
}
/**
 * Inside the gift art (a size container): a name plate over a dark fade at the bottom of the art, like the game's
 * item plates, naming the condition (icon and keyword or affiliation) and the deployed count against the requirement.
 * Unmet also darkens the rest of the art. Sizes follow the card through cqw.
 */
export function GiftConditionMark({ status }: { status: GiftConditionStatus }) {
  const text = useGiftConditionText()(status)
  const icon = subjectIcon(status)
  return (
    <span className={styles.mark} data-level={status.level} data-partial={status.partial ? '' : undefined} title={text.title}>
      <span className={styles.plate}>
        {icon && <Image src={icon} alt="" width={24} height={24} className={styles.icon} />}
        {/* The plate is narrow: "The Ring" reads as "Ring" (the full name stays in the title). */}
        <span className={styles.subject}>{text.subject.replace(/(^|\/)The /g, '$1')}</span>
        <span className={styles.count}><b>{status.formation}</b><i>/{status.need}</i></span>
      </span>
    </span>
  )
}

/** Under the card: the count once the bench is included. */
export function GiftConditionLine({ status }: { status: GiftConditionStatus }) {
  const text = useGiftConditionText()(status)
  return <span className={styles.line} data-level={status.level} title={text.title}>{status.scope === 'deployed' ? text.formation : text.withBench}{text.tier && ' · ' + text.tier}</span>
}

const LOCK_URL = `${STORAGE_BASE}/icons/ui/lock.webp`

type PlateCondition = {
  type: string; keyword?: string; keywords?: string[]; affiliation?: string; affiliations?: string[]
  count?: number | null; tiers?: { count: number }[] | null; partial?: boolean
}

function conditionIcons(condition: PlateCondition): string[] {
  const known = (src: string | null): src is string => !!src
  if (condition.type === 'affiliation') return (condition.affiliations ?? (condition.affiliation ? [condition.affiliation] : [])).map(getAffiliationIconUrl).filter(known)
  if (condition.type === 'keyword' || condition.type === 'multi_keyword') {
    return (condition.keywords ?? (condition.keyword ? [condition.keyword] : [])).map(k => getGiftKeywordIconUrl(getGiftKeywordSlug(k) ?? 'general')).filter(known)
  }
  return []
}

/**
 * The gift's condition as the game marks a locked effect: the lock, the keyword or affiliation icons and the rule; under
 * it the head count it reads, and with a formation the count as pips (gold: deployed, outlined: the bench) against the need.
 */
export function GiftConditionPlate({ text, condition, scope, status, gatedShown = false, onToggleGated }: {
  text: string; condition?: PlateCondition | null; scope?: GiftConditionScope | null; status?: GiftConditionStatus | null
  /** The lock is a switch when there is an effect to mark: pressed, the effect lines the condition decides turn gold. */
  gatedShown?: boolean; onToggleGated?: () => void
}) {
  const t = useTranslations('giftDetail')
  const summary = useGiftConditionText()
  const icons = condition ? conditionIcons(condition) : []
  const tiers = (condition?.tiers ?? []).map(tier => tier.count).filter(Boolean)
  const counted = status ? (status.scope === 'formation' ? status.all : status.formation) : 0
  const bench = status && !status.scope ? Math.max(0, status.all - status.formation) : 0
  return (
    <div className={styles.lockPlate} data-level={status?.level ?? 'met'} data-partial={condition?.partial ? '' : undefined}>
      {onToggleGated
        ? <button type="button" className={styles.lockButton} aria-pressed={gatedShown} onClick={onToggleGated} title={t('showGated')} aria-label={t('showGated')}>
          <Image src={LOCK_URL} alt="" width={118} height={157} className={styles.lock} />
        </button>
        : <Image src={LOCK_URL} alt="" width={118} height={157} className={styles.lock} />}
      <div className={styles.lockBody}>
        <p className={styles.lockRule}>
          {icons.map(src => <Image key={src} src={src} alt="" width={24} height={24} className={styles.lockIcon} />)}
          <span>{text}</span>
        </p>
        <p className={styles.lockTags}>
          {/* Which effects it decides: all of them, or the locked lines of the effect below. */}
          <span data-on={gatedShown ? '' : undefined}>{t(condition?.partial ? 'partialOnly' : 'allEffects')}</span>
          {scope && <span>{t(scope === 'deployed' ? 'scopeDeployed' : 'scopeFormation')}</span>}
          {tiers.length > 1 && <span>{t('tierSteps', { steps: tiers.join(' / ') })}</span>}
        </p>
        {status && <p className={styles.lockStatus} aria-label={summary(status).title}>
          <span className={styles.pips} aria-hidden="true">
            {Array.from({ length: Math.min(status.need, 12) }, (_, i) => <i key={i} data-fill={i < counted ? 'deployed' : i < counted + bench ? 'bench' : undefined} />)}
          </span>
          <b aria-hidden="true">{counted}<small>/{status.need}</small></b>
          <em aria-hidden="true">{t(status.level === 'unmet' ? 'conditionUnmet' : 'conditionWarn')}</em>
        </p>}
      </div>
    </div>
  )
}

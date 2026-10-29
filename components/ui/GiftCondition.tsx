'use client'

import Image from 'next/image'
import { useLocale, useTranslations } from 'next-intl'
import { getLocalizedAffiliation, localizeGiftKeyword } from '@/lib/i18n/localize'
import { getAffiliationIconUrl } from '@/lib/constants/affiliation-icons'
import { getGiftKeywordIconUrl, getGiftKeywordSlug } from '@/lib/constants/gift'
import type { GiftConditionStatus } from '@/lib/planner/gift-condition-status'
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
    const summary = subject + ' ' + formation + ', ' + withBench + (tier ? ', ' + tier : '') + (status.partial ? ', ' + t('partial') : '')
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
  return <span className={styles.line} data-level={status.level} title={text.title}>{text.withBench}{text.tier && ' · ' + text.tier}</span>
}

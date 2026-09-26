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
      .map(value => status.kind === 'keyword' ? localizeGiftKeyword(value, lang) : getLocalizedAffiliation(value, lang))
      .join(status.kind === 'keyword' ? '+' : '/')
    const formation = t('formation', { have: status.formation, need: status.need })
    const withBench = t('withBench', { have: status.all, need: status.need })
    const summary = subject + ' ' + formation + ', ' + withBench
    return { subject, formation, withBench, summary, title: t(status.level === 'unmet' ? 'unmetTitle' : 'warnTitle', { text: summary }) }
  }
}

function subjectIcon(status: GiftConditionStatus): string | null {
  const first = status.subjects[0]
  if (!first) return null
  return status.kind === 'keyword' ? getGiftKeywordIconUrl(getGiftKeywordSlug(first) ?? 'general') : getAffiliationIconUrl(first)
}

/**
 * Inside the gift art (a size container): the deployed count against the requirement, with the condition's icon.
 * Unmet also dims the art. Sizes follow the card through cqw.
 */
export function GiftConditionMark({ status }: { status: GiftConditionStatus }) {
  const text = useGiftConditionText()(status)
  const icon = subjectIcon(status)
  return (
    <span className={styles.mark} data-level={status.level} title={text.title}>
      <span className={styles.pill}>
        {icon && <Image src={icon} alt="" width={24} height={24} className={styles.icon} />}
        <b>{status.formation}</b><i>/{status.need}</i>
      </span>
    </span>
  )
}

/** Under the card: the count once the bench is included. */
export function GiftConditionLine({ status }: { status: GiftConditionStatus }) {
  const text = useGiftConditionText()(status)
  return <span className={styles.line} data-level={status.level} title={text.title}>{text.withBench}</span>
}

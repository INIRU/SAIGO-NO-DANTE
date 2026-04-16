'use client'

import { useLocale } from 'next-intl'
import PageError from '@/components/ui/PageError'
import { translations } from '@/lib/i18n/translations'
import type { SupportedLang } from '@/lib/i18n/types'

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const locale = useLocale()
  const lang = locale as SupportedLang
  const t = (key: string) => {
    const entry = translations[key as keyof typeof translations]
    if (!entry) return key
    return entry[lang] ?? entry['ko'] ?? key
  }

  return <PageError quote={t('keyword.error.quote')} subQuote={t('keyword.error.subQuote')} reset={reset} />
}

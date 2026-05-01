'use client'

import { useTranslations } from 'next-intl'
import PageError from '@/components/ui/PageError'

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useTranslations('decks.detail')
  return <PageError quote={t('errorQuote')} subQuote={t('errorSubQuote')} reset={reset} homeHref="/decks" homeLabel={t('errorHome')} />
}

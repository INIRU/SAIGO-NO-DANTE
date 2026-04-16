'use client'

import { useLocale } from 'next-intl'
import { translations } from '@/lib/i18n/translations'
import type { SupportedLang } from '@/lib/i18n/types'
import PageError from '@/components/ui/PageError'

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const locale = useLocale()
  const lang = locale as SupportedLang
  const t = (key: string) => {
    const entry = translations[key as keyof typeof translations]
    if (!entry) return key
    return entry[lang] ?? entry['ko'] ?? key
  }

  const quotes: Record<SupportedLang, { quote: string; subQuote: string }> = {
    ko: { quote: '거울이 깨졌나 봐.', subQuote: '조각을 주워볼게.' },
    en: { quote: 'The mirror seems broken.', subQuote: "Let me pick up the pieces." },
    ja: { quote: '鏡が割れたみたい。', subQuote: '欠片を拾ってみるね。' },
  }

  const { quote, subQuote } = quotes[lang] ?? quotes.ko

  return <PageError quote={quote} subQuote={subQuote} reset={reset} homeLabel={t('mirrorDungeon.error.retry')} />
}

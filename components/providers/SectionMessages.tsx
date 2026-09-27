'use client'

import { useMemo, type ReactNode } from 'react'
import { NextIntlClientProvider, useLocale, useMessages, useTimeZone, type AbstractIntlMessages } from 'next-intl'
import { mergeMessages } from '@/lib/i18n/client-messages'

/** Adds one route section's messages to those the root layout sent (a nested provider would otherwise replace them). */
export default function SectionMessages({ messages, children }: { messages: AbstractIntlMessages; children: ReactNode }) {
  const parent = useMessages()
  const locale = useLocale()
  const timeZone = useTimeZone()
  const merged = useMemo(() => mergeMessages(parent, messages), [parent, messages])
  return <NextIntlClientProvider locale={locale} timeZone={timeZone} messages={merged}>{children}</NextIntlClientProvider>
}

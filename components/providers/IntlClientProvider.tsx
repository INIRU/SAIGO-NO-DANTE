'use client'

import { NextIntlClientProvider } from 'next-intl'
import type { ComponentProps } from 'react'

/** Imported from a client module so next-intl's server wrapper (which reads the request locale) stays out of the static <html> shell. */
export default function IntlClientProvider(props: ComponentProps<typeof NextIntlClientProvider>) {
  return <NextIntlClientProvider {...props} />
}

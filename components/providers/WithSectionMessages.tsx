import type { ReactNode } from 'react'
import { getMessages } from 'next-intl/server'
import SectionMessages from '@/components/providers/SectionMessages'
import { SECTION_MESSAGES, pickMessages } from '@/lib/i18n/client-messages'

/** Wraps a route section with the client messages only it reads (see SECTION_MESSAGES). */
export default async function WithSectionMessages({ section, lang, children }: { section: keyof typeof SECTION_MESSAGES; lang: string; children: ReactNode }) {
  const messages = await getMessages({ locale: lang })
  return <SectionMessages messages={pickMessages(messages, SECTION_MESSAGES[section])}>{children}</SectionMessages>
}

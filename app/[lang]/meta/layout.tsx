import type { ReactNode } from 'react'
import WithSectionMessages from '@/components/providers/WithSectionMessages'
import WithAllKeywordNames from '@/components/providers/WithAllKeywordNames'

export default async function MetaLayout({ children, params }: { children: ReactNode; params: Promise<{ lang: string }> }) {
  const { lang } = await params
  return <WithSectionMessages section="meta" lang={lang}><WithAllKeywordNames>{children}</WithAllKeywordNames></WithSectionMessages>
}

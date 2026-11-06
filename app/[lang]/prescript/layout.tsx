import type { ReactNode } from 'react'
import { notFound } from 'next/navigation'
import { prescriptModeOn } from '@/lib/fun/prescript-flag'
import WithSectionMessages from '@/components/providers/WithSectionMessages'
import PrescriptChrome from '@/features/tools/components/PrescriptChrome'

export default async function PrescriptLayout({ children, params }: { children: ReactNode; params: Promise<{ lang: string }> }) {
  // on hold: not served in production unless switched on (lib/fun/prescript-flag)
  if (!prescriptModeOn()) notFound()
  const { lang } = await params
  return <WithSectionMessages section="prescript" lang={lang}><PrescriptChrome>{children}</PrescriptChrome></WithSectionMessages>
}

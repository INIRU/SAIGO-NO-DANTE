import type { ReactNode } from 'react'
import WithSectionMessages from '@/components/providers/WithSectionMessages'
import PrescriptChrome from '@/components/fun/prescript/PrescriptChrome'

export default async function PrescriptLayout({ children, params }: { children: ReactNode; params: Promise<{ lang: string }> }) {
  const { lang } = await params
  return <WithSectionMessages section="prescript" lang={lang}><PrescriptChrome>{children}</PrescriptChrome></WithSectionMessages>
}

import type { ReactNode } from 'react'
import WithSectionMessages from '@/components/providers/WithSectionMessages'

export default async function RandomLayout({ children, params }: { children: ReactNode; params: Promise<{ lang: string }> }) {
  const { lang } = await params
  return <WithSectionMessages section="random" lang={lang}>{children}</WithSectionMessages>
}

import type { ReactNode } from 'react'
import WithSectionMessages from '@/components/providers/WithSectionMessages'

/** The motion pages and their loading screens share the page texts. */
export default async function MotionLayout({ children, params }: { children: ReactNode; params: Promise<{ lang: string }> }) {
  const { lang } = await params
  return <WithSectionMessages section="motion" lang={lang}>{children}</WithSectionMessages>
}

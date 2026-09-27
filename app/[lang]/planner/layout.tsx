import type { ReactNode } from 'react'
import WithSectionMessages from '@/components/providers/WithSectionMessages'
import PlannerFooterHide from './PlannerFooterHide'

export default async function PlannerLayout({ children, params }: { children: ReactNode; params: Promise<{ lang: string }> }) {
  const { lang } = await params
  return (
    <WithSectionMessages section="planner" lang={lang}>
      <PlannerFooterHide />
      {children}
    </WithSectionMessages>
  )
}

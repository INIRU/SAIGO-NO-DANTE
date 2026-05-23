import type { ReactNode } from 'react'
import PlannerFooterHide from './PlannerFooterHide'

export default function PlannerLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <PlannerFooterHide />
      {children}
    </>
  )
}

import type { ReactNode } from 'react'
import RequestTimeRoute from '@/components/layout/RequestTimeRoute'

// The notice comes from the URL (reason, message, start and end time); the route renders per request so it is in the HTML.
export default function MaintenanceLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <RequestTimeRoute />
    </>
  )
}

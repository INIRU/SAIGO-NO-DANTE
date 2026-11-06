'use client'
import dynamic from 'next/dynamic'

// The intro decides once, in the browser, whether it plays (this tab's session): the entrance draws there only, under the
// Index's black while it loads.
const Hub = dynamic(() => import('@/features/tools/components/PrescriptHub'), { ssr: false,
  loading: () => <div style={{ position: 'fixed', inset: 0, zIndex: 60, background: '#07080b' }} /> })

export default function HubWrapper() {
  return <Hub />
}

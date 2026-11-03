'use client'
import dynamic from 'next/dynamic'

// The page reads the screen in the browser only (WebGPU, screen share, PiP): no server render. While it loads, the Index's
// black covers the page, so the site's own chrome never shows first.
const Inner = dynamic(() => import('./PrescriptClient'), { ssr: false,
  loading: () => <div style={{ position: 'fixed', inset: 0, zIndex: 60, background: '#07080b' }} /> })

export default function PrescriptWrapper(props: React.ComponentProps<typeof Inner>) {
  return <Inner {...props} />
}

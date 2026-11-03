'use client'
import dynamic from 'next/dynamic'

// The page reads the screen in the browser only (WebGPU, screen share, PiP): no server render.
const Inner = dynamic(() => import('./PrescriptClient'), { ssr: false })

export default function PrescriptWrapper(props: React.ComponentProps<typeof Inner>) {
  return <Inner {...props} />
}

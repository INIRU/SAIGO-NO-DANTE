import type { ReactNode } from 'react'
import MotionScreenFlag from '@/components/motion/MotionScreenFlag'

/** The watching page and its loading screen are a full-screen viewer: no navigation or footer. */
export default function MotionWatchLayout({ children }: { children: ReactNode }) {
  return <><MotionScreenFlag />{children}</>
}

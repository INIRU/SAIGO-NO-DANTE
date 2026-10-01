'use client'

import type { ReactNode } from 'react'
import { LazyMotion, MotionConfig, domAnimation } from 'motion/react'

/**
 * Animation features for every `m.*` component below. `domAnimation` covers what the site animates (enter, exit, hover,
 * in-view) and leaves out drag and layout animation; `strict` throws if a full `motion.*` component slips back in.
 * A client component because the feature bundle is functions, which a server layout cannot pass down.
 */
export default function MotionProvider({ children }: { children: ReactNode }) {
  return (
    <MotionConfig reducedMotion="user">
      <LazyMotion features={domAnimation} strict>{children}</LazyMotion>
    </MotionConfig>
  )
}

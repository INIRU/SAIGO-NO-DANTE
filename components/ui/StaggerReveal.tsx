'use client'

import { motion, useReducedMotion } from 'motion/react'
import { Children } from 'react'
import type { HTMLMotionProps } from 'motion/react'
import { staggerContainer, staggerItem } from '@/lib/animations'

type MotionTag = 'div' | 'section' | 'article' | 'ul' | 'ol' | 'aside'

interface StaggerRevealProps extends Omit<HTMLMotionProps<'div'>, 'variants' | 'initial' | 'whileInView' | 'viewport'> {
  /** Delay between each child's animation start (seconds). Default 0.08. */
  staggerDelay?: number
  /** Initial delay before the first child starts (seconds). Default 0. */
  delayChildren?: number
  /** HTML element to render. Defaults to 'div'. */
  as?: MotionTag
}

/**
 * StaggerReveal — a container that staggers its direct children into view
 * when scrolled to. Each child must use the `staggerItem` variant (or any
 * variant with matching `initial` / `animate` keys).
 *
 * The container itself is invisible (no layout style) — it only orchestrates
 * the timing of child animations via Motion's stagger mechanism.
 *
 * Usage:
 *   import { staggerItem } from '@/lib/animations'
 *
 *   <StaggerReveal className="grid grid-cols-3 gap-4">
 *     {items.map(item => (
 *       <motion.div key={item.id} variants={staggerItem}>
 *         <Card item={item} />
 *       </motion.div>
 *     ))}
 *   </StaggerReveal>
 *
 * Export staggerItem so consumers can import from the same place.
 */
export { staggerItem }

export default function StaggerReveal({
  children,
  staggerDelay = 0.08,
  delayChildren = 0,
  as = 'div',
  className,
  style,
  ...rest
}: StaggerRevealProps) {
  const Tag = motion[as] as typeof motion.div
  const shouldReduceMotion = useReducedMotion()
  // Large catalogs should settle as promptly as a small row of cards.
  const interval = Math.min(staggerDelay, 0.24 / Math.max(1, Children.count(children) - 1))
  const containerVariant = staggerContainer(interval, Math.min(delayChildren, 0.2))

  return (
    <Tag
      className={className}
      style={style}
      variants={shouldReduceMotion ? undefined : containerVariant}
      initial={shouldReduceMotion ? false : 'initial'}
      whileInView={shouldReduceMotion ? undefined : 'animate'}
      viewport={shouldReduceMotion ? undefined : { once: true, margin: '-50px' }}
      {...rest}
    >
      {children}
    </Tag>
  )
}

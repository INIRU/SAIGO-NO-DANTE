'use client'

import { motion } from 'framer-motion'
import type { Variants, HTMLMotionProps } from 'framer-motion'
import { fadeInUp } from '@/lib/animations'

type MotionTag = 'div' | 'section' | 'article' | 'aside' | 'li' | 'span'

interface ScrollRevealProps extends Omit<HTMLMotionProps<'div'>, 'variants' | 'initial' | 'whileInView' | 'viewport'> {
  /** Animation variant to use. Defaults to fadeInUp. */
  variant?: Variants
  /** Extra delay in seconds before this element starts animating. */
  delay?: number
  /** HTML element to render. Defaults to 'div'. */
  as?: MotionTag
}

/**
 * ScrollReveal — wraps children in a motion element that animates into view
 * once as the user scrolls. Uses whileInView with `once: true` so the
 * animation fires exactly once and does not repeat on scroll-up.
 *
 * Usage:
 *   <ScrollReveal>
 *     <p>This fades in when scrolled into view</p>
 *   </ScrollReveal>
 *
 *   <ScrollReveal variant={scaleIn} delay={0.2} className="...">
 *     <Card />
 *   </ScrollReveal>
 */
export default function ScrollReveal({
  children,
  variant = fadeInUp,
  delay,
  as = 'div',
  className,
  style,
  ...rest
}: ScrollRevealProps) {
  const Tag = motion[as] as typeof motion.div

  // Merge a per-element delay into the animate transition without mutating
  // the shared variant object.
  const mergedVariant: Variants = delay
    ? {
        ...variant,
        animate: {
          ...(typeof variant.animate === 'object' ? variant.animate : {}),
          transition: {
            ...(typeof variant.animate === 'object' &&
            'transition' in variant.animate
              ? (variant.animate as { transition?: object }).transition
              : {}),
            delay,
          },
        },
      }
    : variant

  return (
    <Tag
      className={className}
      style={style}
      variants={mergedVariant}
      initial="initial"
      whileInView="animate"
      viewport={{ once: true, margin: '-50px' }}
      {...rest}
    >
      {children}
    </Tag>
  )
}

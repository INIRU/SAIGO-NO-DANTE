import type { Variants, Transition } from 'motion/react'

// ---------------------------------------------------------------------------
// Shared transition configs
// ---------------------------------------------------------------------------

/** Smooth ease-in-out — good for reveals and modals */
export const smoothTransition: Transition = {
  duration: 0.5,
  ease: [0.25, 0.1, 0.25, 1],
}

/** Snappy ease-out — good for interactive responses */
export const snappyTransition: Transition = {
  duration: 0.3,
  ease: [0.33, 1, 0.68, 1],
}

/** Gentle spring — subtle, non-bouncy for premium feel */
export const springTransition: Transition = {
  type: 'spring',
  stiffness: 100,
  damping: 20,
}

// ---------------------------------------------------------------------------
// Directional fade variants
// ---------------------------------------------------------------------------

export const fadeIn: Variants = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: smoothTransition },
  exit: { opacity: 0, transition: snappyTransition },
}

export const fadeInUp: Variants = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0, transition: smoothTransition },
  exit: { opacity: 0, y: 10, transition: snappyTransition },
}

export const fadeInDown: Variants = {
  initial: { opacity: 0, y: -20 },
  animate: { opacity: 1, y: 0, transition: smoothTransition },
  exit: { opacity: 0, y: -10, transition: snappyTransition },
}

export const fadeInLeft: Variants = {
  initial: { opacity: 0, x: -20 },
  animate: { opacity: 1, x: 0, transition: smoothTransition },
  exit: { opacity: 0, x: -10, transition: snappyTransition },
}

export const fadeInRight: Variants = {
  initial: { opacity: 0, x: 20 },
  animate: { opacity: 1, x: 0, transition: smoothTransition },
  exit: { opacity: 0, x: 10, transition: snappyTransition },
}

// ---------------------------------------------------------------------------
// Scale variant — subtle zoom-in for cards and modals
// ---------------------------------------------------------------------------

export const scaleIn: Variants = {
  initial: { opacity: 0, scale: 0.95 },
  animate: { opacity: 1, scale: 1, transition: smoothTransition },
  exit: { opacity: 0, scale: 0.97, transition: snappyTransition },
}

// ---------------------------------------------------------------------------
// Slide up — larger travel distance, for panels and drawers
// ---------------------------------------------------------------------------

export const slideUp: Variants = {
  initial: { opacity: 0, y: 40 },
  animate: { opacity: 1, y: 0, transition: smoothTransition },
  exit: { opacity: 0, y: 20, transition: snappyTransition },
}

// ---------------------------------------------------------------------------
// Page transition — minimal shift, keeps layout stable
// ---------------------------------------------------------------------------

export const pageTransition: Variants = {
  initial: { opacity: 0, y: 8 },
  animate: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: [0.25, 0.1, 0.25, 1] },
  },
  exit: {
    opacity: 0,
    y: -8,
    transition: { duration: 0.25, ease: [0.4, 0, 1, 1] },
  },
}

// ---------------------------------------------------------------------------
// Stagger container — orchestrates children with a time offset
// ---------------------------------------------------------------------------

/**
 * Returns a Variants object for a container that staggers its children.
 *
 * @param staggerChildren - Delay between each child animation (seconds). Default 0.08.
 * @param delayChildren   - Initial delay before the first child starts (seconds). Default 0.
 */
export const staggerContainer = (
  staggerChildren = 0.08,
  delayChildren = 0,
): Variants => ({
  initial: {},
  animate: {
    transition: { staggerChildren, delayChildren },
  },
  exit: {
    transition: { staggerChildren: staggerChildren * 0.5, staggerDirection: -1 },
  },
})

// ---------------------------------------------------------------------------
// Stagger item — child variant driven by staggerContainer
// ---------------------------------------------------------------------------

export const staggerItem: Variants = {
  initial: { opacity: 0, y: 16 },
  animate: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.45, ease: [0.25, 0.1, 0.25, 1] },
  },
  exit: {
    opacity: 0,
    y: 8,
    transition: { duration: 0.25, ease: [0.4, 0, 1, 1] },
  },
}

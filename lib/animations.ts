import type { Variants, Transition } from 'motion/react'

// ---------------------------------------------------------------------------
// Shared transition configs
// ---------------------------------------------------------------------------

/** Smooth ease-in-out — good for reveals and modals */
export const smoothTransition: Transition = {
  duration: 0.34,
  ease: [0.22, 1, 0.36, 1],
}

/** Snappy ease-out — good for interactive responses */
const snappyTransition: Transition = {
  duration: 0.22,
  ease: [0.33, 1, 0.68, 1],
}

// ---------------------------------------------------------------------------
// Fade variants
// ---------------------------------------------------------------------------

export const fadeInUp: Variants = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0, transition: smoothTransition },
  exit: { opacity: 0, y: 10, transition: snappyTransition },
}

// ---------------------------------------------------------------------------
// Modal transitions — shared app shell contract, transform/opacity only
// ---------------------------------------------------------------------------

export const modalOverlayVariants: Variants = {
  initial: { opacity: 0 },
  animate: {
    opacity: 1,
    transition: { duration: 0.18, ease: [0.22, 1, 0.36, 1] },
  },
  exit: {
    opacity: 0,
    transition: { duration: 0.1, ease: [0.4, 0, 1, 1] },
  },
}

export const modalPanelVariants: Variants = {
  initial: { opacity: 0, y: 10, scale: 0.965 },
  animate: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: 'spring', stiffness: 520, damping: 38, mass: 0.72 },
  },
  exit: {
    opacity: 0,
    y: 6,
    scale: 0.975,
    transition: { duration: 0.12, ease: [0.4, 0, 1, 1] },
  },
}

export const reducedModalPanelVariants: Variants = {
  initial: { opacity: 0 },
  animate: {
    opacity: 1,
    transition: { duration: 0.08, ease: [0.22, 1, 0.36, 1] },
  },
  exit: {
    opacity: 0,
    transition: { duration: 0.08, ease: [0.4, 0, 1, 1] },
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
  initial: { y: 16 },
  animate: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.32, ease: [0.22, 1, 0.36, 1] },
  },
  exit: {
    opacity: 0,
    y: 8,
    transition: { duration: 0.25, ease: [0.4, 0, 1, 1] },
  },
}

// ---------------------------------------------------------------------------
// Planner/workbench motion — restrained transform/opacity only
// ---------------------------------------------------------------------------

export const workbenchReveal: Variants = {
  initial: { y: 8 },
  animate: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.32, ease: [0.22, 1, 0.36, 1] },
  },
  exit: {
    opacity: 0,
    y: 8,
    transition: { duration: 0.18, ease: [0.4, 0, 1, 1] },
  },
}

export const workbenchStaggerItem: Variants = {
  initial: { y: 6 },
  animate: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.28, ease: [0.33, 1, 0.68, 1] },
  },
  exit: {
    opacity: 0,
    y: 6,
    transition: { duration: 0.16, ease: [0.4, 0, 1, 1] },
  },
}

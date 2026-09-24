'use client'

import { type ReactNode, useEffect, useRef } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import {
  modalOverlayVariants,
  modalPanelVariants,
  reducedModalPanelVariants,
} from '@/lib/animations'

interface BaseModalProps {
  open: boolean
  onClose: () => void
  children: ReactNode
  /** Accessible title for screen readers (required) */
  title: string
  /** Accessible description for screen readers (optional) */
  description?: string
  /** z-index (default: 50 → z-[50]) */
  zIndex?: number
  /** Max width of the content container (default: '40rem') */
  maxWidth?: string
  /** Additional className for the content container */
  className?: string
  /** Whether to apply backdrop blur (default: true) */
  blur?: boolean
  /** Padding around content (default: '1rem') */
  padding?: string
  /** Below 640px, dock the panel to the bottom edge like a sheet. */
  sheet?: boolean
}

export default function BaseModal({
  open,
  onClose,
  children,
  title,
  description,
  zIndex = 50,
  maxWidth = '40rem',
  className = '',
  blur = true,
  padding = '1rem',
  sheet = false,
}: BaseModalProps) {
  const scrollYRef = useRef(0)
  const reduceMotion = useReducedMotion()
  const panelVariants = reduceMotion ? reducedModalPanelVariants : modalPanelVariants

  useEffect(() => {
    if (open) {
      // Save scroll position before Radix locks the body
      scrollYRef.current = window.scrollY
    } else {
      // Restore scroll position after Radix unlocks the body
      // Use requestAnimationFrame to ensure Radix has already removed its styles
      const id = requestAnimationFrame(() => {
        window.scrollTo(0, scrollYRef.current)
      })
      return () => cancelAnimationFrame(id)
    }
  }, [open])

  return (
    <Dialog.Root open={open} onOpenChange={v => { if (!v) onClose() }}>
      <AnimatePresence initial={false}>
        {open && (
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild forceMount>
              <motion.div
                className="fixed inset-0"
                style={{
                  zIndex,
                  background: 'rgba(0,0,0,0.6)',
                  ...(blur ? { backdropFilter: 'blur(3px)', WebkitBackdropFilter: 'blur(3px)' } : {}),
                }}
                variants={modalOverlayVariants}
                initial="initial"
                animate="animate"
                exit="exit"
              />
            </Dialog.Overlay>
            <Dialog.Content
              asChild
              forceMount
              {...(!description ? { 'aria-describedby': undefined } : {})}
              onPointerDownOutside={() => onClose()}
              onEscapeKeyDown={() => onClose()}
            >
              <motion.div
                className={sheet ? 'fixed inset-0 flex items-end justify-center sm:items-center sm:p-4' : 'fixed inset-0 flex items-center justify-center'}
                style={{ zIndex: zIndex + 1, padding: sheet ? undefined : padding, pointerEvents: 'none' }}
                variants={panelVariants}
                initial="initial"
                animate="animate"
                exit="exit"
              >
                <Dialog.Title className="sr-only">{title}</Dialog.Title>
                {description && <Dialog.Description className="sr-only">{description}</Dialog.Description>}
                <div
                  className={`popup-surface relative w-full ${className}`}
                  style={{ maxWidth, pointerEvents: 'auto' }}
                >
                  {children}
                </div>
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  )
}

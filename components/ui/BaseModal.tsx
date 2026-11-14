'use client'

import { type ReactNode, useEffect, useRef } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { AnimatePresence, useReducedMotion } from 'motion/react'
import * as m from 'motion/react-m'
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
  /** Backdrop colour (default: a 60% black veil). */
  backdrop?: string
  /** 'dialog' focuses the dialog itself on open instead of its first control (notices, where a ring on the first button reads as a selection). */
  initialFocus?: 'first' | 'dialog'
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
  initialFocus = 'first',
  backdrop = 'rgba(0,0,0,0.6)',
}: BaseModalProps) {
  // null until the modal has been open, so a modal that mounts closed never touches the scroll position
  const scrollYRef = useRef<number | null>(null)
  const reduceMotion = useReducedMotion()
  const panelVariants = reduceMotion ? reducedModalPanelVariants : modalPanelVariants

  useEffect(() => {
    if (open) {
      // Save scroll position before Radix locks the body
      scrollYRef.current = window.scrollY
    } else if (scrollYRef.current !== null) {
      // Restore scroll position after Radix unlocks the body
      // Use requestAnimationFrame to ensure Radix has already removed its styles
      const top = scrollYRef.current
      scrollYRef.current = null
      const id = requestAnimationFrame(() => {
        window.scrollTo(0, top)
      })
      return () => cancelAnimationFrame(id)
    }
    return undefined
  }, [open])

  return (
    <Dialog.Root open={open} onOpenChange={v => { if (!v) onClose() }}>
      <AnimatePresence initial={false}>
        {open && (
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild forceMount>
              <m.div
                className="fixed inset-0"
                style={{
                  zIndex,
                  background: backdrop,
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
              onOpenAutoFocus={initialFocus === 'dialog' ? event => { event.preventDefault(); (event.currentTarget as HTMLElement | null)?.focus({ preventScroll: true }) } : undefined}
            >
              <m.div
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
              </m.div>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  )
}

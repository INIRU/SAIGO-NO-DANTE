'use client'

import { type ReactNode, useEffect, useRef } from 'react'
import * as Dialog from '@radix-ui/react-dialog'

interface BaseModalProps {
  open: boolean
  onClose: () => void
  children: ReactNode
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
}

export default function BaseModal({
  open,
  onClose,
  children,
  zIndex = 50,
  maxWidth = '40rem',
  className = '',
  blur = true,
  padding = '1rem',
}: BaseModalProps) {
  const scrollYRef = useRef(0)

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
      <Dialog.Portal>
        <Dialog.Overlay
          className="fixed inset-0"
          style={{
            zIndex,
            background: 'rgba(0,0,0,0.75)',
            ...(blur ? { backdropFilter: 'blur(0.5rem)', WebkitBackdropFilter: 'blur(0.5rem)' } : {}),
          }}
        />
        <Dialog.Content
          className="fixed inset-0 flex items-center justify-center"
          style={{ zIndex: zIndex + 1, padding, pointerEvents: 'none' }}
          onPointerDownOutside={() => onClose()}
          onEscapeKeyDown={() => onClose()}
        >
          <Dialog.Title className="sr-only">Modal</Dialog.Title>
          <Dialog.Description className="sr-only">Modal content</Dialog.Description>
          <div
            className={`relative w-full ${className}`}
            style={{ maxWidth, pointerEvents: 'auto' }}
          >
            {children}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

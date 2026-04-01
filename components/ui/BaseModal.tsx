'use client'

import { useEffect, useCallback, type ReactNode } from 'react'

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
  const handleEsc = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose()
  }, [onClose])

  useEffect(() => {
    if (!open) return
    document.addEventListener('keydown', handleEsc)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handleEsc)
      document.body.style.overflow = prev
    }
  }, [open, handleEsc])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 flex items-center justify-center"
      style={{ zIndex, padding }}
      onClick={onClose}
    >
      <div
        className="absolute inset-0"
        style={{
          background: 'rgba(0,0,0,0.75)',
          ...(blur ? { backdropFilter: 'blur(0.5rem)', WebkitBackdropFilter: 'blur(0.5rem)' } : {}),
        }}
      />
      <div
        className={`relative w-full ${className}`}
        style={{ maxWidth }}
        onClick={e => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  )
}

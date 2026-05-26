'use client'

import { useEffect, useRef } from 'react'
import { AlertTriangle } from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import {
  modalOverlayVariants,
  modalPanelVariants,
  reducedModalPanelVariants,
} from '@/lib/animations'

interface ConfirmModalProps {
  open: boolean
  title?: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: 'danger' | 'warning' | 'default'
  onConfirm: () => void
  onCancel: () => void
}

export default function ConfirmModal({
  open,
  title,
  message,
  confirmLabel = '확인',
  cancelLabel = '취소',
  variant = 'default',
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null)
  const firstButtonRef = useRef<HTMLButtonElement>(null)
  const reduceMotion = useReducedMotion()
  const panelVariants = reduceMotion ? reducedModalPanelVariants : modalPanelVariants

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, onCancel])

  // Focus first button when modal opens
  useEffect(() => {
    if (open) {
      setTimeout(() => firstButtonRef.current?.focus(), 50)
    }
  }, [open])

  const accentColor =
    variant === 'danger' ? '#aa4444' :
    variant === 'warning' ? '#c8900a' :
    '#c8a450'

  return (
    <AnimatePresence initial={false}>
      {open && (
        <motion.div
          ref={overlayRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={title ? 'confirm-title' : undefined}
          aria-label={title ? undefined : message}
          onClick={e => { if (e.target === overlayRef.current) onCancel() }}
          style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
          variants={modalOverlayVariants}
          initial="initial"
          animate="animate"
          exit="exit"
        >
          <motion.div
            style={{
              background: 'var(--bg-card)', border: '1px solid var(--border)',
              borderRadius: 'var(--radius-lg)', padding: '1.5rem', maxWidth: '25rem', width: '90%',
              boxShadow: 'var(--shadow-lg)',
            }}
            variants={panelVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            onClick={e => e.stopPropagation()}
          >
            {title && (
              <div className="flex items-center gap-2 mb-3">
                {variant === 'danger' && <AlertTriangle size={16} style={{ color: accentColor }} />}
                <h3 id="confirm-title" className="font-serif font-light" style={{ color: accentColor, fontSize: '0.9375rem' }}>
                  {title}
                </h3>
              </div>
            )}
            <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-sm)', lineHeight: 1.6, marginBottom: '1.25rem' }}>
              {message}
            </p>
            <div className="flex justify-end gap-2">
              <button
                ref={firstButtonRef}
                onClick={onCancel}
                style={{
                  padding: '0.4375rem 1rem', border: '1px solid var(--border)', borderRadius: '0.25rem',
                  color: 'var(--text-tertiary)', fontSize: 'var(--text-sm)', cursor: 'pointer',
                  background: 'transparent',
                }}
                className="transition-colors hover:bg-white/5"
              >
                {cancelLabel}
              </button>
              <button
                onClick={onConfirm}
                style={{
                  padding: '0.4375rem 1rem', borderRadius: 'var(--radius-sm)', fontSize: 'var(--text-sm)', cursor: 'pointer',
                  background: variant === 'danger' ? 'rgba(170,68,68,0.2)' : 'rgba(200,144,10,0.2)',
                  border: `1px solid ${variant === 'danger' ? '#aa4444' : 'var(--gold-dim)'}`,
                  color: variant === 'danger' ? '#ee6666' : 'var(--gold)',
                }}
                className="transition-colors hover:opacity-80"
              >
                {confirmLabel}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

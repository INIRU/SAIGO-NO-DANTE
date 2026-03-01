'use client'

import { useEffect, useRef } from 'react'
import { AlertTriangle } from 'lucide-react'

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

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, onCancel])

  if (!open) return null

  const accentColor =
    variant === 'danger' ? '#aa4444' :
    variant === 'warning' ? '#c8900a' :
    '#c8a450'

  return (
    <div
      ref={overlayRef}
      onClick={e => { if (e.target === overlayRef.current) onCancel() }}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      <div
        style={{
          background: '#1a1510', border: '1px solid var(--border)',
          borderRadius: '8px', padding: '24px', maxWidth: 400, width: '90%',
          boxShadow: '0 16px 48px rgba(0,0,0,0.5)',
        }}
      >
        {title && (
          <div className="flex items-center gap-2 mb-3">
            {variant === 'danger' && <AlertTriangle size={16} style={{ color: accentColor }} />}
            <h3 className="font-serif font-bold" style={{ color: accentColor, fontSize: '15px' }}>
              {title}
            </h3>
          </div>
        )}
        <p style={{ color: '#c8a450', fontSize: '13px', lineHeight: 1.6, marginBottom: '20px' }}>
          {message}
        </p>
        <div className="flex justify-end gap-2">
          <button
            onClick={onCancel}
            style={{
              padding: '7px 16px', border: '1px solid var(--border)', borderRadius: '4px',
              color: '#555566', fontSize: '13px', cursor: 'pointer',
              background: 'transparent',
            }}
            className="transition-colors hover:bg-white/5"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            style={{
              padding: '7px 16px', borderRadius: '4px', fontSize: '13px', cursor: 'pointer',
              background: variant === 'danger' ? 'rgba(170,68,68,0.2)' : 'rgba(200,144,10,0.2)',
              border: `1px solid ${variant === 'danger' ? '#aa4444' : 'var(--gold-dim)'}`,
              color: variant === 'danger' ? '#ee6666' : 'var(--gold)',
            }}
            className="transition-colors hover:opacity-80"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

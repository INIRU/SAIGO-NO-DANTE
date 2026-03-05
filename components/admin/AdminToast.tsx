'use client'

import { useState, useCallback, useRef } from 'react'
import { X } from 'lucide-react'

type ToastType = 'success' | 'error' | 'warning'

interface Toast {
  id: number
  message: string
  type: ToastType
}

const typeStyles: Record<ToastType, { bg: string; border: string; color: string }> = {
  success: { bg: 'rgba(68,170,102,0.12)', border: 'rgba(68,170,102,0.4)', color: '#44aa66' },
  error: { bg: 'rgba(238,102,102,0.12)', border: 'rgba(238,102,102,0.4)', color: '#ee6666' },
  warning: { bg: 'rgba(230,180,40,0.12)', border: 'rgba(230,180,40,0.4)', color: '#e6b428' },
}

export function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([])
  const idRef = useRef(0)

  const showToast = useCallback((message: string, type: ToastType = 'success') => {
    const id = ++idRef.current
    setToasts(prev => [...prev, { id, message, type }])
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
    }, 3000)
  }, [])

  const dismissToast = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  return { toasts, showToast, dismissToast }
}

interface AdminToastContainerProps {
  toasts: Toast[]
  onDismiss: (id: number) => void
}

export function AdminToastContainer({ toasts, onDismiss }: AdminToastContainerProps) {
  if (toasts.length === 0) return null

  return (
    <div style={{
      position: 'fixed',
      top: '16px',
      right: '16px',
      zIndex: 9999,
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
      maxWidth: '360px',
    }}>
      {toasts.map(toast => {
        const ts = typeStyles[toast.type]
        return (
          <div
            key={toast.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '10px 14px',
              background: ts.bg,
              border: `1px solid ${ts.border}`,
              borderRadius: '6px',
              color: ts.color,
              fontSize: '0.8125rem',
              boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
              animation: 'slideIn 0.2s ease-out',
            }}
          >
            <span style={{ flex: 1 }}>{toast.message}</span>
            <button
              onClick={() => onDismiss(toast.id)}
              style={{ background: 'none', border: 'none', color: ts.color, cursor: 'pointer', padding: 0, opacity: 0.6, flexShrink: 0 }}
            >
              <X size={14} />
            </button>
          </div>
        )
      })}
    </div>
  )
}

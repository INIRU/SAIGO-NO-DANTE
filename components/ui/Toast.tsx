'use client'

import { useState, useCallback, useEffect } from 'react'
import { CheckCircle2, XCircle } from 'lucide-react'

type ToastType = 'success' | 'error'

interface ToastData {
  message: string
  type: ToastType
  id: number
}

const DURATION = 3000

export function useToast() {
  const [toast, setToast] = useState<ToastData | null>(null)

  const showToast = useCallback((message: string, type: ToastType = 'error') => {
    const id = Date.now()
    setToast({ message, type, id })
    setTimeout(() => setToast(prev => prev?.id === id ? null : prev), DURATION)
  }, [])

  return { toast, showToast }
}

export function Toast({ toast }: { toast: ToastData | null }) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (toast) {
      // 약간의 딜레이 후 표시 (mount 후 애니메이션 트리거)
      requestAnimationFrame(() => setVisible(true))
      const timer = setTimeout(() => setVisible(false), DURATION - 300)
      return () => clearTimeout(timer)
    }
    setVisible(false)
  }, [toast?.id])

  if (!toast) return null

  const isError = toast.type === 'error'

  return (
    <div
      className="fixed top-20 right-4 z-50 sm:right-6"
      style={{
        transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0) scale(1)' : 'translateY(-12px) scale(0.95)',
        pointerEvents: visible ? 'auto' : 'none',
      }}
    >
      <div
        className="relative rounded-lg text-sm backdrop-blur-sm overflow-hidden"
        style={{
          background: isError
            ? 'linear-gradient(135deg, rgba(80,16,16,0.95), rgba(60,12,12,0.95))'
            : 'linear-gradient(135deg, rgba(20,48,20,0.95), rgba(12,36,12,0.95))',
          color: isError ? '#ffa0a0' : '#a0f0a0',
          border: `1px solid ${isError ? 'rgba(200,60,60,0.35)' : 'rgba(80,180,80,0.35)'}`,
          fontFamily: 'var(--font-body)',
          maxWidth: '320px',
          minWidth: '200px',
          boxShadow: isError
            ? '0 8px 32px rgba(120,20,20,0.4), inset 0 1px 0 rgba(255,120,120,0.08)'
            : '0 8px 32px rgba(20,80,20,0.4), inset 0 1px 0 rgba(120,255,120,0.08)',
        }}
      >
        <div className="flex items-center gap-2.5 px-4 py-3">
          {isError
            ? <XCircle size={18} style={{ color: '#ff6060', flexShrink: 0 }} />
            : <CheckCircle2 size={18} style={{ color: '#60d060', flexShrink: 0 }} />
          }
          <span style={{ lineHeight: 1.4 }}>{toast.message}</span>
        </div>

        {/* 진행바 — overflow:hidden이 적용된 rounded-lg 내부 */}
        <div
          className="absolute bottom-0 left-0 h-[2px]"
          style={{
            background: isError
              ? 'linear-gradient(90deg, #ff6060, #ff4040)'
              : 'linear-gradient(90deg, #60d060, #40c040)',
            width: visible ? '0%' : '100%',
            transition: visible ? `width ${DURATION - 300}ms linear` : 'none',
            opacity: 0.6,
          }}
        />
      </div>
    </div>
  )
}

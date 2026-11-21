'use client'

import { Loader2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import BaseModal from './BaseModal'

interface ConfirmModalProps {
  open: boolean
  title?: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: 'danger' | 'warning' | 'default'
  /** The confirmed action is running: both buttons lock and the dialog cannot be dismissed. */
  loading?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export default function ConfirmModal({open,title,message,confirmLabel,cancelLabel,variant='default',loading=false,onConfirm,onCancel}:ConfirmModalProps) {
  const t = useTranslations('common')
  return (
    <BaseModal open={open} onClose={() => { if (!loading) onCancel() }} title={title ?? message} description={message} maxWidth="28rem" zIndex={9999}>
      <section className="popup-confirm">
        {title && <h2>{title}</h2>}
        <p>{message}</p>
        <div className="popup-actions">
          <button type="button" disabled={loading} onClick={onCancel}>{cancelLabel ?? t('cancel')}</button>
          <button type="button" className={variant === 'danger' ? 'popup-danger' : 'popup-primary'} disabled={loading} aria-busy={loading || undefined} onClick={onConfirm}>{loading && <Loader2 size={16} className="animate-spin motion-reduce:animate-none" aria-hidden="true" />}{confirmLabel ?? t('confirm')}</button>
        </div>
      </section>
    </BaseModal>
  )
}

'use client'

import BaseModal from './BaseModal'

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

export default function ConfirmModal({open,title,message,confirmLabel='확인',cancelLabel='취소',variant='default',onConfirm,onCancel}:ConfirmModalProps) {
  return (
    <BaseModal open={open} onClose={onCancel} title={title ?? message} description={message} maxWidth="28rem" zIndex={9999}>
      <section className="popup-confirm">
        {title && <h2>{title}</h2>}
        <p>{message}</p>
        <div className="popup-actions">
          <button type="button" onClick={onCancel}>{cancelLabel}</button>
          <button type="button" className={variant === 'danger' ? 'popup-danger' : 'popup-primary'} onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </section>
    </BaseModal>
  )
}

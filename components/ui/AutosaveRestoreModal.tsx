'use client'

import { useLocale, useTranslations } from 'next-intl'
import ConfirmModal from '@/components/ui/ConfirmModal'
import { showError, showSuccess } from '@/lib/toast'

/** Offers the automatically saved draft of an editor back: restore it or throw it away. */
export default function AutosaveRestoreModal({ savedAt, onRestore, onDiscard }: { savedAt: number | null; onRestore: () => boolean | void; onDiscard: () => void }) {
  const t = useTranslations('common.autosave')
  const locale = useLocale()
  const time = savedAt === null ? '' : new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(savedAt))
  return (
    <ConfirmModal open={savedAt !== null} title={t('title')} message={time} confirmLabel={t('restore')} cancelLabel={t('discard')}
      onConfirm={() => { if (onRestore() === false) showError(t('restoreFailed')); else showSuccess(t('restored')) }} onCancel={onDiscard} />
  )
}

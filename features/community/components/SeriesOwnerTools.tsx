'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { useTranslations } from 'next-intl'
import { ArrowDown, ArrowUp, Layers, Map as MapIcon, Pencil, Trash2 } from 'lucide-react'
import { useRouter } from '@/lib/i18n/navigation'
import BaseModal from '@/components/ui/BaseModal'
import ConfirmModal from '@/components/ui/ConfirmModal'
import { moveSeriesItem, orderSeriesItems, SERIES_TITLE_MAX, type SeriesItem } from '@/features/community/lib/series-order'
import { showError, showSuccess } from '@/lib/toast'

const fetchOwner = (url: string) => fetch(url).then(res => (res.ok ? res.json() : { isOwner: false })) as Promise<{ isOwner: boolean }>

const button = 'inline-flex min-h-[2.5rem] items-center gap-2 rounded-md border px-3 text-[0.9375rem] font-semibold transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-50'
const quiet = `${button} border-[var(--border)] bg-[#15100b] text-[#b9a47f] hover:border-[var(--gold-dim)] hover:text-[var(--gold-light)]`
const danger = `${button} border-red-500/35 bg-[#15100b] text-red-300 hover:border-red-400 hover:text-red-200`
const primary = `${button} border-[var(--gold)] bg-[var(--gold)] text-[var(--bg-deep)] hover:bg-[var(--gold-light)]`

/** The owner's tools of a series page: rename, reorder, delete. Anyone else sees nothing (the page itself is public and cached). */
export default function SeriesOwnerTools({ id, title, items }: { id: string; title: string; items: SeriesItem[] }) {
  const t = useTranslations('series')
  const tCommon = useTranslations('common')
  const router = useRouter()
  const { data } = useSWR(`/api/series/${id}`, fetchOwner, { revalidateOnFocus: false })
  const [open, setOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [name, setName] = useState(title)
  const [order, setOrder] = useState(() => orderSeriesItems(items))
  const [saving, setSaving] = useState(false)
  if (!data?.isOwner) return null

  const openEditor = () => { setName(title); setOrder(orderSeriesItems(items)); setOpen(true) }

  const save = async () => {
    if (!name.trim() || saving) return
    setSaving(true)
    try {
      const res = await fetch(`/api/series/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: name.trim(), order: order.map(item => ({ kind: item.kind, id: item.id })) }),
      })
      if (!res.ok) throw new Error()
      showSuccess(t('owner.saved'))
      setOpen(false)
      router.refresh()
    } catch { showError(t('owner.saveFailed')) }
    finally { setSaving(false) }
  }

  const remove = async () => {
    try {
      const res = await fetch(`/api/series/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      showSuccess(t('owner.deleted'))
      router.push('/decks')
    } catch { showError(t('owner.deleteFailed')); setConfirmDelete(false) }
  }

  return (
    <>
      <div className="flex flex-wrap gap-2">
        <button type="button" className={quiet} onClick={openEditor}><Pencil size={16} aria-hidden="true" />{t('owner.reorder')}</button>
        <button type="button" className={danger} onClick={() => setConfirmDelete(true)}><Trash2 size={16} aria-hidden="true" />{t('owner.delete')}</button>
      </div>

      <BaseModal open={open} onClose={() => setOpen(false)} title={t('owner.reorder')} maxWidth="34rem" sheet>
        <section className="grid gap-3 rounded-lg border border-[var(--border)] bg-[var(--bg-panel)] p-4">
          <h2 className="font-[family-name:var(--font-heading)] text-[1.125rem] text-[var(--text-primary)]">{t('owner.reorder')}</h2>
          <input
            value={name}
            maxLength={SERIES_TITLE_MAX}
            aria-label={t('owner.rename')}
            placeholder={t('picker.titlePlaceholder')}
            onChange={event => setName(event.target.value)}
            className="min-h-[2.5rem] w-full rounded-md border border-[var(--border)] bg-[var(--bg-deep)] px-3 text-[0.9375rem] text-[var(--text-primary)] outline-none focus:border-[var(--gold)]"
          />
          <ol className="grid max-h-[50dvh] gap-1 overflow-y-auto">
            {order.map((item, index) => {
              const Icon = item.kind === 'deck' ? Layers : MapIcon
              return (
                <li key={`${item.kind}:${item.id}`} className="flex items-center gap-2 rounded-md bg-[var(--bg-card)] px-2 py-1.5">
                  <span className="w-6 shrink-0 text-right font-[family-name:var(--font-title)] text-[1rem] text-[#9c8b73]">{index + 1}</span>
                  <Icon size={16} className="shrink-0 text-[#9c8b73]" aria-hidden="true" />
                  <span className="min-w-0 flex-1 truncate text-[0.875rem] text-[var(--text-primary)]">{item.title}</span>
                  <button type="button" aria-label={t('owner.moveUp')} disabled={index === 0} onClick={() => setOrder(moveSeriesItem(order, index, -1))} className="grid h-10 w-10 place-items-center rounded text-[#b9a47f] transition-colors hover:text-[var(--gold-light)] disabled:opacity-30"><ArrowUp size={16} aria-hidden="true" /></button>
                  <button type="button" aria-label={t('owner.moveDown')} disabled={index === order.length - 1} onClick={() => setOrder(moveSeriesItem(order, index, 1))} className="grid h-10 w-10 place-items-center rounded text-[#b9a47f] transition-colors hover:text-[var(--gold-light)] disabled:opacity-30"><ArrowDown size={16} aria-hidden="true" /></button>
                </li>
              )
            })}
          </ol>
          <div className="flex justify-end gap-2">
            <button type="button" className={quiet} onClick={() => setOpen(false)}>{tCommon('cancel')}</button>
            <button type="button" className={primary} onClick={save} disabled={saving || !name.trim()}>{tCommon('save')}</button>
          </div>
        </section>
      </BaseModal>

      <ConfirmModal
        open={confirmDelete}
        title={t('owner.delete')}
        message={t('owner.deleteMessage')}
        confirmLabel={tCommon('delete')}
        cancelLabel={tCommon('cancel')}
        variant="danger"
        onConfirm={remove}
        onCancel={() => setConfirmDelete(false)}
      />
    </>
  )
}

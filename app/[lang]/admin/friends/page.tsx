'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import useSWR from 'swr'
import Button from '@/components/ui/Button'
import ConfirmModal from '@/components/ui/ConfirmModal'
import SupportStrips from '@/features/friends/components/SupportStrips'
import { useFriendCatalog } from '@/features/friends/hooks/useFriendBoard'
import { WANT_LIMIT, type StoredSlot } from '@/features/friends'
import { showError, showSuccess } from '@/lib/toast'

type Item = {
  id: string; kind: 'support' | 'want'; code: string; visibility: string; slots: StoredSlot[]; identityIds: string[]
  author: string | null; guestTag: string | null; reports: number; reportedAt: string
}
type Action = 'remove' | 'block' | 'dismiss'

/** Reported friend code posts: an admin takes a post down, also bars its author from the board, or drops the reports. */
export default function AdminFriendsPage() {
  const t = useTranslations('friends'), catalog = useFriendCatalog()
  const list = useSWR('/api/admin/friend-codes', async url => {
    const response = await fetch(url)
    if (!response.ok) throw Error('list')
    return (await response.json()).items as Item[]
  })
  const [asking, setAsking] = useState<{ id: string; action: Action } | null>(null)
  const act = async () => {
    const target = asking
    setAsking(null)
    if (!target) return
    const response = await fetch(`/api/admin/friend-codes/${target.id}?action=${target.action}`, { method: 'DELETE' })
    if (response.ok) showSuccess(t('admin.done'))
    else showError((await response.json().catch(() => ({}))).error || t('errors.failed'))
    await list.mutate()
  }
  const label: Record<Action, string> = { remove: t('admin.remove'), block: t('admin.removeAndBlock'), dismiss: t('admin.dismiss') }
  const items = list.data ?? []
  return <div className="admin-page">
    <header className="admin-topbar"><div><h1>{t('admin.title')}</h1></div></header>
    <div className="admin-body">
      {list.error
        ? <div className="admin-state" role="alert"><p>{t('loadFailed')}</p><Button variant="secondary" onClick={() => void list.mutate()}>{t('retry')}</Button></div>
        : list.data && !items.length
          ? <div className="admin-state"><p>{t('admin.empty')}</p></div>
          : <ul className="admin-list">
            {items.map(item => <li key={item.id} style={{ padding: '1rem 0' }}>
              <div className="admin-list-meta" style={{ marginBottom: '0.6rem' }}>
                <span className="admin-chip" data-tone="danger">{t('admin.reports', { count: item.reports })}</span>
                <strong>{item.author ?? t('guest', { tag: item.guestTag ?? '' })}</strong>
                <code>{item.code}</code>
                <span>{t(`tabs.${item.kind}`)}</span>
                <span>{t(`visibility.${item.visibility}`)}</span>
              </div>
              <div style={{ maxWidth: item.kind === 'support' ? '46rem' : undefined }}>
                <SupportStrips slots={item.kind === 'support' ? catalog.supportSlots(item.slots) : catalog.wantSlots(item.identityIds)} count={item.kind === 'support' ? 12 : WANT_LIMIT} />
              </div>
              <div className="admin-topbar-actions" style={{ marginTop: '0.8rem' }}>
                {(['dismiss', 'remove', 'block'] as const).map(action => <Button key={action} variant={action === 'block' ? 'primary' : 'secondary'} onClick={() => setAsking({ id: item.id, action })}>{label[action]}</Button>)}
              </div>
            </li>)}
          </ul>}
    </div>
    <ConfirmModal open={asking !== null} message={asking ? label[asking.action] : ''} variant={asking?.action === 'dismiss' ? 'default' : 'danger'} onCancel={() => setAsking(null)} onConfirm={() => void act()} />
  </div>
}

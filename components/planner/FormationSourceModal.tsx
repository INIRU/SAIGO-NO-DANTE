'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { useLocale, useTranslations } from 'next-intl'
import { useSession } from 'next-auth/react'
import { X } from 'lucide-react'
import BaseModal from '@/components/ui/BaseModal'
import { showError } from '@/lib/toast'

type Row = { id: string; title: string; created_at: string }

async function getJson(url: string) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(String(res.status))
  return res.json()
}

/**
 * Picks one of my decks (for a plan) or one of my plans (for a deck) and hands back its full record. Lists come from the
 * same endpoints as the mypage (/api/profile, /api/planner?userId=me); the chosen record from its detail endpoint.
 */
export default function FormationSourceModal({ kind, open, onClose, onLoaded }: {
  kind: 'deck' | 'plan'
  open: boolean
  onClose: () => void
  onLoaded: (record: Record<string, unknown>) => void
}) {
  const t = useTranslations('planner.formationImport')
  const locale = useLocale()
  const { status } = useSession()
  const listUrl = kind === 'deck' ? '/api/profile' : '/api/planner?userId=me&limit=50'
  const list = useSWR<{ decks?: Row[]; plans?: Row[] }>(open && status === 'authenticated' ? listUrl : null, getJson, { revalidateOnFocus: false })
  const rows = (kind === 'deck' ? list.data?.decks : list.data?.plans) ?? []
  const [busyId, setBusyId] = useState<string | null>(null)
  const title = t(kind === 'deck' ? 'decksTitle' : 'plansTitle')
  const format = new Intl.DateTimeFormat(locale, { year: 'numeric', month: 'short', day: 'numeric' })

  const pick = async (row: Row) => {
    if (busyId) return
    setBusyId(row.id)
    try {
      onLoaded(await getJson(kind === 'deck' ? `/api/decks/${row.id}` : `/api/planner/${row.id}`))
    } catch { showError(t('loadFailed')) }
    finally { setBusyId(null) }
  }

  const note = status === 'unauthenticated' ? t('loginRequired') : list.error ? t('loadFailed') : list.data && rows.length === 0 ? t('empty') : null
  return (
    <BaseModal open={open} onClose={onClose} title={title} maxWidth="32rem">
      <div className="flex h-[min(70dvh,34rem)] flex-col rounded-xl border border-[rgba(200,144,10,0.22)] bg-[#17120c] shadow-[0_1.5rem_3rem_rgba(0,0,0,0.55)]">
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-[#2e2417] px-5 py-3">
          <h2 className="font-[family-name:var(--font-heading)] text-[1.125rem] text-[var(--text-primary)]">{title}</h2>
          <button type="button" onClick={onClose} aria-label={t('close')}
            className="grid h-10 w-10 place-items-center rounded text-[#9c8b73] transition-colors hover:bg-white/5 hover:text-[var(--text-primary)]">
            <X size={18} />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-1.5">
          {note ? <p className="py-10 text-center text-[0.9375rem] text-[#9c8b73]">{note}</p> : (
            <ul className="divide-y divide-[#241c14]">
              {rows.map(row => (
                <li key={row.id}>
                  <button type="button" onClick={() => pick(row)} disabled={busyId !== null}
                    className="flex min-h-12 w-full items-center justify-between gap-3 rounded px-3 py-2 text-left transition-colors hover:bg-[rgba(200,144,10,0.1)] focus-visible:outline-2 focus-visible:outline-[var(--gold-light)] disabled:opacity-60">
                    <span className="min-w-0 truncate text-[0.9375rem] font-semibold text-[var(--text-primary)]">{row.title.trim() || t('untitled')}</span>
                    <span className="shrink-0 text-[0.8125rem] tabular-nums text-[#9c8b73]">{format.format(new Date(row.created_at))}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </BaseModal>
  )
}

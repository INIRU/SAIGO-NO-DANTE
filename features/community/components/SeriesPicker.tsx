'use client'

import { useEffect, useState } from 'react'
import useSWR from 'swr'
import { useSession } from 'next-auth/react'
import { useTranslations } from 'next-intl'
import { Check, Layers } from 'lucide-react'
import BaseModal from '@/components/ui/BaseModal'
import Button from '@/components/ui/Button'
import { SERIES_TITLE_MAX, type SeriesPostKind, type SeriesSummary } from '@/features/community/lib/series-order'
import { showError } from '@/lib/toast'

type Listing = { series: SeriesSummary[]; current: string | null }

/**
 * Picks the series a deck or plan joins, for the editors. `onChange` is called only when the author chooses:
 * a series id, or null to leave it. The post joins at the end of the series when it is saved.
 * Signed-out authors have no series, so nothing is shown.
 */
export default function SeriesPicker({ kind, postId, onChange }: { kind: SeriesPostKind; postId?: string; onChange: (seriesId: string | null) => void }) {
  const t = useTranslations('series')
  const { status } = useSession()
  const query = postId ? `?kind=${kind}&post=${postId}` : ''
  const { data, error, mutate } = useSWR<Listing>(status === 'authenticated' ? `/api/series${query}` : null, { revalidateOnFocus: false })
  const [open, setOpen] = useState(false)
  const [choice, setChoice] = useState<string | null | undefined>(undefined)
  const [name, setName] = useState('')
  const [creating, setCreating] = useState(false)

  useEffect(() => { if (error) showError(t('picker.loadFailed')) }, [error, t])
  if (status !== 'authenticated') return null

  const selected = choice === undefined ? data?.current ?? null : choice
  const current = data?.series.find(item => item.id === selected)

  const choose = (id: string | null) => { setChoice(id); onChange(id); setOpen(false) }

  const create = async () => {
    const title = name.trim()
    if (!title || creating) return
    setCreating(true)
    try {
      const res = await fetch('/api/series', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title }) })
      if (!res.ok) throw new Error()
      const { series } = await res.json() as { series: SeriesSummary }
      await mutate(listing => listing && { ...listing, series: [series, ...listing.series] }, { revalidate: false })
      setName('')
      choose(series.id)
    } catch { showError(t('picker.createFailed')) }
    finally { setCreating(false) }
  }

  const row = 'flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left text-[0.9375rem] transition-colors hover:bg-[#ffffff08]'

  return (
    <>
      <Button size="sm" icon={Layers} variant={current ? 'outline' : 'secondary'} onClick={() => setOpen(true)} disabled={!data}>
        {current?.title ?? t('picker.label')}
      </Button>
      <BaseModal open={open} onClose={() => setOpen(false)} title={t('picker.choose')} maxWidth="30rem" sheet>
        <section className="grid gap-3 rounded-lg border border-[var(--border)] bg-[var(--bg-panel)] p-4">
          <h2 className="font-[family-name:var(--font-heading)] text-[1.125rem] text-[var(--text-primary)]">{t('picker.choose')}</h2>
          <ul className="grid max-h-[45dvh] gap-0.5 overflow-y-auto">
            <li>
              <button type="button" className={`${row} ${selected === null ? 'text-[var(--gold-light)]' : 'text-[#b9a47f]'}`} aria-pressed={selected === null} onClick={() => choose(null)}>
                <span className="min-w-0 flex-1 truncate">{t('none')}</span>
                {selected === null && <Check size={16} aria-hidden="true" />}
              </button>
            </li>
            {data?.series.map(item => (
              <li key={item.id}>
                <button type="button" className={`${row} ${selected === item.id ? 'text-[var(--gold-light)]' : 'text-[var(--text-primary)]'}`} aria-pressed={selected === item.id} onClick={() => choose(item.id)}>
                  <span className="min-w-0 flex-1 truncate">{item.title}</span>
                  <span className="shrink-0 font-[family-name:var(--font-title)] text-[1.0625rem] text-[#9c8b73]">{item.count}</span>
                  {selected === item.id && <Check size={16} aria-hidden="true" />}
                </button>
              </li>
            ))}
          </ul>
          <form className="flex gap-2 border-t border-[#2e2417] pt-3" onSubmit={event => { event.preventDefault(); void create() }}>
            <input
              value={name}
              maxLength={SERIES_TITLE_MAX}
              placeholder={t('picker.titlePlaceholder')}
              aria-label={t('picker.create')}
              onChange={event => setName(event.target.value)}
              className="min-h-[2.5rem] min-w-0 flex-1 rounded-md border border-[var(--border)] bg-[var(--bg-deep)] px-3 text-[0.9375rem] text-[var(--text-primary)] outline-none focus:border-[var(--gold)]"
            />
            <button type="submit" disabled={!name.trim() || creating} className="min-h-[2.5rem] rounded-md border border-[var(--gold)] bg-[var(--gold)] px-4 text-[0.9375rem] font-semibold text-[var(--bg-deep)] transition-colors hover:bg-[var(--gold-light)] disabled:cursor-not-allowed disabled:opacity-50">{t('picker.add')}</button>
          </form>
        </section>
      </BaseModal>
    </>
  )
}

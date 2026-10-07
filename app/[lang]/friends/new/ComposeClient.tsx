'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import useSWR, { useSWRConfig } from 'swr'
import { ArrowLeft, Trash2 } from 'lucide-react'
import SupportStrips from '@/components/friends/SupportStrips'
import SupportSlotPicker from '@/components/friends/SupportSlotPicker'
import { emptySlots, readOwnCode, rememberOwnCode, supportBody, useFriendApi, useFriendCatalog, wantBody, type Kind, type Slots } from '@/components/friends/board'
import BackLink from '@/components/navigation/BackLink'
import PageHeader from '@/components/ui/PageHeader'
import { useRouter } from '@/lib/i18n/navigation'
import { FRIEND_CODE_RE, VISIBILITIES, WANT_LIMIT, type Visibility } from '@/lib/friends/codes'
import { showError, showSuccess } from '@/lib/toast'
import styles from '../Friends.module.css'

/** Writes or edits the viewer's post of one kind: their friend code, who may see it, and the identities. */
export default function ComposeClient({ kind }: { kind: Kind }) {
  const t = useTranslations('friends'), api = useFriendApi(), catalog = useFriendCatalog(), router = useRouter()
  const [slots, setSlots] = useState<Slots>(() => emptySlots(kind))
  const [picking, setPicking] = useState<number | null>(null)
  const [code, setCode] = useState('')
  const [visibility, setVisibility] = useState<Visibility>('public')
  const [busy, setBusy] = useState(false)
  const [filled, setFilled] = useState(false)
  const { mutate } = useSWRConfig()
  const own = useSWR([`/api/friend-codes?kind=${kind}`, api.signedIn], ([url]) => api.load(url), { revalidateOnFocus: false })
  const mine = own.data?.own ?? null

  // The saved post goes into the editor once, so saving again edits it; without one the code last used here is offered.
  useEffect(() => {
    if (filled || !own.data || !catalog.ready) return
    if (mine) { setSlots(kind === 'support' ? catalog.supportSlots(mine.slots) : catalog.wantSlots(mine.identityIds)); setVisibility(mine.visibility) }
    setCode(mine?.code ?? readOwnCode()); setFilled(true)
  }, [filled, own.data, mine, catalog, kind])

  const codeOk = FRIEND_CODE_RE.test(code), chosen = slots.filter(Boolean).length
  const draft = kind === 'support' ? { kind, code, visibility, slots: supportBody(slots) } : { kind, code, visibility, identities: wantBody(slots) }
  // The saved post in the same shape: when it equals the draft there is nothing to save.
  const saved = !mine ? null : kind === 'support'
    ? { kind, code: mine.code, visibility: mine.visibility, slots: supportBody(catalog.supportSlots(mine.slots)) }
    : { kind, code: mine.code, visibility: mine.visibility, identities: mine.identityIds }
  const changed = JSON.stringify(draft) !== JSON.stringify(saved)
  const back = kind === 'want' ? '/friends?tab=want' : '/friends'
  const run = async (work: () => Promise<void>) => {
    setBusy(true)
    // Every cached list of the board is stale after a save or a delete: the list page must not show the old one.
    try { await work(); await mutate(key => Array.isArray(key) && String(key[0]).startsWith('/api/friend-codes'), undefined, { revalidate: false }); router.push(back) } catch (error) { showError(error instanceof Error ? error.message : t('errors.failed')); setBusy(false) }
  }
  const save = () => run(async () => { await api.send('/api/friend-codes', 'POST', draft); rememberOwnCode(code); showSuccess(t(mine ? 'updated' : 'posted')) })
  const remove = () => run(async () => { await api.send(`/api/friend-codes?kind=${kind}`, 'DELETE'); showSuccess(t('deleted')) })

  return <main className={styles.page}>
    <BackLink href={back} className={styles.back}><ArrowLeft size={16} aria-hidden="true" />{t('back')}</BackLink>
    <PageHeader title={t(`compose.${kind}`)} actions={<div className={styles.actions}>
      {mine && <button type="button" className={`${styles.icon} ${styles.boxed}`} disabled={busy} onClick={remove} aria-label={t('delete')} title={t('delete')}><Trash2 size={18} aria-hidden="true" /></button>}
      <button type="button" className={styles.primary} disabled={busy || !codeOk || !chosen || !changed} onClick={save}>{t(mine ? 'edit' : 'post')}</button>
    </div>} />
    <section className={styles.editor}>
      <div className={styles.fields}>
        <label>{t('myCode')}
          <input className={styles.code} value={code} onChange={event => setCode(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10))} placeholder="A000000000" autoComplete="off" />
        </label>
        <div>{t('visibility.label')}
          <div className={styles.segments}>
            {VISIBILITIES.map(value => <button type="button" key={value} aria-pressed={visibility === value} onClick={() => setVisibility(value)}>{t(`visibility.${value}`)}</button>)}
          </div>
        </div>
      </div>
      <SupportStrips slots={slots} count={kind === 'support' ? 12 : WANT_LIMIT} onPick={setPicking} />
      <p className={styles.warning}>{t('warning')}</p>
    </section>
    {picking !== null && <SupportSlotPicker key={picking} index={picking} value={slots[picking]} onClose={() => setPicking(null)}
      title={t(kind === 'support' ? 'picker.support' : 'picker.want')} identityOnly={kind === 'want'}
      onChange={slot => setSlots(current => current.map((item, at) => at === picking ? slot : item))} />}
  </main>
}

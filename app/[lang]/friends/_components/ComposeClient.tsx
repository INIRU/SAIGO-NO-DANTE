'use client'

import { useEffect, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { useSession } from 'next-auth/react'
import useSWR, { useSWRConfig } from 'swr'
import { ArrowLeft, Trash2 } from 'lucide-react'
import SupportStrips from '@/features/friends/components/SupportStrips'
import SupportSlotPicker from '@/features/friends/components/SupportSlotPicker'
import { emptySlots, readOwnCode, rememberOwnCode, supportBody, useFriendApi, useFriendCatalog, wantBody, type Kind, type Slots } from '@/features/friends/hooks/useFriendBoard'
import { FRIEND_CODE_RE, VISIBILITIES, WANT_LIMIT, type Visibility } from '@/features/friends'
import BackLink from '@/components/navigation/BackLink'
import PageHeader from '@/components/ui/PageHeader'
import GuestPinInput from '@/features/account/components/GuestPinInput'
import { recoverGuestPost } from '@/features/account/hooks/useGuestPosts'
import { useHtmlFlag } from '@/hooks/useHtmlFlag'
import { getGuestCopy, guestPinProblem, guestRecoverMessage, isGuestPin } from '@/features/account'
import { useRouter } from '@/lib/i18n/navigation'
import { showError, showSuccess } from '@/lib/toast'
import styles from './Friends.module.css'

/** Writes or edits the viewer's post of one kind: their friend code, who may see it, and the identities. */
export default function ComposeClient({ kind }: { kind: Kind }) {
  // An editor screen: no site navigation or footer, the whole line-up inside the viewport (DESIGN.md 7).
  useHtmlFlag('with-friend-compose')
  const t = useTranslations('friends'), api = useFriendApi(), catalog = useFriendCatalog(), router = useRouter()
  const [slots, setSlots] = useState<Slots>(() => emptySlots(kind))
  const [picking, setPicking] = useState<number | null>(null)
  const [code, setCode] = useState('')
  const [visibility, setVisibility] = useState<Visibility>('public')
  const [busy, setBusy] = useState(false)
  const [filled, setFilled] = useState(false)
  const [pin, setPin] = useState('')
  const locale = useLocale(), guestT = getGuestCopy(locale), guest = useSession().status === 'unauthenticated'
  const { mutate } = useSWRConfig()
  const own = useSWR([`/api/friend-codes?kind=${kind}`, api.signedIn], ([url]) => api.load(url), { revalidateOnFocus: false })
  const mine = own.data?.own ?? null
  // A guest without a post here: a new one takes a password, and one written with a lost key comes back by its code and password (REQ-COMMUNITY-031).
  const needsPin = guest && !!own.data && !mine

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
  const save = () => {
    const pinProblem = needsPin ? guestPinProblem(pin, locale) : null
    if (pinProblem) { showError(pinProblem); return }
    void run(async () => { await api.send('/api/friend-codes', 'POST', needsPin ? { ...draft, pin } : draft); rememberOwnCode(code); showSuccess(t(mine ? 'updated' : 'posted')) })
  }
  // The post goes to this browser's key; once it is read again as the viewer's own, the editor fills with it as with any saved post.
  const loadMine = async () => {
    setBusy(true)
    try {
      await recoverGuestPost({ kind, code }, pin)
      // Not read back: the editor would stay blank, ready to post over the post it just took.
      if (!(await own.mutate())?.own) throw Error('failed')
      showSuccess(guestT.recovered); setPin(''); setFilled(false)
    }
    catch (error) { showError(guestRecoverMessage(error instanceof Error ? error.message : undefined, locale)) }
    finally { setBusy(false) }
  }
  const remove = () => run(async () => { await api.send(`/api/friend-codes?kind=${kind}`, 'DELETE'); showSuccess(t('deleted')) })

  return <main className={`${styles.page} ${styles.compose}`}>
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
        {/* Last in the row: known only once the viewer's own post is read, and nothing before it moves when it comes in. */}
        {needsPin && <>
          <label>{guestT.pin}
            <GuestPinInput className={`${styles.code} ${styles.pin}`} value={pin} onChange={setPin} locale={locale} />
          </label>
          <button type="button" className={styles.ghost} disabled={busy || !codeOk || !isGuestPin(pin)} onClick={loadMine}>{guestT.loadMine}</button>
        </>}
      </div>
      <div className={styles.stage}><SupportStrips slots={slots} count={kind === 'support' ? 12 : WANT_LIMIT} onPick={setPicking} /></div>
      <p className={styles.warning}>{t('warning')}</p>
    </section>
    {picking !== null && <SupportSlotPicker key={picking} index={picking} value={slots[picking]} onClose={() => setPicking(null)}
      title={t(kind === 'support' ? 'picker.support' : 'picker.want')} identityOnly={kind === 'want'}
      onChange={slot => setSlots(current => current.map((item, at) => at === picking ? slot : item))} />}
  </main>
}

'use client'

import { useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { parseAsStringLiteral, useQueryState } from 'nuqs'
import useSWR from 'swr'
import { Check, CircleHelp, Copy, Flag, Search, X } from 'lucide-react'
import SupportStrips, { sinnerNumber, type SupportSlot } from '@/features/friends/components/SupportStrips'
import SupportSlotPicker from '@/features/friends/components/SupportSlotPicker'
import FriendGuide from '@/features/friends/components/FriendGuide'
import SupportSlotDetail from '@/features/friends/components/SupportSlotDetail'
import { KINDS, readOwnCode, rememberOwnCode, useFriendApi, useFriendCatalog, type Post } from '@/features/friends/hooks/useFriendBoard'
import { PostsSkeleton } from '@/features/friends/components/FriendsSkeleton'
import { FRIEND_CODE_RE, WANT_LIMIT } from '@/features/friends'
import BaseModal from '@/components/ui/BaseModal'
import ConfirmModal from '@/components/ui/ConfirmModal'
import PageHeader from '@/components/ui/PageHeader'
import { Link } from '@/lib/i18n/navigation'
import { getIdentityImageUrl } from '@/lib/utils/images'
import { showError, showSuccess } from '@/lib/toast'
import styles from './Friends.module.css'

/** "23:14": hours and minutes until a want post is deleted. */
function left(iso: string) {
  const minutes = Math.max(0, Math.floor((new Date(iso).getTime() - Date.now()) / 60000))
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`
}

/** The board: what others posted, by kind, optionally only posts with one identity. Writing is on its own page (new/). */
export default function FriendsClient() {
  const lang = useLocale(), t = useTranslations('friends'), api = useFriendApi(), catalog = useFriendCatalog()
  // The tab lives in the address (?tab=want; none for the default), so switching, reloading and sharing agree.
  const [tab, setTab] = useQueryState('tab', parseAsStringLiteral(KINDS).withDefault('support'))
  const [filter, setFilter] = useState<SupportSlot | null>(null)
  const [finding, setFinding] = useState(false)
  const [guide, setGuide] = useState(false)
  // A support strip of a post opened to see its E.G.O.
  const [viewing, setViewing] = useState<SupportSlot | null>(null)
  const [busy, setBusy] = useState(false)
  const [reporting, setReporting] = useState<string | null>(null)
  // Giving a code for an exchange post: the post, and the viewer's own code being typed.
  const [exchanging, setExchanging] = useState<string | null>(null)
  const [code, setCode] = useState('')

  const query = filter ? `&identity=${filter.identityId}` : ''
  const lists = {
    support: useSWR([`/api/friend-codes?kind=support${query}`, api.signedIn], ([url]) => api.load(url), { keepPreviousData: true }),
    want: useSWR([`/api/friend-codes?kind=want${query}`, api.signedIn], ([url]) => api.load(url), { keepPreviousData: true }),
  }
  const run = async (work: () => Promise<void>) => {
    setBusy(true)
    try { await work(); await Promise.all([lists.support.mutate(), lists.want.mutate()]) } catch (error) { showError(error instanceof Error ? error.message : t('errors.failed')) } finally { setBusy(false) }
  }
  const openExchange = (id: string) => { setCode(lists.support.data?.own?.code ?? lists.want.data?.own?.code ?? readOwnCode()); setExchanging(id) }
  const exchange = () => { const id = exchanging; setExchanging(null); if (id) void run(async () => { await api.send(`/api/friend-codes/${id}/exchange`, 'POST', { code }); rememberOwnCode(code) }) }
  const ask = (id: string) => run(async () => { await api.send(`/api/friend-codes/${id}/request`, 'POST'); showSuccess(t('requested')) })
  const decide = (id: string, request: string, decision: 'approved' | 'declined') => run(async () => { await api.send(`/api/friend-codes/${id}/request`, 'PATCH', { request, decision }) })
  const report = (id: string) => run(async () => { await api.send(`/api/friend-codes/${id}/report`, 'POST'); showSuccess(t('reported')) })
  const copy = (text: string) => navigator.clipboard.writeText(text).then(() => showSuccess(t('copied')), () => showError(t('copyFailed')))
  const ago = (iso: string) => {
    const minutes = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000))
    if (minutes < 1) return t('now')
    const format = new Intl.RelativeTimeFormat(lang, { numeric: 'always' })
    return minutes < 60 ? format.format(-minutes, 'minute') : minutes < 1440 ? format.format(-Math.round(minutes / 60), 'hour') : format.format(-Math.round(minutes / 1440), 'day')
  }
  const copyButton = (text: string) => <button type="button" className={styles.icon} onClick={() => copy(text)} aria-label={t('copy')} title={t('copy')}><Copy size={16} aria-hidden="true" /></button>
  const codeBox = (post: Post) => post.code
    ? <><b className={styles.code}>{post.code}</b>{copyButton(post.code)}</>
    : post.visibility === 'exchange'
      ? <button type="button" className={styles.primary} disabled={busy} onClick={() => openExchange(post.id)}>{t('exchange')}</button>
      : post.visibility === 'approval'
        ? post.request === 'pending' || post.request === 'declined'
          ? <span className={styles.tag}>{t(`request.${post.request}`)}</span>
          : <button type="button" className={styles.primary} disabled={busy} onClick={() => ask(post.id)}>{t('requestCode')}</button>
        : <span className={styles.tag}>{t('membersOnly')}</span>
  // Requests on the viewer's own approval post: each can be approved or declined, and the answer changed later.
  const requests = (post: Post) => post.requests && post.requests.length > 0 && <ul className={styles.requests} aria-label={t('request.title')}>
    {post.requests.map(item => <li key={item.id}>
      <strong>{item.name ?? t('guest', { tag: item.guestTag ?? '' })}</strong>
      {item.status !== 'pending' && <span className={styles.tag}>{t(`request.${item.status}`)}</span>}
      {item.status !== 'approved' && <button type="button" className={styles.icon} disabled={busy} onClick={() => decide(post.id, item.id, 'approved')} aria-label={t('request.approve')} title={t('request.approve')}><Check size={17} aria-hidden="true" /></button>}
      {item.status !== 'declined' && <button type="button" className={styles.icon} disabled={busy} onClick={() => decide(post.id, item.id, 'declined')} aria-label={t('request.decline')} title={t('request.decline')}><X size={17} aria-hidden="true" /></button>}
    </li>)}
  </ul>
  const received =(post: Post) => post.received && post.received.length > 0 && <ul className={styles.received}>
    {post.received.map(value => <li key={value}><b className={styles.code}>{value}</b>{copyButton(value)}</li>)}
  </ul>
  const who = (post: Post) => <>
    {post.author && post.authorId
      ? <Link href={`/users/${post.authorId}`} className={styles.author}>{post.author}</Link>
      : <strong>{post.author ?? t('guest', { tag: post.guestTag ?? '' })}</strong>}
    {post.mine && <span className={styles.tag}>{t('mine')}</span>}
    <span className={styles.seen}>{t('seen', { time: ago(post.seenAt) })}</span>
    {!post.mine && <button type="button" className={styles.icon} disabled={busy} onClick={() => setReporting(post.id)} aria-label={t('report')} title={t('report')}><Flag size={15} aria-hidden="true" /></button>}
  </>
  const list = lists[tab], posts = list.data?.posts ?? []
  const wanted = (lists.want.data?.wanted ?? []).flatMap(item => { const slot = catalog.slotOf(item.identityId); return slot ? [{ ...item, slot }] : [] })

  return <main className={styles.page}>
    <PageHeader title={t('title')} actions={<div className={styles.actions}>
      <button type="button" className={styles.ghost} onClick={() => setGuide(true)}><CircleHelp size={16} aria-hidden="true" />{t('guide.open')}</button>
      <Link href="/friends/new?kind=want" className={styles.ghost}>{t('compose.want')}</Link>
      <Link href="/friends/new" className={styles.primary}>{t('compose.support')}</Link>
    </div>} />

    {wanted.length > 0 && <section className={styles.rank}>
      <h2>{t('rank')}</h2>
      <div className={styles.plates}>
        {wanted.map((item, index) => <button type="button" key={item.identityId} className={styles.plate} onClick={() => { setFilter(item.slot); setTab('support') }}>
          <span className={styles.pic} style={{ backgroundImage: ['gacksung', 'normal'].map(state => `url("${getIdentityImageUrl(item.slot.identity.sinner_id, item.slot.identity.folder_name ?? '', `${item.slot.identity.game_id}_${state}_info`)}")`).join(', ') }} />
          <span className={styles.plateIn}>
            <span className={styles.rankNo}>{index + 1}</span>
            <b>{item.slot.name}</b>
            <span className={styles.count}>{item.count}<small>{t('rankUnit')}</small></span>
          </span>
        </button>)}
      </div>
    </section>}

    <div className={styles.bar}>
      <div className={styles.segments} role="tablist">
        {KINDS.map(value => <button type="button" role="tab" key={value} aria-selected={tab === value} onClick={() => setTab(value)}>
          {t(`tabs.${value}`)}{lists[value].data && <small>{lists[value].data!.posts.length}</small>}
        </button>)}
      </div>
      {filter
        ? <span className={styles.chip}><i>{sinnerNumber(filter.identity.sinner_id)}</i>{filter.name}
          <button type="button" className={styles.icon} onClick={() => setFilter(null)} aria-label={t('filter.clear')} title={t('filter.clear')}><X size={15} aria-hidden="true" /></button></span>
        : <button type="button" className={styles.ghost} onClick={() => setFinding(true)}><Search size={15} aria-hidden="true" />{t('filter.find')}</button>}
    </div>

    {list.error
      ? <p className={styles.state}>{t('loadFailed')}<button type="button" className={styles.ghost} onClick={() => void list.mutate()}>{t('retry')}</button></p>
      : !list.data ? <PostsSkeleton kind={tab} /> : !posts.length && <p className={styles.state}>{t('empty')}</p>}
    {tab === 'support'
      ? <section className={styles.list}>
        {posts.map(post => <article key={post.id} className={`${styles.post} ${post.mine ? styles.mine : ''}`}>
          <header>{who(post)}<span className={styles.codeBox}>{codeBox(post)}</span></header>
          <SupportStrips slots={catalog.supportSlots(post.slots)} onOpen={index => setViewing(catalog.supportSlots(post.slots)[index])} />
          {received(post)}
          {requests(post)}
        </article>)}
      </section>
      : <section className={styles.wants}>
        {posts.map(post => {
          const asked = catalog.wantSlots(post.identityIds)
          return <article key={post.id} className={`${styles.want} ${post.mine ? styles.mine : ''}`}>
            <SupportStrips slots={asked} count={WANT_LIMIT} />
            <div className={styles.info}>
              {post.expiresAt && <span className={styles.left} title={t('timeLeft', { time: left(post.expiresAt) })}>{left(post.expiresAt)}</span>}
              <span className={styles.codeBox}>{codeBox(post)}</span>
              {received(post)}
              {requests(post)}
              <p className={styles.who}>{who(post)}</p>
            </div>
          </article>
        })}
      </section>}

    {guide && <FriendGuide onClose={() => setGuide(false)} />}
    {viewing && <SupportSlotDetail slot={viewing} onClose={() => setViewing(null)} />}
    {finding && <SupportSlotPicker index={0} value={filter} onClose={() => setFinding(false)} title={t('picker.find')} identityOnly onChange={setFilter} />}
    <BaseModal open={exchanging !== null} onClose={() => setExchanging(null)} title={t('exchangeTitle')} maxWidth="26rem">
      <form className={styles.exchange} onSubmit={event => { event.preventDefault(); if (FRIEND_CODE_RE.test(code)) exchange() }}>
        <h2>{t('exchangeTitle')}</h2>
        <input className={styles.code} value={code} autoFocus onChange={event => setCode(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10))} placeholder="A000000000" autoComplete="off" aria-label={t('myCode')} />
        <p className={styles.warning}>{t('warning')}</p>
        <div className={styles.actions}>
          <button type="button" className={styles.ghost} onClick={() => setExchanging(null)}>{t('cancel')}</button>
          <button type="submit" className={styles.primary} disabled={!FRIEND_CODE_RE.test(code)}>{t('exchange')}</button>
        </div>
      </form>
    </BaseModal>
    <ConfirmModal open={reporting !== null} title={t('reportConfirm.title')} message={t('reportConfirm.message')} confirmLabel={t('report')} variant="danger"
      onCancel={() => setReporting(null)} onConfirm={() => { const id = reporting; setReporting(null); if (id) void report(id) }} />
  </main>
}

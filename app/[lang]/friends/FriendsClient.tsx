'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocale } from 'next-intl'
import { useSession } from 'next-auth/react'
import useSWR from 'swr'
import { Copy, Trash2 } from 'lucide-react'
import SupportStrips, { EGO_GRADES, type SupportSlot } from '@/components/friends/SupportStrips'
import SupportSlotPicker from '@/components/friends/SupportSlotPicker'
import UnderlineTabBar from '@/components/ui/UnderlineTabBar'
import { fetchNoteAssets } from '@/components/notes/NoteBlockViewer'
import { assetName, type NoteAssetData } from '@/lib/notes/assets'
import { GUEST_KEY_HEADER, guestHeaders, readGuestKey } from '@/lib/guest/key'
import { FRIEND_CODE_RE, WANT_LIMIT, type StoredSlot, type Visibility } from '@/lib/friends/codes'
import { showError, showSuccess } from '@/lib/toast'
import styles from './Friends.module.css'

const VISIBILITY = [['public', '누구나'], ['members', '로그인한 사람'], ['exchange', '코드 교환']] as const
const TABS = [{ key: 'support', label: '지원 인격' }, { key: 'want', label: '인격 구해요' }]
type Kind = 'support' | 'want'
type Post = {
  id: string; visibility: Visibility; slots: StoredSlot[]; identityIds: string[]; mine: boolean; bumpedAt: string; seenAt: string
  author: string | null; guestTag: string | null; code: string | null; received?: string[]; expiresAt?: string
}
type Slots = (SupportSlot | null)[]
const empty = (count: number): Slots => Array(count).fill(null)

/** "방금", "3시간 전": how long ago the author was last on the site. */
function ago(iso: string, lang: string) {
  const minutes = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000))
  if (minutes < 1) return lang === 'en' ? 'now' : lang === 'ja' ? 'たった今' : '방금'
  const format = new Intl.RelativeTimeFormat(lang, { numeric: 'always' })
  return minutes < 60 ? format.format(-minutes, 'minute') : minutes < 1440 ? format.format(-Math.round(minutes / 60), 'hour') : format.format(-Math.round(minutes / 1440), 'day')
}
/** "23:14": hours and minutes until a want post is deleted. */
function left(iso: string) {
  const minutes = Math.max(0, Math.floor((new Date(iso).getTime() - Date.now()) / 60000))
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`
}
/** What a save would send, in a fixed order: equal strings mean nothing changed since the saved post. */
const supportBody = (slots: Slots) => slots.flatMap((slot, index) => slot
  ? [{ slot: index, identity: slot.identityId, egos: Object.fromEntries(EGO_GRADES.flatMap(grade => slot.egos[grade] ? [[grade, slot.egos[grade]]] : [])) }] : [])
const wantBody = (slots: Slots) => [...new Set(slots.flatMap(slot => slot ? [slot.identityId] : []))]

export default function FriendsClient() {
  const lang = useLocale(), signedIn = useSession().status === 'authenticated'
  const [tab, setTab] = useState<Kind>('support')
  const [slots, setSlots] = useState<Record<Kind, Slots>>({ support: empty(12), want: empty(WANT_LIMIT) })
  const [picking, setPicking] = useState<number | null>(null)
  const [code, setCode] = useState('')
  const [visibility, setVisibility] = useState<Visibility>('public')
  const [busy, setBusy] = useState(false)
  const [filled, setFilled] = useState<Record<Kind, boolean>>({ support: false, want: false })
  const codeInput = useRef<HTMLInputElement>(null)

  const identities = useSWR('/api/notes/assets?kind=identity&catalog=1', fetchNoteAssets, { revalidateOnFocus: false })
  // Readers send the guest key only if this browser already has one: looking at the list does not create it.
  const list = useSWR([`/api/friend-codes?kind=${tab}`, signedIn], async ([url]) => {
    const guest = signedIn ? null : readGuestKey()
    const response = await fetch(url, { headers: guest ? { [GUEST_KEY_HEADER]: guest } : {} })
    if (!response.ok) throw Error('list')
    return (await response.json()).posts as Post[]
  })
  const byId = useMemo(() => new Map((identities.data ?? []).map(asset => [asset.id, asset] as [string, NoteAssetData])), [identities.data])
  const slotOf = (id: string, egos: SupportSlot['egos'] = {}): SupportSlot | null => {
    const asset = byId.get(id)
    return asset?.identity ? { identityId: asset.id, identity: asset.identity, name: assetName(asset, lang), egos } : null
  }
  const supportSlots = (stored: StoredSlot[]) => { const next = empty(12); for (const item of stored) next[item.slot] = slotOf(item.identity, item.egos); return next }
  const wantSlots = (ids: string[]) => Array.from({ length: WANT_LIMIT }, (_, index) => ids[index] ? slotOf(ids[index]) : null)

  // The author's saved post goes into the editor once, so saving again edits it.
  const mine = list.data?.find(post => post.mine)
  useEffect(() => {
    if (filled[tab] || !mine || !byId.size) return
    setSlots(current => ({ ...current, [tab]: tab === 'support' ? supportSlots(mine.slots) : wantSlots(mine.identityIds) }))
    setVisibility(mine.visibility); if (mine.code) setCode(mine.code)
    setFilled(current => ({ ...current, [tab]: true }))
  // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once per tab when its list and the catalogue are in
  }, [filled, mine, byId, tab])

  const send = async (url: string, method: string, body?: unknown) => {
    const response = await fetch(url, { method, headers: { 'Content-Type': 'application/json', ...guestHeaders(signedIn) }, body: body === undefined ? undefined : JSON.stringify(body) })
    const data = await response.json().catch(() => ({}))
    if (!response.ok) throw Error(data.error || '요청에 실패했습니다.')
    return data
  }
  const run = async (work: () => Promise<void>) => {
    setBusy(true)
    try { await work(); await list.mutate() } catch (error) { showError(error instanceof Error ? error.message : '요청에 실패했습니다.') } finally { setBusy(false) }
  }
  const current = slots[tab], codeOk = FRIEND_CODE_RE.test(code), chosen = current.filter(Boolean).length
  const draft = tab === 'support' ? { kind: tab, code, visibility, slots: supportBody(current) } : { kind: tab, code, visibility, identities: wantBody(current) }
  // The saved post in the same shape: when it equals the draft there is nothing to save.
  const saved = !mine ? null : tab === 'support'
    ? { kind: tab, code: mine.code, visibility: mine.visibility, slots: supportBody(supportSlots(mine.slots)) }
    : { kind: tab, code: mine.code, visibility: mine.visibility, identities: mine.identityIds }
  const changed = JSON.stringify(draft) !== JSON.stringify(saved)
  const save = () => run(async () => { await send('/api/friend-codes', 'POST', draft); showSuccess(mine ? '수정했습니다.' : '올렸습니다.') })
  const remove = () => run(async () => {
    await send(`/api/friend-codes?kind=${tab}`, 'DELETE')
    setSlots(all => ({ ...all, [tab]: empty(all[tab].length) })); showSuccess('지웠습니다.')
  })
  // Exchanging needs the viewer's own code: without it the button points at the code field instead of doing nothing.
  const exchange = (id: string) => {
    if (codeOk) return void run(async () => { await send(`/api/friend-codes/${id}/exchange`, 'POST', { code }) })
    codeInput.current?.scrollIntoView({ block: 'center', behavior: 'smooth' })
    codeInput.current?.focus({ preventScroll: true })
  }
  const copy = (text: string) => navigator.clipboard.writeText(text).then(() => showSuccess('복사했습니다.'), () => showError('복사하지 못했습니다.'))
  const codeBox = (post: Post) => post.code
    ? <><b className={styles.code}>{post.code}</b><button type="button" className={styles.icon} onClick={() => copy(post.code!)} aria-label="복사" title="복사"><Copy size={16} aria-hidden="true" /></button></>
    : post.visibility === 'exchange'
      ? <button type="button" className={styles.primary} disabled={busy} aria-disabled={!codeOk} data-tip={codeOk ? undefined : '위에 내 친구 코드를 적으면 교환할 수 있습니다'} onClick={() => exchange(post.id)}>코드 교환</button>
      : <span className={styles.tag}>로그인한 사람</span>
  const received = (post: Post) => post.received && post.received.length > 0 && <ul className={styles.received}>
    {post.received.map(value => <li key={value}><b className={styles.code}>{value}</b><button type="button" className={styles.icon} onClick={() => copy(value)} aria-label="복사" title="복사"><Copy size={16} aria-hidden="true" /></button></li>)}
  </ul>
  const who = (post: Post) => <><strong>{post.author ?? `익명 #${post.guestTag}`}</strong>{post.mine && <span className={styles.tag}>내 글</span>}<span className={styles.seen}>접속 {ago(post.seenAt, lang)}</span></>

  return <main className={styles.page}>
    <h1>친구 코드</h1>
    <UnderlineTabBar className={styles.tabs} tabs={TABS} activeKey={tab} onTabChange={next => { setTab(next as Kind); setPicking(null) }} />
    <section className={styles.editor}>
      <div className={styles.fields}>
        <label>내 친구 코드
          <input ref={codeInput} className={styles.code} value={code} onChange={event => setCode(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10))} placeholder="A000000000" autoComplete="off" />
        </label>
        <div>코드를 볼 수 있는 사람
          <div className={styles.segments}>
            {VISIBILITY.map(([value, label]) => <button type="button" key={value} aria-pressed={visibility === value} onClick={() => setVisibility(value)}>{label}</button>)}
          </div>
        </div>
        <div className={styles.actions}>
          {mine && <button type="button" className={`${styles.icon} ${styles.boxed}`} disabled={busy} onClick={remove} aria-label="지우기" title="지우기"><Trash2 size={18} aria-hidden="true" /></button>}
          <button type="button" className={styles.primary} disabled={busy || !codeOk || !chosen || !changed} onClick={save}>{mine ? '수정' : '올리기'}</button>
        </div>
      </div>
      {tab === 'support'
        ? <SupportStrips slots={current} onPick={setPicking} />
        : <div className={styles.wantEdit}><span>구하는 인격</span><SupportStrips slots={current} count={WANT_LIMIT} onPick={setPicking} /></div>}
      <p className={styles.warning}>다른 사람의 친구 코드나 가짜 코드를 올리면 이용이 정지됩니다.</p>
    </section>

    {tab === 'support'
      ? <section className={styles.list}>
        {(list.data ?? []).map(post => <article key={post.id} className={styles.post}>
          <header>{who(post)}<span className={styles.codeBox}>{codeBox(post)}</span></header>
          <SupportStrips slots={supportSlots(post.slots)} />
          {received(post)}
        </article>)}
      </section>
      : <section className={styles.wants}>
        {(list.data ?? []).map(post => {
          const wanted = wantSlots(post.identityIds)
          return <article key={post.id} className={`${styles.want} ${post.mine ? styles.mine : ''}`}>
            <SupportStrips slots={wanted} count={WANT_LIMIT} />
            <div className={styles.info}>
              {post.expiresAt && <span className={styles.left}>{left(post.expiresAt)}</span>}
              <ul className={styles.names}>{wanted.map(slot => slot && <li key={slot.identityId}>{slot.name}</li>)}</ul>
              <span className={styles.codeBox}>{codeBox(post)}</span>
              {received(post)}
              <p className={styles.who}>{who(post)}</p>
            </div>
          </article>
        })}
      </section>}

    {picking !== null && <SupportSlotPicker key={`${tab}-${picking}`} index={picking} value={current[picking]} onClose={() => setPicking(null)}
      title={tab === 'support' ? '지원 인격' : '구하는 인격'} identityOnly={tab === 'want'}
      onChange={slot => setSlots(all => ({ ...all, [tab]: all[tab].map((item, at) => at === picking ? slot : item) }))} />}
  </main>
}

'use client'

import { useEffect, useMemo, useState } from 'react'
import { useLocale } from 'next-intl'
import { useSession } from 'next-auth/react'
import useSWR from 'swr'
import SupportStrips, { type SupportSlot } from '@/components/friends/SupportStrips'
import SupportSlotPicker from '@/components/friends/SupportSlotPicker'
import { fetchNoteAssets } from '@/components/notes/NoteBlockViewer'
import { assetName, type NoteAssetData } from '@/lib/notes/assets'
import { GUEST_KEY_HEADER, guestHeaders, readGuestKey } from '@/lib/guest/key'
import { FRIEND_CODE_RE, type StoredSlot, type Visibility } from '@/lib/friends/codes'
import { showError, showSuccess } from '@/lib/toast'
import styles from './Friends.module.css'

const VISIBILITY = [['public', '누구나'], ['members', '로그인한 사람'], ['exchange', '코드 교환']] as const
type Post = {
  id: string; visibility: Visibility; slots: StoredSlot[]; mine: boolean; bumpedAt: string; seenAt: string
  author: string | null; guestTag: string | null; code: string | null; received?: string[]
}
const EMPTY: (SupportSlot | null)[] = Array(12).fill(null)

/** "방금", "3시간 전": how long ago the author was last on the site. */
function ago(iso: string, lang: string) {
  const minutes = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000))
  if (minutes < 1) return lang === 'en' ? 'now' : lang === 'ja' ? 'たった今' : '방금'
  const format = new Intl.RelativeTimeFormat(lang, { numeric: 'always' })
  return minutes < 60 ? format.format(-minutes, 'minute') : minutes < 1440 ? format.format(-Math.round(minutes / 60), 'hour') : format.format(-Math.round(minutes / 1440), 'day')
}

export default function FriendsClient() {
  const lang = useLocale(), signedIn = useSession().status === 'authenticated'
  const [slots, setSlots] = useState<(SupportSlot | null)[]>(EMPTY)
  const [picking, setPicking] = useState<number | null>(null)
  const [code, setCode] = useState('')
  const [visibility, setVisibility] = useState<Visibility>('public')
  const [busy, setBusy] = useState(false)
  const [filled, setFilled] = useState(false)

  const identities = useSWR('/api/notes/assets?kind=identity&catalog=1', fetchNoteAssets, { revalidateOnFocus: false })
  const egos = useSWR('/api/notes/assets?kind=ego&catalog=1', fetchNoteAssets, { revalidateOnFocus: false })
  // Readers send the guest key only if this browser already has one: looking at the list does not create it.
  const list = useSWR(['/api/friend-codes', signedIn], async ([url]) => {
    const guest = signedIn ? null : readGuestKey()
    const response = await fetch(url, { headers: guest ? { [GUEST_KEY_HEADER]: guest } : {} })
    if (!response.ok) throw Error('list')
    return (await response.json()).posts as Post[]
  })
  const byId = useMemo(() => new Map((identities.data ?? []).map(asset => [asset.id, asset] as [string, NoteAssetData])), [identities.data])
  const toSlots = useMemo(() => (stored: StoredSlot[]) => {
    const next = [...EMPTY]
    for (const item of stored) {
      const asset = byId.get(item.identity)
      if (asset?.identity) next[item.slot] = { identityId: asset.id, identity: asset.identity, name: assetName(asset, lang), egos: item.egos }
    }
    return next
  }, [byId, lang])

  // The author's saved line-up goes into the editor once, so saving again edits it.
  const mine = list.data?.find(post => post.mine)
  useEffect(() => {
    if (filled || !mine || !byId.size) return
    setSlots(toSlots(mine.slots)); setVisibility(mine.visibility); if (mine.code) setCode(mine.code); setFilled(true)
  }, [filled, mine, byId, toSlots])

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
  const codeOk = FRIEND_CODE_RE.test(code), chosen = slots.filter(Boolean).length
  const save = () => run(async () => {
    await send('/api/friend-codes', 'POST', { code, visibility, slots: slots.flatMap((slot, index) => slot ? [{ slot: index, identity: slot.identityId, egos: slot.egos }] : []) })
    setFilled(true); showSuccess(mine ? '수정했습니다.' : '올렸습니다.')
  })
  const remove = () => run(async () => { await send('/api/friend-codes', 'DELETE'); setSlots(EMPTY); showSuccess('지웠습니다.') })
  const exchange = (id: string) => run(async () => { await send(`/api/friend-codes/${id}/exchange`, 'POST', { code }) })
  const copy = (text: string) => navigator.clipboard.writeText(text).then(() => showSuccess('복사했습니다.'), () => showError('복사하지 못했습니다.'))

  return <main className={styles.page}>
    <h1>친구 코드</h1>
    <section className={styles.editor}>
      <div className={styles.fields}>
        <label>내 친구 코드
          <input className={styles.code} value={code} onChange={event => setCode(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10))} placeholder="A000000000" autoComplete="off" />
        </label>
        <div>코드를 볼 수 있는 사람
          <div className={styles.segments}>
            {VISIBILITY.map(([value, label]) => <button type="button" key={value} aria-pressed={visibility === value} onClick={() => setVisibility(value)}>{label}</button>)}
          </div>
        </div>
        <div className={styles.actions}>
          {mine && <button type="button" className={styles.ghost} disabled={busy} onClick={remove}>지우기</button>}
          <button type="button" className={styles.primary} disabled={busy || !codeOk || !chosen} onClick={save}>{mine ? '수정' : '올리기'}</button>
        </div>
      </div>
      <SupportStrips slots={slots} onPick={setPicking} />
      <p className={styles.warning}>다른 사람의 친구 코드나 가짜 코드를 올리면 이용이 정지됩니다.</p>
    </section>

    <section className={styles.list}>
      {(list.data ?? []).map(post => <article key={post.id} className={styles.post}>
        <header>
          <strong>{post.author ?? `익명 #${post.guestTag}`}</strong>
          {post.mine && <span className={styles.tag}>내 글</span>}
          <span className={styles.seen}>접속 {ago(post.seenAt, lang)}</span>
          <span className={styles.codeBox}>
            {post.code
              ? <><b className={styles.code}>{post.code}</b><button type="button" className={styles.ghost} onClick={() => copy(post.code!)}>복사</button></>
              : post.visibility === 'exchange'
                ? <button type="button" className={styles.primary} disabled={busy || !codeOk} onClick={() => exchange(post.id)}>코드 교환</button>
                : <span className={styles.tag}>로그인한 사람</span>}
          </span>
        </header>
        <SupportStrips slots={toSlots(post.slots)} />
        {post.received && post.received.length > 0 && <ul className={styles.received}>
          {post.received.map(value => <li key={value}><b className={styles.code}>{value}</b><button type="button" className={styles.ghost} onClick={() => copy(value)}>복사</button></li>)}
        </ul>}
      </article>)}
    </section>

    {picking !== null && <SupportSlotPicker index={picking} value={slots[picking]} onClose={() => setPicking(null)}
      onDone={slot => { setSlots(current => current.map((item, at) => at === picking ? slot : item)); setPicking(null) }} />}
  </main>
}

'use client'

import { useRef, useState } from 'react'
import useSWR from 'swr'
import { useLocale } from 'next-intl'
import { Search, ArrowLeft, ArrowUpRight, ChevronLeft, ChevronRight, Users } from 'lucide-react'
import { Link } from '@/lib/i18n/navigation'
import { useDebounce } from '@/hooks/useDebounce'
import { DEFAULT_AVATAR_URL } from '@/lib/constants/game'
import ImageWithFallback from '@/components/ui/ImageWithFallback'
import BaseModal from '@/components/ui/BaseModal'
import { showError, showSuccess } from '@/lib/toast'
import './admin-users.css'

const copy = {
  ko: {
    title: '유저 관리', intro: '계정 상태와 활동을 확인하고 관리합니다.', search: '닉네임 또는 이메일 검색', all: '전체', active: '정상', suspended: '이용 제한',
    user: '유저', joined: '가입일', seen: '최근 활동', status: '상태', empty: '검색 조건에 맞는 유저가 없습니다.', loading: '불러오는 중…', error: '유저 정보를 불러오지 못했습니다.', retry: '다시 불러오기', results: '검색 결과', people: '명', prev: '이전 페이지', next: '다음 페이지', back: '목록으로', pick: '목록에서 유저를 선택하세요.', profile: '공개 프로필 보기', member: '일반 회원', staff: '운영 계정', unknown: '기록 없음', decks: '작성한 덱', plans: '작성한 플랜', recent: '최근 작성', noPosts: '작성한 덱과 플랜이 없습니다.', moderation: '계정 이용 제한', reason: '제한 사유', placeholder: '이용 제한 사유를 입력하세요.', period: '제한 기간', days7: '7일', days30: '30일', forever: '무기한', until: '제한 종료', protect: '본인과 운영 계정은 이 화면에서 제한할 수 없습니다.', suspend: '이용 제한', release: '제한 해제', cancel: '취소', confirm: '변경 확인', saving: '저장 중…', saved: '계정 상태를 변경했습니다.', failed: '변경하지 못했습니다. 상태를 확인한 뒤 다시 시도하세요.', conflict: '계정 상태가 변경되었습니다. 최신 정보를 확인하세요.', history: '최근 제한 기록', expired: '기간 만료', noHistory: '이용 제한 기록이 없습니다.', count: '개',
  },
  en: {
    title: 'User management', intro: 'Review account status and activity.', search: 'Search nickname or email', all: 'All', active: 'Active', suspended: 'Restricted', user: 'User', joined: 'Joined', seen: 'Last active', status: 'Status', empty: 'No users match these filters.', loading: 'Loading…', error: 'Could not load user information.', retry: 'Retry', results: 'Results', people: 'users', prev: 'Previous page', next: 'Next page', back: 'Back to users', pick: 'Select a user from the list.', profile: 'View public profile', member: 'Member', staff: 'Staff account', unknown: 'Not recorded', decks: 'Decks created', plans: 'Plans created', recent: 'Recently created', noPosts: 'No decks or plans created.', moderation: 'Account restriction', reason: 'Reason', placeholder: 'Explain the reason for restricting this account.', period: 'Duration', days7: '7 days', days30: '30 days', forever: 'Indefinite', until: 'Restriction ends', protect: 'You cannot restrict yourself or staff accounts here.', suspend: 'Restrict account', release: 'Lift restriction', cancel: 'Cancel', confirm: 'Confirm change', saving: 'Saving…', saved: 'Account status updated.', failed: 'Could not update the account. Check its status and try again.', conflict: 'Account status changed. Review the latest information.', history: 'Recent restrictions', expired: 'Expired', noHistory: 'No restriction history.', count: '',
  },
  ja: {
    title: 'ユーザー管理', intro: 'アカウントの状態と活動を確認・管理します。', search: 'ニックネーム・メールで検索', all: 'すべて', active: '通常', suspended: '利用制限', user: 'ユーザー', joined: '登録日', seen: '最近の活動', status: '状態', empty: '条件に一致するユーザーはいません。', loading: '読み込み中…', error: 'ユーザー情報を読み込めませんでした。', retry: '再読み込み', results: '検索結果', people: '人', prev: '前のページ', next: '次のページ', back: '一覧へ', pick: '一覧からユーザーを選択してください。', profile: '公開プロフィール', member: '一般会員', staff: '運営アカウント', unknown: '記録なし', decks: '作成したデッキ', plans: '作成したプラン', recent: '最近の作成', noPosts: 'デッキ・プランはありません。', moderation: 'アカウント利用制限', reason: '制限理由', placeholder: '利用を制限する理由を入力してください。', period: '制限期間', days7: '7日', days30: '30日', forever: '無期限', until: '制限終了', protect: '自分と運営アカウントはここでは制限できません。', suspend: '利用を制限', release: '制限を解除', cancel: 'キャンセル', confirm: '変更を確認', saving: '保存中…', saved: '状態を変更しました。', failed: '変更できませんでした。状態を確認して再試行してください。', conflict: '状態が変更されました。最新情報をご確認ください。', history: '最近の制限記録', expired: '期間満了', noHistory: '利用制限の記録はありません。', count: '件',
  },
}
type Copy = typeof copy.en
type User = { id: string; username: string | null; avatar_url: string | null; created_at: string; last_seen_at: string | null; restricted: boolean }
type Post = { id: string; title: string }
type Detail = User & {
  role: string; protected: boolean; suspension_reason: string | null; suspended_at: string | null; suspended_until: string | null;
  decks: Post[]; plans: Post[]; deckCount: number; planCount: number;
  history: { id: string; action: string; created_at: string; details: { reason?: string | null } | null }[];
}
async function fetcher(url: string) {
  const response = await fetch(url, { cache: 'no-store' })
  if (!response.ok) throw new Error('unavailable')
  return response.json()
}
function Avatar({ user, size = 36 }: { user: User; size?: number }) {
  return <ImageWithFallback src={user.avatar_url || DEFAULT_AVATAR_URL} width={size} height={size} alt="" className="admin-users-avatar" />
}
function Status({ restricted, c }: { restricted: boolean; c: Copy }) {
  return <span className="admin-users-status" data-restricted={restricted}><span aria-hidden="true" />{restricted ? c.suspended : c.active}</span>
}
export default function AdminUsers() {
  const locale = useLocale()
  const c = copy[locale as keyof typeof copy] ?? copy.en
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')
  const [page, setPage] = useState(1)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [mobileDetail, setMobileDetail] = useState(false)
  const listRef = useRef<HTMLDivElement>(null)
  const detailRef = useRef<HTMLElement>(null)
  const debouncedSearch = useDebounce(search, 300)
  const url = `/api/admin/users?${new URLSearchParams({ search: debouncedSearch, status, page: String(page) })}`
  const { data, error, isLoading, mutate } = useSWR<{ users: User[]; total: number }>(url, fetcher)
  const currentId = data?.users.some(u => u.id === selectedId) ? selectedId : data?.users[0]?.id
  const date = (value: string | null) => value ? new Date(value).toLocaleDateString(locale) : c.unknown
  function reset() { setPage(1); setSelectedId(null); setMobileDetail(false) }
  return <section className="admin-users">
    <header className="admin-users-heading"><h1>{c.title}</h1><p>{c.intro}</p></header>
    <div className="admin-users-toolbar">
      <label className="admin-users-search"><Search size={18} aria-hidden="true" /><input aria-label={c.search} placeholder={c.search} value={search} maxLength={100} onChange={e => { setSearch(e.target.value); reset() }} /></label>
      <div className="admin-users-filters" aria-label={c.status}>{(['all', 'active', 'suspended'] as const).map(s => <button key={s} type="button" aria-pressed={status === s} onClick={() => { setStatus(s); reset() }}>{c[s]}</button>)}</div>
      <span className="admin-users-total" aria-live="polite">{c.results} <strong>{data?.total ?? '—'}</strong> {c.people}</span>
    </div>
    <div className="admin-users-grid" data-detail={mobileDetail}>
      <div className="admin-users-list" ref={listRef} tabIndex={-1}>
        {error ? <div className="admin-users-message" role="alert"><p>{c.error}</p><button onClick={() => mutate()}>{c.retry}</button></div> : isLoading ? <p className="admin-users-message" role="status">{c.loading}</p> : !data?.users.length ? <div className="admin-users-message"><Users aria-hidden="true" /><p>{c.empty}</p></div> : <>
          <table><thead><tr><th>{c.user}</th><th className="admin-users-joined">{c.joined}</th><th>{c.seen}</th><th>{c.status}</th></tr></thead>
            <tbody>{data.users.map(user => <tr key={user.id} data-selected={currentId === user.id}><td><button className="admin-users-person" aria-pressed={currentId === user.id} onClick={() => { setSelectedId(user.id); setMobileDetail(true); requestAnimationFrame(() => detailRef.current?.focus()) }}><Avatar user={user} /><span>{user.username || c.member}</span></button></td><td className="admin-users-joined">{date(user.created_at)}</td><td>{date(user.last_seen_at)}</td><td><Status restricted={user.restricted} c={c} /></td></tr>)}</tbody>
          </table>
          <nav className="admin-users-pagination" aria-label={c.results}><button aria-label={c.prev} disabled={page <= 1} onClick={() => { setPage(p => p - 1); setSelectedId(null) }}><ChevronLeft size={18} /></button><span>{page} / {Math.max(1, Math.ceil(data.total / 20))}</span><button aria-label={c.next} disabled={page * 20 >= data.total} onClick={() => { setPage(p => p + 1); setSelectedId(null) }}><ChevronRight size={18} /></button></nav>
        </>}
      </div>
      <aside className="admin-users-detail" ref={detailRef} tabIndex={-1} aria-label={c.user}>
        <button className="admin-users-back" onClick={() => { setMobileDetail(false); requestAnimationFrame(() => listRef.current?.focus()) }}><ArrowLeft size={16} />{c.back}</button>
        {currentId && !error ? <UserDetail key={currentId} id={currentId} c={c} date={date} onUpdated={async () => { await mutate() }} /> : <p className="admin-users-message">{c.pick}</p>}
      </aside>
    </div>
  </section>
}
function UserDetail({ id, c, date, onUpdated }: { id: string; c: Copy; date: (v: string | null) => string; onUpdated: () => Promise<void> }) {
  const { data: user, error, mutate } = useSWR<Detail>(`/api/admin/users/${id}`, fetcher)
  const [reason, setReason] = useState('')
  const [durationDays, setDays] = useState<number | null>(7)
  const [confirm, setConfirm] = useState<{ suspended: boolean; expectedSuspendedAt: string | null; reason?: string; durationDays?: number | null } | null>(null)
  const [busy, setBusy] = useState(false)
  const submitting = useRef(false)
  const [actionError, setActionError] = useState('')
  async function save() {
    if (!user || !confirm || submitting.current) return
    submitting.current = true; setBusy(true); setActionError('')
    try {
      const response = await fetch(`/api/admin/users/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(confirm) })
      if (!response.ok) {
        if (response.status === 409) { setConfirm(null); await mutate(); throw new Error(c.conflict) }
        throw new Error(c.failed)
      }
      setConfirm(null); setReason(''); showSuccess(c.saved)
      await Promise.all([mutate(), onUpdated()])
    } catch (e) { const message = e instanceof Error ? e.message : c.failed; setActionError(message); showError(message) }
    finally { submitting.current = false; setBusy(false) }
  }
  if (error) return <div className="admin-users-message" role="alert"><p>{c.error}</p><button onClick={() => mutate()}>{c.retry}</button></div>
  if (!user) return <p className="admin-users-message" role="status">{c.loading}</p>
  const daysLabel = confirm?.durationDays === 7 ? c.days7 : confirm?.durationDays === 30 ? c.days30 : c.forever
  const openConfirmation = () => setConfirm({ suspended: !user.restricted, expectedSuspendedAt: user.suspended_at, ...(!user.restricted ? { reason: reason.trim(), durationDays } : {}) })
  return <>
    <div className="admin-users-profile"><Avatar user={user} size={56} /><div><h2>{user.username || c.member}</h2><p>{user.role === 'user' ? c.member : c.staff}</p></div><Status restricted={user.restricted} c={c} /></div>
    <Link href={`/users/${id}`} className="admin-users-profile-link">{c.profile}<ArrowUpRight size={14} /></Link>
    <dl className="admin-users-dates"><div><dt>{c.joined}</dt><dd>{date(user.created_at)}</dd></div><div><dt>{c.seen}</dt><dd>{date(user.last_seen_at)}</dd></div></dl>
    <div className="admin-users-counts"><div><span>{c.decks}</span><strong>{user.deckCount}<small>{c.count}</small></strong></div><div><span>{c.plans}</span><strong>{user.planCount}<small>{c.count}</small></strong></div></div>
    <details className="admin-users-posts"><summary>{c.recent}</summary>{!user.decks.length && !user.plans.length ? <p>{c.noPosts}</p> : <ul>{user.decks.map(p => <li key={p.id}><span>{c.decks}</span><Link href={`/decks/${p.id}`}>{p.title}<ArrowUpRight size={12} /></Link></li>)}{user.plans.map(p => <li key={p.id}><span>{c.plans}</span><Link href={`/planner/community/${p.id}`}>{p.title}<ArrowUpRight size={12} /></Link></li>)}</ul>}</details>
    <section className="admin-users-moderation"><h3>{c.moderation}</h3>
      {user.protected ? <p className="admin-users-muted">{c.protect}</p> : user.restricted ? <><p className="admin-users-reason">{user.suspension_reason}</p><p className="admin-users-muted">{c.until} · {user.suspended_until ? date(user.suspended_until) : c.forever}</p><button className="admin-users-primary" disabled={busy} onClick={openConfirmation}>{c.release}</button></> : <form onSubmit={e => { e.preventDefault(); openConfirmation() }}>
        <label htmlFor="admin-suspension-reason">{c.reason}</label><textarea id="admin-suspension-reason" placeholder={c.placeholder} value={reason} onChange={e => setReason(e.target.value)} required maxLength={1000} rows={3} />
        <fieldset><legend>{c.period}</legend>{([7, 30, null] as const).map(d => <label key={String(d)}><input type="radio" name="duration" checked={durationDays === d} onChange={() => setDays(d)} /><span>{d === 7 ? c.days7 : d === 30 ? c.days30 : c.forever}</span></label>)}</fieldset>
        <button type="submit" className="admin-users-danger" disabled={!reason.trim() || busy}>{c.suspend}</button>
      </form>}
      {actionError && <p role="alert" className="admin-users-action-error">{actionError}</p>}
    </section>
    <details className="admin-users-history"><summary>{c.history}</summary>{user.history.length ? <ul>{user.history.map(h => <li key={h.id}><span>{h.action === 'suspend' ? c.suspend : h.action === 'unsuspend' ? c.release : c.expired}</span><time>{date(h.created_at)}</time>{h.details?.reason && <p>{h.details.reason}</p>}</li>)}</ul> : <p>{c.noHistory}</p>}</details>
    <BaseModal open={confirm !== null} onClose={() => { if (!busy) setConfirm(null) }} title={c.confirm} maxWidth="28rem" className="admin-users-confirm">
      <h2>{c.confirm}</h2><p><strong>{user.username || c.member}</strong> · {confirm?.suspended ? `${c.suspend} · ${daysLabel}` : c.release}</p>{confirm?.suspended && <p className="admin-users-reason">{confirm.reason}</p>}
      <div className="admin-users-confirm-actions"><button disabled={busy} onClick={() => setConfirm(null)}>{c.cancel}</button><button className={confirm?.suspended ? 'admin-users-danger' : 'admin-users-primary'} disabled={busy} onClick={save}>{busy ? c.saving : confirm?.suspended ? c.suspend : c.release}</button></div>
    </BaseModal>
  </>
}

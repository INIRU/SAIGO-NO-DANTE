'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { signIn, useSession } from 'next-auth/react'
import { ArrowLeft, LockKeyhole, MessageSquare, Plus, Send } from 'lucide-react'
import { Link } from '@/lib/i18n/navigation'
import { useHtmlFlag } from '@/hooks/useHtmlFlag'
import DanteLogo from '@/components/brand/DanteLogo'
import { isUnread, lastActivity, sortMessages, type Inquiry } from '@/lib/support'
import './support.css'
import { SupportRowsSkeleton } from './SupportSkeleton'
import { SkeletonPage } from '@/components/ui/Skeleton'
const CATEGORIES = ['bug', 'data', 'account', 'suggestion', 'other'] as const
const FILTERS = ['all', 'open', 'answered', 'closed'] as const
export default function SupportDesk({ admin = false, initialTopic }: { admin?: boolean; initialTopic?: 'api-limit' }) {
  const lang = useLocale()
  const t = useTranslations('supportDesk')
  const { status: sessionStatus } = useSession()
  useHtmlFlag('with-support-page', !admin)
  useHtmlFlag('with-compact-footer')
  const endpoint = admin ? '/api/admin/inquiries' : '/api/inquiries'
  const [items, setItems] = useState<Inquiry[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [creating, setCreating] = useState(!admin && initialTopic === 'api-limit')
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('all')
  const [search, setSearch] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const [title, setTitle] = useState(initialTopic === 'api-limit' ? t('apiLimitTitle') : '')
  const [content, setContent] = useState('')
  const [category, setCategory] = useState<string>(initialTopic === 'api-limit' ? 'other' : 'bug')
  const [draft, setDraft] = useState('')
  const messagesRef = useRef<HTMLOListElement>(null)
  const selected = items.find((i) => i.id === selectedId) ?? null
  const messages = selected ? sortMessages(selected.support_messages ?? []) : []

  const load = useCallback(async () => {
    setError('')
    try {
      const r = await fetch(endpoint, { cache: 'no-store' })
      if (!r.ok) throw Error()
      setItems(await r.json())
    } catch {
      setError(t('error'))
    } finally {
      setLoading(false)
    }
  }, [endpoint, t])
  useEffect(() => {
    if (admin || sessionStatus === 'authenticated') void load()
    else if (sessionStatus === 'unauthenticated') setLoading(false)
  }, [load, admin, sessionStatus])

  // The user GET marks the thread read; the navbar dot listens for this event.
  const openThread = useCallback(
    async (id: string) => {
      setSelectedId(id)
      setCreating(false)
      setError('')
      try {
        const r = await fetch(endpoint + '/' + id, { cache: 'no-store' })
        if (!r.ok) throw Error()
        const next: Inquiry = await r.json()
        setItems((list) => (list.some((i) => i.id === id) ? list.map((i) => (i.id === id ? next : i)) : [next, ...list]))
        if (!admin) window.dispatchEvent(new Event('support-read'))
      } catch {
        setError(t('error'))
      }
    },
    [admin, endpoint, t],
  )
  useEffect(() => {
    const pane = messagesRef.current
    if (pane) pane.scrollTop = pane.scrollHeight
  }, [selectedId, messages.length])

  async function send(url: string, method: 'POST' | 'PATCH', body: object) {
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const r = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      if (!r.ok) throw Error()
      return (await r.json()) as { id?: string }
    } catch {
      setError(t('error'))
      return null
    } finally {
      setBusy(false)
    }
  }
  async function create(e: React.FormEvent) {
    e.preventDefault()
    const res = await send(endpoint, 'POST', { title, content, category })
    if (!res?.id) return
    setTitle('')
    setContent('')
    await openThread(res.id)
    setNotice(t('sent'))
  }
  async function reply(e?: React.FormEvent) {
    e?.preventDefault()
    if (!selected || !draft.trim() || busy) return
    if (await send(endpoint + '/' + selected.id, 'POST', { body: draft })) {
      setDraft('')
      await openThread(selected.id)
    }
  }
  async function update(body: { closed?: boolean; contribution_accepted?: boolean }) {
    if (selected && (await send(endpoint + '/' + selected.id, 'PATCH', body))) await openThread(selected.id)
  }
  function startNew() {
    setCreating(true)
    setSelectedId(null)
    setError('')
    setNotice('')
  }
  const day = (v: string) => new Date(v).toLocaleDateString(lang, { month: 'short', day: 'numeric' })
  const stamp = (v: string) =>
    new Date(v).toLocaleString(lang, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  const chip = (i: Inquiry) => <span className={'desk-status ' + i.status}>{t(i.status)}</span>
  const home = !admin && (
    <Link href="/" className="desk-home">
      <DanteLogo size={26} />
      <span>{t('home')}</span>
    </Link>
  )

  if (!admin && sessionStatus === 'unauthenticated')
    return (
      <section className="support-desk is-page" data-support-page>
        <div className="desk-gate">
          {home}
          <MessageSquare size={32} aria-hidden="true" />
          <h1>{t('title')}</h1>
          <p>{t('loginHint')}</p>
          <button
            className="desk-button primary"
            onClick={() => signIn('google', { callbackUrl: '/' + lang + '/support' + (initialTopic === 'api-limit' ? '?topic=api-limit' : '') })}
          >
            {t('login')}
          </button>
          <p className="desk-privacy">
            <LockKeyhole size={14} aria-hidden="true" />
            {t('private')}
          </p>
        </div>
      </section>
    )

  const visible = items.filter(
    (i) => (filter === 'all' || i.status === filter) && i.title.toLowerCase().includes(search.trim().toLowerCase()),
  )
  return (
    <section className={'support-desk ' + (admin ? 'is-admin' : 'is-page')} data-support-page={admin ? undefined : ''}>
      <div className={'desk-workspace' + (selected || creating ? ' has-detail' : '')}>
        <aside className="desk-list" aria-label={admin ? t('inbox') : t('title')}>
          <header className="desk-list-head">
            {home}
            <div className="desk-list-title">
              <h1>{admin ? t('inbox') : t('title')}</h1>
              {!admin && (
                <button className="desk-button primary" onClick={startNew} aria-pressed={creating}>
                  <Plus size={16} aria-hidden="true" />
                  {t('new')}
                </button>
              )}
            </div>
            {admin && (
              <>
                <input
                  className="desk-search"
                  type="search"
                  aria-label={t('search')}
                  placeholder={t('search')}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                <div className="desk-filters">
                  {FILTERS.map((s) => (
                    <button key={s} aria-pressed={filter === s} onClick={() => setFilter(s)}>
                      {t(s)}
                      <span>{items.filter((i) => s === 'all' || i.status === s).length}</span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </header>
          <div className="desk-list-scroll">
            {loading ? (
              <SkeletonPage><SupportRowsSkeleton /></SkeletonPage>
            ) : visible.length === 0 ? (
              <p className="desk-empty">{t('empty')}</p>
            ) : (
              <ul>
                {visible.map((i) => {
                  const last = sortMessages(i.support_messages ?? []).at(-1)
                  const unread = !admin && isUnread(i)
                  return (
                    <li key={i.id}>
                      <button
                        className="desk-row"
                        aria-current={selectedId === i.id ? 'true' : undefined}
                        onClick={() => void openThread(i.id)}
                      >
                        <span className="desk-row-top">
                          <strong>{i.title}</strong>
                          {unread && <span className="desk-dot" role="img" aria-label={t('unread')} />}
                        </span>
                        {last && (
                          <span className="desk-row-preview">
                            {last.author_role === 'admin' && <b>{t('admin')}</b>}
                            {last.body}
                          </span>
                        )}
                        <span className="desk-row-meta">
                          {chip(i)}
                          <span>{t(i.category as (typeof CATEGORIES)[number])}</span>
                          <time dateTime={new Date(lastActivity(i)).toISOString()}>{day(new Date(lastActivity(i)).toISOString())}</time>
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
          {!admin && (
            <p className="desk-privacy">
              <LockKeyhole size={14} aria-hidden="true" />
              {t('private')}
            </p>
          )}
        </aside>

        <div className="desk-detail">
          {(error || notice) && (
            <div role={error ? 'alert' : 'status'} className={'desk-feedback' + (error ? ' error' : '')}>
              {error || notice}
              {error && !selected && !creating && <button onClick={() => void load()}>{t('retry')}</button>}
            </div>
          )}
          {creating ? (
            <form onSubmit={create} className="desk-form">
              <div className="desk-thread-head">
                <button type="button" className="desk-back" onClick={() => setCreating(false)}>
                  <ArrowLeft size={16} aria-hidden="true" />
                  {t('back')}
                </button>
                <h2>{t('new')}</h2>
              </div>
              <div className="desk-form-body">
                <fieldset>
                  <legend>{t('category')}</legend>
                  <div className="desk-choice">
                    {CATEGORIES.map((c) => (
                      <button type="button" key={c} aria-pressed={category === c} onClick={() => setCategory(c)}>
                        {t(c)}
                      </button>
                    ))}
                  </div>
                </fieldset>
                <label>
                  {t('subject')}
                  <input required maxLength={120} value={title} onChange={(e) => setTitle(e.target.value)} />
                </label>
                <label className="desk-grow">
                  {t('body')}
                  <textarea required maxLength={10000} value={content} onChange={(e) => setContent(e.target.value)} />
                </label>
              </div>
              <div className="desk-form-footer">
                <p className="desk-privacy">
                  <LockKeyhole size={14} aria-hidden="true" />
                  {t('private')}
                </p>
                <button type="button" className="desk-button" disabled={busy} onClick={() => setCreating(false)}>
                  {t('cancel')}
                </button>
                <button disabled={busy} className="desk-button primary">
                  <Send size={16} aria-hidden="true" />
                  {busy ? '…' : t('send')}
                </button>
              </div>
            </form>
          ) : selected ? (
            <article className="desk-thread">
              <header className="desk-thread-head">
                <button className="desk-back" onClick={() => setSelectedId(null)}>
                  <ArrowLeft size={16} aria-hidden="true" />
                  {t('back')}
                </button>
                <h2>{selected.title}</h2>
                <div className="desk-row-meta">
                  {chip(selected)}
                  <span>{t(selected.category as (typeof CATEGORIES)[number])}</span>
                  <time dateTime={selected.created_at}>{stamp(selected.created_at)}</time>
                </div>
                {admin && (
                  <div className="desk-thread-actions">
                    {selected.category === 'data' && (
                      <label>
                        <input
                          type="checkbox"
                          role="switch"
                          className="desk-switch"
                          checked={selected.contribution_accepted}
                          disabled={busy || !selected.reply.trim()}
                          onChange={(e) => void update({ contribution_accepted: e.target.checked })}
                        />
                        {t('approveContribution')}
                      </label>
                    )}
                    <button className="desk-button" disabled={busy} onClick={() => void update({ closed: selected.status !== 'closed' })}>
                      {selected.status === 'closed' ? t('reopen') : t('close')}
                    </button>
                  </div>
                )}
              </header>
              <ol className="desk-messages" ref={messagesRef}>
                {messages.map((m, n) => {
                  const mine = admin ? m.author_role === 'admin' : m.author_role === 'user'
                  return (
                    <li key={m.id ?? n} className={'desk-msg ' + (mine ? 'mine' : 'theirs')}>
                      <span className="desk-msg-author">
                        {m.author_role === 'admin' ? t('admin') : admin ? t('author') : t('me')}
                      </span>
                      <p>{m.body}</p>
                      <time dateTime={m.created_at}>{stamp(m.created_at)}</time>
                    </li>
                  )
                })}
                {!admin && selected.contribution_accepted && <li className="desk-note">{t('contributionApproved')}</li>}
              </ol>
              {selected.status === 'closed' ? (
                <div className="desk-closed">
                  <p>{admin ? t('adminClosedNote') : t('closedNote')}</p>
                  {!admin && (
                    <button className="desk-button" onClick={startNew}>
                      <Plus size={16} aria-hidden="true" />
                      {t('new')}
                    </button>
                  )}
                </div>
              ) : (
                <form className="desk-composer" onSubmit={reply}>
                  <textarea
                    aria-label={admin ? t('adminReply') : t('reply')}
                    placeholder={admin ? t('adminReply') : t('reply')}
                    maxLength={10000}
                    rows={3}
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) void reply()
                    }}
                  />
                  <div>
                    <span>{t('sendHint')}</span>
                    <button disabled={busy || !draft.trim()} className="desk-button primary">
                      <Send size={16} aria-hidden="true" />
                      {busy ? '…' : t('send')}
                    </button>
                  </div>
                </form>
              )}
            </article>
          ) : (
            <div className="desk-empty">
              <MessageSquare size={32} aria-hidden="true" />
              <p>{t('select')}</p>
              {!admin && (
                <button className="desk-button primary" onClick={startNew}>
                  <Plus size={16} aria-hidden="true" />
                  {t('new')}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

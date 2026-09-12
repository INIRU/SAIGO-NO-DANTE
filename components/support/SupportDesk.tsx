'use client'
import { useCallback, useEffect, useState } from 'react'
import { useLocale } from 'next-intl'
import { signIn, useSession } from 'next-auth/react'
import { ArrowLeft, MessageSquare, Plus, Send, LockKeyhole } from 'lucide-react'
import { supportCopy, type Inquiry } from '@/lib/support'
import './support.css'
export default function SupportDesk({ admin = false, initialTopic }: { admin?: boolean; initialTopic?: 'api-limit' }) {
  const lang = useLocale()
  const t = supportCopy[lang === 'en' || lang === 'ja' ? lang : 'ko']
  const { status: sessionStatus } = useSession()
  const [items, setItems] = useState<Inquiry[]>([]),
    [selected, setSelected] = useState<Inquiry | null>(null),
    [creating, setCreating] = useState(!admin && initialTopic === 'api-limit'),
    [filter, setFilter] = useState('all'),
    [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true),
    [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [busy, setBusy] = useState(false)
  const [title, setTitle] = useState(initialTopic === 'api-limit' ? (lang === 'ko' ? 'API 추가 한도 요청' : lang === 'ja' ? 'API制限の引き上げ依頼' : 'API limit increase request') : ''),
    [content, setContent] = useState(''),
    [category, setCategory] = useState(initialTopic === 'api-limit' ? 'other' : 'bug'),
    [reply, setReply] = useState(''),
    [state, setState] = useState<Inquiry['status']>('open')
  const [accepted, setAccepted] = useState(false)
  const endpoint = admin ? '/api/admin/inquiries' : '/api/inquiries'
  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const r = await fetch(endpoint)
      if (!r.ok) throw Error()
      setItems(await r.json())
    } catch {
      setError(t.error)
    } finally {
      setLoading(false)
    }
  }, [endpoint, t.error])
  useEffect(() => {
    if (admin || sessionStatus === 'authenticated') void load()
    else if (sessionStatus === 'unauthenticated') setLoading(false)
  }, [load, admin, sessionStatus])
  function choose(item: Inquiry) {
    setSelected(item)
    setCreating(false)
    setReply(item.reply)
    setState(item.status)
    setAccepted(item.contribution_accepted)
    setNotice('')
    setError('')
  }
  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const r = await fetch(
        admin ? `/api/admin/inquiries/${selected!.id}` : endpoint,
        {
          method: admin ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(
            admin ? { reply, status: state, contribution_accepted: accepted } : { title, content, category },
          ),
        },
      )
      if (!r.ok) throw Error()
      if (admin && selected) setSelected({ ...selected, reply, status: state, contribution_accepted: accepted })
      else {
        setCreating(false)
        setTitle('')
        setContent('')
      }
      setNotice(t.success)
      await load()
    } catch {
      setError(t.error)
    } finally {
      setBusy(false)
    }
  }
  const label = (key: string) => t[key as keyof typeof t] ?? key
  const visible = items.filter(
    (i) =>
      (filter === 'all' || i.status === filter) &&
      `${i.title} ${i.content}`.toLowerCase().includes(search.toLowerCase()),
  )
  return (
    <section className="support-desk">
      <header className="desk-heading">
        <div>
          <span className="desk-eyebrow">
            {admin ? 'SUPPORT DESK' : 'CONTACT'}
          </span>
          <h1>{admin ? t.all : t.title}</h1>
          <p>{t.intro}</p>
        </div>
        {!admin && sessionStatus === 'authenticated' && (
          <button
            className="desk-button primary"
            onClick={() => {
              setCreating(true)
              setSelected(null)
              setError('')
              setNotice('')
            }}
          >
            <Plus size={16} />
            {t.new}
          </button>
        )}
      </header>
      {!admin && (
        <p className="desk-privacy">
          <LockKeyhole size={14} />
          {t.private}
        </p>
      )}
      {!admin && sessionStatus === 'unauthenticated' ? (
        <div className="desk-empty">
          <MessageSquare />
          <h2>{t.login}</h2>
          <button
            className="desk-button primary"
            onClick={() => signIn('google', { callbackUrl: `/${lang}/support${initialTopic === 'api-limit' ? '?topic=api-limit' : ''}` })}
          >
            {t.login}
          </button>
        </div>
      ) : (
        <>
          {error && (
            <div role="alert" className="desk-feedback error">
              {error}
              <button onClick={load}>{t.retry}</button>
            </div>
          )}
          {notice && (
            <p role="status" className="desk-feedback">
              {notice}
            </p>
          )}
          <div
            className={`desk-workspace ${selected || creating ? 'has-detail' : ''}`}
          >
            <aside className="desk-list">
              <div className="desk-list-tools">
                <input
                  aria-label={lang === 'ko' ? '문의 검색' : t.subject}
                  placeholder={lang === 'ko' ? '제목, 내용 검색…' : t.subject}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                <div className="desk-filters">
                  {['all', 'open', 'answered', 'closed'].map((s) => (
                    <button
                      key={s}
                      aria-pressed={filter === s}
                      onClick={() => setFilter(s)}
                    >
                      {s === 'all'
                        ? lang === 'ko'
                          ? '전체'
                          : lang === 'ja'
                            ? 'すべて'
                            : 'All'
                        : label(s)}
                      <span>
                        {
                          items.filter((i) => s === 'all' || i.status === s)
                            .length
                        }
                      </span>
                    </button>
                  ))}
                </div>
              </div>
              {loading ? (
                <p className="desk-empty">…</p>
              ) : visible.length === 0 ? (
                <p className="desk-empty">{t.empty}</p>
              ) : (
                visible.map((i) => (
                  <button
                    key={i.id}
                    className={`desk-row ${selected?.id === i.id ? 'active' : ''}`}
                    onClick={() => choose(i)}
                  >
                    <span className="desk-row-meta">
                      <span className={`desk-status ${i.status}`}>
                        {label(i.status)}
                      </span>
                      <time>
                        {new Date(i.created_at).toLocaleDateString(lang)}
                      </time>
                    </span>
                    <strong>{i.title}</strong>
                    <span>{label(i.category)}</span>
                  </button>
                ))
              )}
            </aside>
            <div className="desk-detail">
              {(selected || creating) && (
                <button
                  className="desk-back"
                  onClick={() => {
                    setSelected(null)
                    setCreating(false)
                  }}
                >
                  <ArrowLeft size={16} />
                  {t.back}
                </button>
              )}
              {creating ? (
                <form onSubmit={submit} className="desk-form">
                  <h2>{t.new}</h2>
                  <fieldset>
                    <legend>{t.category}</legend>
                    <div className="desk-choice">
                      {['bug', 'data', 'account', 'suggestion', 'other'].map(c => (
                        <button type="button" key={c} aria-pressed={category === c} className="desk-button" onClick={() => setCategory(c)}>{label(c)}</button>
                      ))}
                    </div>
                  </fieldset>
                  <label>
                    {t.subject}
                    <input
                      required
                      maxLength={120}
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                    />
                  </label>
                  <label>
                    {t.body}
                    <textarea
                      required
                      maxLength={10000}
                      rows={7}
                      value={content}
                      onChange={(e) => setContent(e.target.value)}
                    />
                  </label>
                  <div className="desk-form-footer">
                    <p className="desk-privacy"><LockKeyhole size={14} />{t.private}</p>
                    <button type="button" className="desk-button" disabled={busy} onClick={() => setCreating(false)}>{lang === 'ko' ? '취소' : lang === 'ja' ? 'キャンセル' : 'Cancel'}</button>
                    <button disabled={busy} className="desk-button primary"><Send size={16} />{busy ? '…' : t.send}</button>
                  </div>
                </form>
              ) : selected ? (
                <article>
                  <div className="desk-row-meta">
                    <span className={`desk-status ${selected.status}`}>
                      {label(selected.status)}
                    </span>
                    <time>
                      {new Date(selected.created_at).toLocaleString(lang)}
                    </time>
                  </div>
                  <h2>{selected.title}</h2>
                  <p className="desk-message">{selected.content}</p>
                  <section className="desk-reply">
                    <h3>
                      <MessageSquare size={18} />
                      {t.reply}
                    </h3>
                    {admin ? (
                      <form onSubmit={submit} className="desk-form">
                        <label>
                          {t.reply}
                          <textarea
                            rows={8}
                            maxLength={10000}
                            value={reply}
                            onChange={(e) => setReply(e.target.value)}
                          />
                        </label>
                        {selected.category === 'data' && <label style={{display:'flex',alignItems:'center',gap:'.75rem'}}>
                          <input type="checkbox" role="switch" className="desk-switch" checked={accepted} onChange={e => setAccepted(e.target.checked)} />
                          {t.approveContribution}
                        </label>}
                        <div className="desk-actions">
                          <fieldset>
                            <legend>{t.status}</legend>
                            <div className="desk-choice">{(['open', 'answered', 'closed'] as const).map(s => <button type="button" key={s} aria-pressed={state === s} onClick={() => setState(s)} className="desk-button">{label(s)}</button>)}</div>
                          </fieldset>
                          <button
                            disabled={
                              busy || (state === 'answered' && !reply.trim()) || (accepted && (state === 'open' || !reply.trim()))
                            }
                            className="desk-button primary"
                          >
                            {busy ? '…' : t.save}
                          </button>
                        </div>
                      </form>
                    ) : (
                      <>
                        {selected.contribution_accepted && <p className="desk-status answered">{t.contributionApproved}</p>}
                        <p className="desk-message">
                          {selected.reply || t.pending}
                        </p>
                        {selected.replied_at && (
                          <time>
                            {new Date(selected.replied_at).toLocaleString(lang)}
                          </time>
                        )}
                      </>
                    )}
                  </section>
                </article>
              ) : (
                <div className="desk-empty">
                  <MessageSquare size={32} />
                  <p>{t.select}</p>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </section>
  )
}

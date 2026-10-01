'use client'
import { useEffect, useRef, useState } from 'react'
import { Loader2, Pin, ArrowLeft, Megaphone } from 'lucide-react'
import { useReducedMotion } from 'motion/react'
import * as m from 'motion/react-m'
import { useLocale } from 'next-intl'
import AnnouncementBody from '@/components/announcements/AnnouncementBody'
import type { RichNode } from '@/lib/announcements'
interface Announcement { content_doc?: RichNode | null; id: string; title: string; content: string; pinned: boolean; created_at: string }
export default function AnnouncementsClient({ initialItems = null }: { initialItems?: Announcement[] | null }) {
  const locale = useLocale(), reduced = useReducedMotion()
  const label = (ko:string, ja:string, en:string) => locale === 'ko' ? ko : locale === 'ja' ? ja : en
  const [items,setItems] = useState<Announcement[]>(initialItems ?? [])
  const [loading,setLoading] = useState(initialItems === null), [error,setError] = useState(false)
  const [selected,setSelected] = useState<string | null>(null)
  const article = useRef<HTMLElement>(null)
  function load() {
    setLoading(true); setError(false)
    fetch(`/api/announcements?lang=${encodeURIComponent(locale)}`).then(r => {if (!r.ok) throw Error(); return r.json()}).then(r => setItems(r.data ?? [])).catch(() => setError(true)).finally(() => setLoading(false))
  }
  // The server passes the list; only a page rendered without it loads it here.
  useEffect(() => { if (initialItems === null) load() }, [locale, initialItems])
  if (loading) return <p role="status" className="flex items-center gap-2 py-8 text-sm text-[var(--text-muted)]"><Loader2 size={16} className="animate-spin motion-reduce:animate-none" />{label('불러오는 중…','読み込み中…','Loading…')}</p>
  if (error) return <div role="alert" className="py-8 text-sm"><p>{label('공지를 불러오지 못했습니다.','お知らせを読み込めません。','Could not load announcements.')}</p><button className="mt-3 min-h-11 text-[var(--gold)]" onClick={load}>{label('다시 시도','再試行','Retry')}</button></div>
  if (!items.length) return <div className="flex flex-col items-center gap-4 py-16 text-[var(--text-muted)]"><Megaphone size={28} /><p>{label('등록된 공지가 없습니다.','お知らせはありません。','No announcements yet.')}</p></div>
  const current = items.find(i => i.id === selected)
  return <div className="grid items-start gap-8 md:grid-cols-[18rem_minmax(0,1fr)]">
    <nav aria-label={label('공지 목록','お知らせ一覧','Announcements')} className={`space-y-2 ${current ? 'hidden md:block' : ''}`}>
      {items.map(item => <button key={item.id} aria-current={current?.id === item.id ? 'true' : undefined} onClick={() => {setSelected(item.id);requestAnimationFrame(()=>article.current?.focus())}} className={`flex w-full items-start gap-3 rounded-md p-4 text-left transition-colors hover:bg-white/[0.03] focus-visible:outline-2 focus-visible:outline-[var(--gold)] ${current?.id === item.id ? 'bg-[var(--gold)]/10' : ''}`}>
        {item.pinned && <Pin size={16} className="mt-1 shrink-0 text-[var(--gold)]" aria-label={label('고정 공지','固定','Pinned')} />}
        <span className="min-w-0"><span className="block break-words font-[family-name:var(--font-paperlogy)] text-sm font-bold leading-relaxed text-[var(--text-primary)]">{item.title}</span><time className="mt-1 block text-xs text-[var(--text-muted)]">{item.created_at.slice(0,10).replaceAll('-','.')}</time></span>
      </button>)}
    </nav>
    {current ? <m.article key={current.id} ref={article} tabIndex={-1} initial={reduced ? false : {opacity:0,y:5}} animate={{opacity:1,y:0}} transition={{duration:.2}} className="min-w-0 outline-none">
      <p className="mb-2 text-xs text-[var(--gold)]">{label('공지','お知らせ','Notice')}</p>
      <h2 className="break-words font-[family-name:var(--font-paperlogy)] text-xl font-bold leading-snug tracking-[-0.02em]">{current.title}</h2>
      <time className="mt-3 block text-xs text-[var(--text-muted)]">{current.created_at.slice(0,10).replaceAll('-','.')}</time>
      <div className="my-8 text-sm leading-8 text-[var(--text-secondary)]"><AnnouncementBody doc={current.content_doc} text={current.content} /></div>
      <button className="inline-flex min-h-11 items-center gap-2 rounded-md bg-white/[0.04] px-4 text-sm focus-visible:outline-2 focus-visible:outline-[var(--gold)]" onClick={()=>{setSelected(null);requestAnimationFrame(()=>document.querySelector<HTMLButtonElement>('[data-announcements] nav button')?.focus())}}><ArrowLeft size={16}/>{label('목록으로','一覧へ','Back to list')}</button>
    </m.article> : <div className="hidden rounded-lg bg-[var(--bg-panel)] px-8 py-14 text-center text-sm text-[var(--text-muted)] md:block">{label('읽을 공지를 선택해주세요.','お知らせを選択してください。','Select an announcement to read.')}</div>}
  </div>
}

'use client'
import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { useLocale } from 'next-intl'
import { ChevronDown, Link as LinkIcon } from 'lucide-react'
import { showError, showSuccess } from '@/lib/toast'
import { NOTE_TOC_MIN, activeHeading, type NoteHeading } from '@/lib/notes/toc'

const tr = (lang: string, ko: string, ja: string, en: string) => lang === 'ja' ? ja : lang === 'en' ? en : ko
/** The reader's line near the top of the screen (below the sticky navigation) that decides which heading is being read. */
const READING_LINE = 120

/** A button after a heading that copies the page address with the heading's id. */
export function NoteHeadingLink({ id, text }: { id: string; text: string }) {
  const lang = useLocale()
  const copy = async () => {
    const url = new URL(window.location.href)
    url.hash = id
    try {
      await navigator.clipboard.writeText(url.href)
      showSuccess(tr(lang, '제목 링크를 복사했어요', '見出しのリンクをコピーしました', 'Heading link copied'))
    } catch {
      showError(tr(lang, '링크를 복사하지 못했어요', 'リンクをコピーできませんでした', 'Could not copy the link'))
    }
  }
  return <button type="button" className="note-heading-link" aria-label={`${tr(lang, '링크 복사', 'リンクをコピー', 'Copy link')}: ${text}`} onClick={() => { void copy() }}><LinkIcon size={14} aria-hidden="true" /></button>
}

/**
 * The note with its table of contents: a sticky rail beside it where the container is wide (the active heading gets a gold
 * tick), a collapsible "목차" bar above it where it is narrow. Fewer than NOTE_TOC_MIN headings: the note alone.
 */
export default function NoteTocLayout({ headings, children }: { headings: NoteHeading[]; children: ReactNode }) {
  const lang = useLocale(), listId = useId()
  const [open, setOpen] = useState(false), [active, setActive] = useState<string | null>(headings[0]?.id ?? null)
  const ids = headings.map(heading => heading.id).join('\n')
  const shown = headings.length >= NOTE_TOC_MIN
  const frame = useRef<number | null>(null)
  useEffect(() => {
    if (!shown) return
    const update = () => {
      frame.current = null
      const positions = ids.split('\n').flatMap(id => { const el = document.getElementById(id); return el ? [{ id, top: el.getBoundingClientRect().top }] : [] })
      setActive(activeHeading(positions, READING_LINE))
    }
    const schedule = () => { if (frame.current === null) frame.current = requestAnimationFrame(update) }
    update()
    window.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', schedule)
    return () => { window.removeEventListener('scroll', schedule); window.removeEventListener('resize', schedule); if (frame.current !== null) cancelAnimationFrame(frame.current) }
  }, [ids, shown])
  if (!shown) return <>{children}</>
  const title = tr(lang, '목차', '目次', 'Contents')
  return <div className="note-toc-frame"><div className="note-toc-layout">
    <aside className="note-toc" data-open={open || undefined}>
      <button type="button" className="note-toc-toggle" aria-expanded={open} aria-controls={listId} onClick={() => setOpen(!open)}>{title}<ChevronDown size={16} aria-hidden="true" /></button>
      <nav id={listId} aria-label={title}>
        <ol>{headings.map(heading => <li key={heading.id} data-level={heading.level}>
          <a href={`#${heading.id}`} aria-current={heading.id === active ? 'location' : undefined} onClick={() => setOpen(false)}>{heading.text}</a>
        </li>)}</ol>
      </nav>
    </aside>
    <div className="note-toc-body">{children}</div>
  </div></div>
}

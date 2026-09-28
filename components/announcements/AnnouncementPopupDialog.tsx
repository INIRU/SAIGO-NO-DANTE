'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { X } from 'lucide-react'
import BaseModal from '@/components/ui/BaseModal'
import AnnouncementBody from './AnnouncementBody'
import type { RichNode } from '@/lib/announcements'

/** localStorage key holding the id of the last popup announcement the visitor closed. */
export const POPUP_SEEN_KEY = 'announcement-popup-seen'

const COPY = {
  ko: { close: '닫기', all: '공지 전체 보기', label: '공지' },
  en: { close: 'Close', all: 'All announcements', label: 'Announcement' },
  ja: { close: '閉じる', all: 'お知らせ一覧', label: 'お知らせ' },
} as const

/** Opens once per announcement: closing it stores its id, so the next popup announcement opens again. */
export default function AnnouncementPopupDialog({ lang, announcement }: {
  lang: 'ko' | 'en' | 'ja'
  announcement: { id: string; title: string; content: string; content_doc: RichNode | null }
}) {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const copy = COPY[lang]
  useEffect(() => {
    // Admin and maintenance screens are work surfaces, not visits.
    if (/\/(admin|maintenance)(\/|$)/.test(pathname ?? '')) return
    try {
      if (localStorage.getItem(POPUP_SEEN_KEY) !== announcement.id) setOpen(true)
    } catch {
      // Storage blocked: better not to show it on every page.
    }
  }, [announcement.id, pathname])
  const close = () => {
    setOpen(false)
    try { localStorage.setItem(POPUP_SEEN_KEY, announcement.id) } catch {}
  }
  return (
    <BaseModal open={open} onClose={close} title={announcement.title} maxWidth="32rem" initialFocus="dialog" sheet>
      <section data-announcement-popup={announcement.id} className="relative flex max-h-[min(40rem,85dvh)] flex-col overflow-hidden rounded-xl border border-[rgba(200,144,10,0.28)] bg-[#17120c] shadow-[0_1.5rem_3rem_rgba(0,0,0,0.55)]">
        <span aria-hidden="true" className="absolute inset-x-0 top-0 h-[3px] bg-[var(--gold)]" />
        <header className="flex items-start gap-3 px-6 pb-3 pt-6">
          <div className="min-w-0 flex-1">
            <p className="text-[0.75rem] font-semibold uppercase tracking-[0.08em] text-[var(--gold)]">{copy.label}</p>
            <h2 className="mt-1 text-[1.25rem] font-bold leading-snug text-[#f0e6d2]">{announcement.title}</h2>
          </div>
          <button type="button" onClick={close} aria-label={copy.close}
            className="-mr-2 -mt-1 grid h-10 w-10 shrink-0 place-items-center rounded-md text-[#8a7d69] transition-colors hover:bg-white/5 hover:text-[#e8dcc8] focus-visible:outline-2 focus-visible:outline-[var(--gold)]">
            <X size={18} aria-hidden="true" />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 text-[0.9375rem] leading-relaxed text-[#d8ccb8]">
          <AnnouncementBody doc={announcement.content_doc} text={announcement.content} />
        </div>
        <footer className="flex gap-2 border-t border-[#2e2417] px-6 py-4">
          <Link href={`/${lang}/announcements`} onClick={close}
            className="flex min-h-11 flex-1 items-center justify-center rounded-lg border border-[var(--border-gold)] text-[0.9375rem] font-semibold text-[var(--gold-light)] transition-colors hover:bg-white/5 focus-visible:outline-2 focus-visible:outline-[var(--gold-light)]">
            {copy.all}
          </Link>
          <button type="button" onClick={close}
            className="min-h-11 flex-1 rounded-lg bg-[var(--gold)] text-[0.9375rem] font-bold text-[#0d0b08] transition-[filter] hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--gold-light)]">
            {copy.close}
          </button>
        </footer>
      </section>
    </BaseModal>
  )
}

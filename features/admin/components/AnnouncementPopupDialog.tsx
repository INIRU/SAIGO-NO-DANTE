'use client'
import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { ArrowRight, X } from 'lucide-react'
import { Link } from '@/lib/i18n/navigation'
import BaseModal from '@/components/ui/BaseModal'
import Button, { buttonClass } from '@/components/ui/Button'
import QuietImage from '@/components/ui/QuietImage'
import { announcementDate, type AnnouncementPreview } from '@/lib/announcements'

/** localStorage key holding the id of the last popup announcement the visitor closed. */
const POPUP_SEEN_KEY = 'announcement-popup-seen'

/** Opens once per announcement: closing it either way stores its id, so the next popup announcement opens again. */
export default function AnnouncementPopupDialog({ announcement }: { announcement: AnnouncementPreview }) {
  const t = useTranslations('announcements')
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  useEffect(() => {
    // Admin and maintenance screens are work surfaces, not visits; the announcement's own page needs no teaser.
    if (/\/(admin|maintenance)(\/|$)/.test(pathname ?? '') || pathname?.endsWith(`/announcements/${announcement.id}`)) return
    try {
      if (localStorage.getItem(POPUP_SEEN_KEY) !== announcement.id) setOpen(true)
    } catch {
      // Storage blocked: better not to show it on every page.
    }
  }, [announcement.id, pathname])
  const close = () => {
    setOpen(false)
    try { localStorage.setItem(POPUP_SEEN_KEY, announcement.id) } catch { /* Storage blocked: it may open again on the next page. */ }
  }
  return (
    // A story chapter's map covers the page at z-60: below it the popup was hidden yet still took every click and scroll
    <BaseModal open={open} onClose={close} title={announcement.title} maxWidth="30rem" initialFocus="dialog" sheet
      zIndex={/\/story\/[^/]+/.test(pathname ?? '') ? 70 : undefined}>
      <section data-announcement-popup={announcement.id}
        className="relative flex max-h-[min(44rem,90dvh)] flex-col overflow-hidden rounded-t-2xl border border-b-0 border-[var(--border)] bg-[var(--bg-card)] shadow-[0_1.5rem_3rem_rgba(0,0,0,0.55)] sm:rounded-2xl sm:border-b">
        {announcement.cover && (
          <div className="relative aspect-[16/9] shrink-0 overflow-hidden bg-[var(--bg-deep)] empty:hidden after:pointer-events-none after:absolute after:inset-x-0 after:bottom-0 after:h-16 after:bg-gradient-to-t after:from-[var(--bg-card)] after:to-transparent">
            {/* The largest picture of the page while the popup is open: fetched at once, ahead of the page's images. */}
            <QuietImage src={announcement.cover} alt="" fill sizes="30rem" loading="eager" fetchPriority="high" className="object-cover" />
          </div>
        )}
        <Button variant="ghost" icon={X} aria-label={t('close')} onClick={close}
          className={`absolute right-2 top-2 z-[1] ${announcement.cover ? 'bg-black/45 text-white backdrop-blur-sm hover:bg-black/60 hover:text-white' : ''}`} />
        <div className={`min-h-0 flex-1 overflow-y-auto px-6 ${announcement.cover ? 'pt-1' : 'pt-6'}`}>
          <time dateTime={announcement.created_at} className="font-[family-name:var(--font-title)] text-[1rem] tracking-[0.04em] text-[var(--text-tertiary)]">{announcementDate(announcement.created_at)}</time>
          <h2 className="mt-2 pr-8 text-balance break-keep font-[family-name:var(--font-heading)] text-[1.375rem] leading-snug tracking-[-0.02em] text-[var(--text-primary)]">{announcement.title}</h2>
          {announcement.excerpt && <p className="mt-3 text-[0.9375rem] leading-7 text-[var(--text-secondary)]">{announcement.excerpt}</p>}
        </div>
        <footer className="flex gap-2 px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-6">
          <Button variant="secondary" className="flex-1" onClick={close}>{t('close')}</Button>
          <Link href={`/announcements/${announcement.id}`} onClick={close} className={`${buttonClass({ variant: 'primary' })} flex-1`}>
            {t('readMore')}<ArrowRight size={16} aria-hidden="true" />
          </Link>
        </footer>
      </section>
    </BaseModal>
  )
}

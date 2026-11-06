'use client'
import { useState } from 'react'
import { Link } from '@/lib/i18n/navigation'
import { ArrowRight, ArrowUpRight, ChevronDown, Megaphone } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { announcementDate, type AnnouncementPreview } from '@/lib/announcements'
import { buttonClass } from '@/components/ui/Button'
import QuietImage from '@/components/ui/QuietImage'
import './announcement-banner.css'

/** The pinned announcement as one line; unfolding shows its teaser and a link to its page, never the whole body. */
export default function AnnouncementBanner({ announcement }: { announcement: AnnouncementPreview }) {
  const t = useTranslations('announcements')
  const common = useTranslations('common')
  const [open, setOpen] = useState(false)
  return (
    <section className="home-announcement" aria-label={t('title')} data-open={open || undefined}>
      <div className="home-announcement-inner">
        <div className="home-announcement-summary">
          <Megaphone className="home-announcement-symbol" size={18} aria-hidden="true" />
          <button type="button" className="home-announcement-toggle" onClick={() => setOpen(!open)} aria-expanded={open} aria-controls="home-announcement-body">
            <strong>{announcement.title}</strong>
            <ChevronDown className="home-announcement-chevron" size={18} aria-hidden="true" />
          </button>
          <Link href="/announcements" className="home-announcement-all hit-target">{common('viewAll')}<ArrowUpRight size={16} aria-hidden="true" /></Link>
        </div>
        <div id="home-announcement-body" className="home-announcement-fold" inert={!open}>
          <div className="home-announcement-clip">
            <div className="home-announcement-preview" data-cover={announcement.cover ? true : undefined}>
              {announcement.cover && <div className="home-announcement-cover"><QuietImage src={announcement.cover} alt="" fill sizes="(min-width: 601px) 15rem, 100vw" className="object-cover" /></div>}
              <div className="min-w-0">
                <time dateTime={announcement.created_at} className="home-announcement-date">{announcementDate(announcement.created_at)}</time>
                {announcement.excerpt && <p className="home-announcement-excerpt">{announcement.excerpt}</p>}
                <Link href={`/announcements/${announcement.id}`} className={`${buttonClass({ variant: 'outline', size: 'sm' })} mt-4`}>
                  {t('readMore')}<ArrowRight size={15} aria-hidden="true" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

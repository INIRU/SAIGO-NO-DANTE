'use client'

import { useState } from 'react'
import { Link } from '@/lib/i18n/navigation'
import { ArrowUpRight, ChevronDown, Megaphone } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import AnnouncementBody from '@/components/announcements/AnnouncementBody'
import { type RichNode } from '@/lib/announcements'
import './announcement-banner.css'

export type AnnouncementData = {
  id: string
  title: string
  content: string
  content_doc?: RichNode | null
  pinned: boolean
  created_at: string
}

export default function AnnouncementBanner({ announcement }: { announcement: AnnouncementData }) {
  const t = useTranslations('common')
  const locale = useLocale()
  const [open, setOpen] = useState(false)
  const label = locale === 'ko' ? '공지사항' : locale === 'ja' ? 'お知らせ' : 'Announcements'
  return (
    <section className="home-announcement" aria-label={label}>
      <div className="home-announcement-inner">
        <div className="home-announcement-summary">
          <Megaphone className="home-announcement-symbol" size={18} />
          <button className="home-announcement-toggle" onClick={() => setOpen(!open)} aria-expanded={open} aria-controls="home-announcement-body">
            <span className="home-announcement-meta"><span>{label}</span></span>
            <strong>{announcement.title}</strong>
          </button>
          <button className="home-announcement-expand" onClick={() => setOpen(!open)} aria-label={announcement.title} aria-expanded={open}><ChevronDown size={18} style={{ transform: open ? 'rotate(180deg)' : undefined }} /></button>
          <Link href="/announcements" className="home-announcement-all">{t('viewAll')}<ArrowUpRight size={16} /></Link>
        </div>
        {open && <div id="home-announcement-body" className="home-announcement-body"><AnnouncementBody doc={announcement.content_doc} text={announcement.content} /></div>}
      </div>
    </section>
  )
}

import { cacheLife, cacheTag } from 'next/cache'
import { CACHE_TAGS } from '@/lib/constants/cache-tags'
import { getPopupAnnouncementForLang } from '@/lib/db/announcements'
import AnnouncementPopupDialog from './AnnouncementPopupDialog'

/** The language's latest popup announcement; the dialog opens it once per visitor. */
export default async function AnnouncementPopup({ lang }: { lang: 'ko' | 'en' | 'ja' }) {
  'use cache'
  cacheLife('max')
  cacheTag(CACHE_TAGS.announcements)
  const item = await getPopupAnnouncementForLang(lang).catch(() => null)
  return item ? <AnnouncementPopupDialog lang={lang} announcement={{ id: item.id, title: item.title, content: item.content, content_doc: item.content_doc ?? null }} /> : null
}

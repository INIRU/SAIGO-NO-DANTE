import { cacheLife, cacheTag } from 'next/cache'
import { CACHE_TAGS } from '@/lib/constants/cache-tags'
import { announcementPreview } from '@/lib/announcements'
import { getPopupAnnouncementForLang } from '@/lib/db/announcements'
import AnnouncementPopupDialog from './AnnouncementPopupDialog'

/** The language's latest popup announcement as a teaser (every page carries it); the dialog opens it once per visitor. */
export default async function AnnouncementPopup({ lang }: { lang: 'ko' | 'en' | 'ja' }) {
  'use cache'
  cacheLife('max')
  cacheTag(CACHE_TAGS.announcements)
  const item = await getPopupAnnouncementForLang(lang).catch(() => null)
  return item ? <AnnouncementPopupDialog announcement={announcementPreview(item, 160)} /> : null
}

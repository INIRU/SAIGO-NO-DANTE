import { cacheLife, cacheTag } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { CACHE_TAGS } from '@/lib/constants/cache-tags'
import type { Announcement } from '@/lib/announcements'
type AnnouncementRow = Announcement
export async function getAnnouncementsForLang(
  langInput?: string | null,
): Promise<AnnouncementRow[]> {
  const lang = langInput === 'en' || langInput === 'ja' ? langInput : 'ko'
  const { data, error } = await createAdminClient()
    .schema('limbus')
    .from('announcements')
    .select('*')
    .eq('lang', lang)
    .eq('published', true)
    .order('pinned', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(100)
  if (error) throw error
  return (data ?? []) as AnnouncementRow[]
}
/** The public list (pinned first, newest first), cached until an announcement is saved. A failed read is not cached. */
export async function getCachedAnnouncements(lang: 'ko' | 'en' | 'ja'): Promise<AnnouncementRow[]> {
  'use cache'
  cacheLife('max')
  cacheTag(CACHE_TAGS.announcements)
  return getAnnouncementsForLang(lang)
}
export async function getPinnedAnnouncementForLang(
  lang?: string | null,
): Promise<AnnouncementRow | null> {
  return (await getAnnouncementsForLang(lang))[0] ?? null
}
/** The latest published announcement marked as a popup for that language, or null. */
export async function getPopupAnnouncementForLang(lang: 'ko' | 'en' | 'ja'): Promise<AnnouncementRow | null> {
  const { data, error } = await createAdminClient()
    .schema('limbus')
    .from('announcements')
    .select('id, title, content, content_doc, pinned, popup, published, lang, created_at, updated_at')
    .eq('lang', lang)
    .eq('published', true)
    .eq('popup', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw error
  return data as AnnouncementRow | null
}

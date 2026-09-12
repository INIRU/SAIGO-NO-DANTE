import { createAdminClient } from '@/lib/supabase/admin'
import type { Announcement } from '@/lib/announcements'
export type AnnouncementRow = Announcement
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
  return data ?? []
}
export async function getPinnedAnnouncementForLang(
  lang?: string | null,
): Promise<AnnouncementRow | null> {
  return (await getAnnouncementsForLang(lang))[0] ?? null
}

import { createAdminClient } from '@/lib/supabase/admin'
import type { SupportedLang } from '@/lib/i18n/types'

export type AnnouncementRow = {
  id: string
  title: string
  content: string
  pinned: boolean
  created_at: string
  updated_at?: string | null
  lang?: SupportedLang | null
}

const ANNOUNCEMENT_SELECT = '*'
const LEGACY_ANNOUNCEMENT_SELECT = 'id, title, content, pinned, created_at, updated_at'

function normalizeAnnouncementLang(lang: string | null | undefined): SupportedLang {
  return lang === 'en' || lang === 'ja' ? lang : 'ko'
}

export function isMissingAnnouncementLangColumn(error: { code?: string; message?: string } | null): boolean {
  const message = error?.message?.toLowerCase() ?? ''
  return (
    error?.code === '42703' ||
    message.includes('announcements.lang') ||
    (
      message.includes('announcements') &&
      message.includes('lang') &&
      (message.includes('column') || message.includes('schema cache'))
    )
  )
}

async function fetchAnnouncementRows({
  lang,
  pinnedOnly,
  includeLang,
}: {
  lang: SupportedLang
  pinnedOnly: boolean
  includeLang: boolean
}): Promise<{ rows: AnnouncementRow[]; missingLang: boolean }> {
  const supabase = createAdminClient()
  let query = supabase
    .schema('limbus')
    .from('announcements')
    .select(includeLang ? ANNOUNCEMENT_SELECT : LEGACY_ANNOUNCEMENT_SELECT)

  if (includeLang) query = query.eq('lang', lang)
  if (pinnedOnly) query = query.eq('pinned', true)

  const { data, error } = await query
    .order('pinned', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(pinnedOnly ? 1 : 100)

  if (error) {
    if (includeLang && isMissingAnnouncementLangColumn(error)) return { rows: [], missingLang: true }
    throw error
  }

  return { rows: (data ?? []) as unknown as AnnouncementRow[], missingLang: false }
}

export async function getAnnouncementsForLang(langInput?: string | null): Promise<AnnouncementRow[]> {
  const lang = normalizeAnnouncementLang(langInput)
  const localized = await fetchAnnouncementRows({ lang, pinnedOnly: false, includeLang: true })
  if (!localized.missingLang) return localized.rows

  const legacy = await fetchAnnouncementRows({ lang, pinnedOnly: false, includeLang: false })
  return legacy.rows
}

export async function getPinnedAnnouncementForLang(langInput?: string | null): Promise<AnnouncementRow | null> {
  const lang = normalizeAnnouncementLang(langInput)
  const localizedPinned = await fetchAnnouncementRows({ lang, pinnedOnly: true, includeLang: true })
  if (localizedPinned.missingLang) {
    const legacyPinned = await fetchAnnouncementRows({ lang, pinnedOnly: true, includeLang: false })
    if (legacyPinned.rows[0]) return legacyPinned.rows[0]
    const legacyLatest = await fetchAnnouncementRows({ lang, pinnedOnly: false, includeLang: false })
    return legacyLatest.rows[0] ?? null
  }

  if (localizedPinned.rows[0]) return localizedPinned.rows[0]
  const localizedLatest = await fetchAnnouncementRows({ lang, pinnedOnly: false, includeLang: true })
  return localizedLatest.rows[0] ?? null
}

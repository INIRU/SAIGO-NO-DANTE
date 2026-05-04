import { NextResponse } from 'next/server'
import { getAnnouncementsForLang, getPinnedAnnouncementForLang } from '@/lib/db/announcements'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const pinnedOnly = searchParams.get('pinned') === 'true'
    const lang = searchParams.get('lang')

    if (pinnedOnly) {
      const data = await getPinnedAnnouncementForLang(lang)
      return NextResponse.json({ data })
    }

    const data = await getAnnouncementsForLang(lang)
    return NextResponse.json({ data })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal Server Error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

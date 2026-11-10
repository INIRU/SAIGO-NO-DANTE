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
    console.error('[api/announcements]', err)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

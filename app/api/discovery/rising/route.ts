import { NextResponse } from 'next/server'
import { loadRising } from '@/features/community/server'
import { COMMUNITY_FEED_CACHE_CONTROL } from '@/lib/constants/http-cache'

export async function GET(request: Request) {
  const kind = new URL(request.url).searchParams.get('kind')
  if (kind !== 'deck' && kind !== 'planner') return NextResponse.json({ error: 'Invalid filter' }, { status: 400 })
  try {
    return NextResponse.json(await loadRising(kind), { headers: { 'Cache-Control': COMMUNITY_FEED_CACHE_CONTROL } })
  } catch (error) {
    console.error('[discovery/rising]', error instanceof Error ? error.message : error)
    return NextResponse.json({ error: 'Unavailable' }, { status: 503 })
  }
}

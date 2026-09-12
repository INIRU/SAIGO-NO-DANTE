import { NextResponse } from 'next/server'
import { getMetaData } from '@/lib/db/meta'
import { DEFAULT_META_PERIOD, DEFAULT_META_SOURCE, META_PERIODS, META_SOURCES, type MetaPeriod, type MetaSource } from '@/lib/meta/types'

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams
  const source = params.get('source') ?? DEFAULT_META_SOURCE
  const period = params.get('period') ?? DEFAULT_META_PERIOD
  if (!META_SOURCES.includes(source as MetaSource) || !META_PERIODS.includes(period as MetaPeriod)) {
    return NextResponse.json({ error: 'Invalid meta source or period' }, { status: 400 })
  }
  try {
    return NextResponse.json(await getMetaData(source as MetaSource, period as MetaPeriod))
  } catch {
    return NextResponse.json({ error: 'Could not load usage statistics' }, { status: 500 })
  }
}

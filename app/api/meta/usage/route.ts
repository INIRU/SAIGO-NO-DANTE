import { NextResponse } from 'next/server'
import { getMetaData } from '@/lib/db/meta'
import { DEFAULT_META_SOURCE, META_SOURCES, parseMetaFilters, parseMetaPeriod, type MetaSource } from '@/lib/meta/types'

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams
  const source = params.get('source') ?? DEFAULT_META_SOURCE
  const rawPeriod = params.get('period')
  const period = parseMetaPeriod(rawPeriod)
  const { filters, invalid } = parseMetaFilters(key => params.get(key))
  if (!META_SOURCES.includes(source as MetaSource) || (rawPeriod !== null && period === 'all' && rawPeriod !== 'all') || invalid) {
    return NextResponse.json({ error: 'Invalid meta source, period or filter' }, { status: 400 })
  }
  try {
    return NextResponse.json(await getMetaData(source as MetaSource, period, filters))
  } catch {
    return NextResponse.json({ error: 'Could not load usage statistics' }, { status: 500 })
  }
}

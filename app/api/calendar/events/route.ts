import { NextResponse } from 'next/server'
import {
  getCurrentOfficialNewsMonth,
  getOfficialNewsEventsForMonth,
} from '@/lib/db/official-news-events'

function parseIntegerParam(value: string | null, field: string): number | null {
  if (value === null || value.trim() === '') return null
  const parsed = Number(value)
  if (!Number.isInteger(parsed)) {
    throw new Error(`Invalid ${field}`)
  }
  return parsed
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const current = getCurrentOfficialNewsMonth()
    const year = parseIntegerParam(searchParams.get('year'), 'year') ?? current.year
    const month = parseIntegerParam(searchParams.get('month'), 'month') ?? current.month

    if (year < 2000 || year > 2100 || month < 1 || month > 12) {
      return NextResponse.json(
        { error: { code: 'invalid_input', message: 'year must be 2000-2100 and month must be 1-12' } },
        { status: 400 },
      )
    }

    const data = await getOfficialNewsEventsForMonth({ year, month })
    return NextResponse.json({ data, meta: { year, month } })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal Server Error'
    const status = message.startsWith('Invalid ') ? 400 : 500
    return NextResponse.json(
      { error: { code: status === 400 ? 'invalid_input' : 'internal', message } },
      { status },
    )
  }
}

import { NextResponse } from 'next/server'
import { getPlanGiftStats } from '@/lib/db/meta'

/** Public plans' gift holders for the assist's recommendations; outside the run page so plan edits do not re-render it. */
export async function GET() {
  try {
    return NextResponse.json(await getPlanGiftStats())
  } catch {
    return NextResponse.json({ error: 'Could not load plan gift statistics' }, { status: 500 })
  }
}

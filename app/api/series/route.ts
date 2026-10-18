import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { seriesActor, seriesFail, seriesHeaders } from '@/lib/series/actor'
import { seriesCreateSchema } from '@/lib/series/order'
import { listUserSeries } from '@/lib/series/server'

const postQuery = z.object({ kind: z.enum(['deck', 'plan']), post: z.string().uuid() })

/** The signed-in user's series; with ?kind=&post= also the series that post is in. */
export async function GET(request: NextRequest) {
  const who = await seriesActor(request, false)
  if (who instanceof Response) return who
  if (!who.id) return NextResponse.json({ series: [], current: null }, { headers: seriesHeaders })
  const asked = request.nextUrl.searchParams.has('post') ? postQuery.safeParse(Object.fromEntries(request.nextUrl.searchParams)) : null
  if (asked && !asked.success) return seriesFail('Invalid post', 400)
  try {
    const series = await listUserSeries(who.admin, who.id)
    let current: string | null = null
    if (asked?.success) {
      const column = asked.data.kind === 'deck' ? 'deck_id' : 'plan_id'
      const { data, error } = await who.admin.schema('limbus').from('series_items').select('series_id').eq(column, asked.data.post).maybeSingle()
      if (error) return seriesFail('Series unavailable', 503)
      current = data && series.some(row => row.id === data.series_id) ? data.series_id : null
    }
    return NextResponse.json({ series, current }, { headers: seriesHeaders })
  } catch {
    return seriesFail('Series unavailable', 503)
  }
}

export async function POST(request: NextRequest) {
  const body = seriesCreateSchema.safeParse(await request.json().catch(() => null))
  if (!body.success) return seriesFail('Invalid series', 400)
  const who = await seriesActor(request, true)
  if (who instanceof Response) return who
  if (!who.id) return seriesFail('Account unavailable', 503)
  const { data, error } = await who.admin.schema('limbus').from('series').insert({ user_id: who.id, title: body.data.title }).select('id, title').single()
  if (error) return seriesFail('Series unavailable', 503)
  return NextResponse.json({ series: { ...data, count: 0 } }, { status: 201, headers: seriesHeaders })
}

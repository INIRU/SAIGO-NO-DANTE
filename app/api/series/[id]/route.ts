import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { seriesActor, seriesFail, seriesHeaders, loadSeries, revalidateSeries, seriesPatchSchema } from '@/features/community/server'

const idSchema = z.string().uuid()

/** Whether the signed-in user owns this series (the page itself is public and cached). */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const id = idSchema.safeParse((await params).id)
  if (!id.success) return seriesFail('Not found', 404)
  const who = await seriesActor(request, false)
  if (who instanceof Response) return NextResponse.json({ isOwner: false }, { headers: seriesHeaders })
  if (!who.id) return NextResponse.json({ isOwner: false }, { headers: seriesHeaders })
  const { data, error } = await who.admin.schema('limbus').from('series').select('user_id').eq('id', id.data).maybeSingle()
  if (error) return seriesFail('Series unavailable', 503)
  return NextResponse.json({ isOwner: data?.user_id === who.id }, { headers: seriesHeaders })
}

async function ownedSeries(request: NextRequest, rawId: string) {
  const id = idSchema.safeParse(rawId)
  if (!id.success) return seriesFail('Not found', 404)
  const who = await seriesActor(request, true)
  if (who instanceof Response) return who
  if (!who.id) return seriesFail('Account unavailable', 503)
  let series
  try {
    series = await loadSeries(who.admin, id.data)
  } catch {
    return seriesFail('Series unavailable', 503)
  }
  if (!series || series.user_id !== who.id) return seriesFail('Not found', 404)
  return { admin: who.admin, series }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const body = seriesPatchSchema.safeParse(await request.json().catch(() => null))
  if (!body.success) return seriesFail('Invalid series', 400)
  const owned = await ownedSeries(request, (await params).id)
  if (owned instanceof Response) return owned
  const { admin, series } = owned
  const db = admin.schema('limbus')
  if (body.data.order) {
    const have = new Set(series.items.map(item => `${item.kind}:${item.id}`))
    if (body.data.order.length !== have.size || !body.data.order.every(item => have.has(`${item.kind}:${item.id}`))) return seriesFail('Invalid order', 400)
    for (const [position, item] of body.data.order.entries()) {
      const { error } = await db.from('series_items').update({ position }).eq('series_id', series.id).eq(item.kind === 'deck' ? 'deck_id' : 'plan_id', item.id)
      if (error) return seriesFail('Series unavailable', 503)
    }
  }
  const { error } = await db.from('series').update({ ...(body.data.title ? { title: body.data.title } : {}), updated_at: new Date().toISOString() }).eq('id', series.id)
  if (error) return seriesFail('Series unavailable', 503)
  revalidateSeries(series.id)
  return NextResponse.json({ ok: true }, { headers: seriesHeaders })
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const owned = await ownedSeries(request, (await params).id)
  if (owned instanceof Response) return owned
  const { admin, series } = owned
  const { error } = await admin.schema('limbus').from('series').delete().eq('id', series.id)
  if (error) return seriesFail('Series unavailable', 503)
  revalidateSeries(series.id, series.items)
  return NextResponse.json({ ok: true }, { headers: seriesHeaders })
}

import { NextResponse } from 'next/server'
import { getFormations, getMetaCatalog, getMetaData, getPlanChoices } from '@/lib/db/meta'
import { floorChoices, suggestIdentities } from '@/lib/discovery/suggestions'

// Counted from public decks and plans only, so one answer is shared: the counts themselves are cached for hours.
const headers = { 'Cache-Control': 'public, max-age=300' }
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
const MIN_EGO_PAIRS = 3
const bad = () => NextResponse.json({ error: 'Invalid filter' }, { status: 400, headers })
const list = (value: string | null, max: number) => (value ? value.split(',').filter(Boolean).slice(0, max) : [])

/**
 * Picker suggestions from what public decks and plans do:
 *  type=identity&sinner=<id>&with=<ids>  identities of the sinner fielded beside the given ones
 *  type=ego&identity=<id>                E.G.O most equipped with the identity
 *  type=floor&floor=<1-15>&identities=<ids>&keywords=<names>  packs and gifts similar plans took on the floor
 */
export async function GET(request: Request) {
  const query = new URL(request.url).searchParams
  const type = query.get('type')
  try {
    if (type === 'identity') {
      const sinner = query.get('sinner') ?? '', context = list(query.get('with'), 12)
      if (!sinner || !context.length || !context.every(id => UUID.test(id))) return bad()
      const [formations, catalog] = await Promise.all([getFormations(), getMetaCatalog()])
      const candidates = new Set(catalog.identities.filter(identity => identity.sinner_id === sinner).map(identity => identity.id))
      return NextResponse.json({ items: suggestIdentities(formations, context, candidates, 24) }, { headers })
    }
    if (type === 'ego') {
      const identity = query.get('identity') ?? ''
      if (!UUID.test(identity)) return bad()
      const egos = (await getMetaData('all', 'all')).identityInsights[identity]?.egos ?? []
      return NextResponse.json({ items: egos.filter(ego => ego.count >= MIN_EGO_PAIRS).slice(0, 12).map(ego => ({ id: ego.ego_id, count: ego.count })) }, { headers })
    }
    if (type === 'floor') {
      const floor = Number(query.get('floor'))
      const identities = list(query.get('identities'), 12)
      if (!Number.isInteger(floor) || floor < 1 || floor > 15 || !identities.every(id => UUID.test(id))) return bad()
      const { themes, gifts } = floorChoices(await getPlanChoices(), { identities, keywords: list(query.get('keywords'), 6) }, floor)
      return NextResponse.json({ themes: themes.slice(0, 30), gifts: gifts.slice(0, 60) }, { headers })
    }
    return bad()
  } catch (error) {
    console.error('[discovery/suggest]', error instanceof Error ? error.message : error)
    return NextResponse.json({ error: 'Unavailable' }, { status: 503, headers: { 'Cache-Control': 'no-store' } })
  }
}

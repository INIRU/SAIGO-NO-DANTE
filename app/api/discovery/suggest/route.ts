import { NextResponse } from 'next/server'
import { getFormations, getRecCatalog, buildEgoModel, suggestEgos, buildFloorModel, rankGifts, rankThemes, buildIdentityModel, detectArchetype, suggestIdentities } from '@/features/community/server'
import { getAvailableThemes } from '@/lib/planner/fusion'
import { DIFFICULTY_FLOOR_KEY, type Difficulty } from '@/lib/planner/types'

// Counted from public decks and plans only, so one answer is shared: the counts themselves are cached for hours.
const headers = { 'Cache-Control': 'public, max-age=300' }
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
const bad = () => NextResponse.json({ error: 'Invalid filter' }, { status: 400, headers })
const list = (value: string | null, max: number) => (value ? value.split(',').filter(Boolean).slice(0, max) : [])

/**
 * Picker suggestions from what public decks and plans do (recommender v2, see the change "recommender-v2"):
 *  type=identity&sinner=<id>[&with=<ids>][&keywords=<names>]
 *      the sinner's identities for an empty slot, given every identity chosen on the board (any order, none is fine);
 *      items [{ id, score, reasons, partners: [{ id, score, chosen }] }] and archetype { keywords, factions }
 *  type=ego&identity=<id>[&with=<ids>][&equipped=<ego ids>]
 *      the identity's sinner's E.G.O (ZAYIN left out), same item shape plus count (posts equipping it on this identity)
 *  type=floor&floor=<1-15>&identities=<ids>[&keywords=<names>][&difficulty=][&others=<floor>:<pack>,…][&theme=<pack>][&taken=<gift ids>]
 *      themes [{ id, count, score, reasons }] the floor can show and gifts [{ id, count, score, reasons }] of its pack
 * Reason codes: keyword:<name> and faction:<name> (Korean names as in the database), sin:<wrath|…>, then synergy, meta, new.
 */
export async function GET(request: Request) {
  const query = new URL(request.url).searchParams
  const type = query.get('type')
  try {
    if (type === 'identity') {
      const sinner = query.get('sinner') ?? '', context = list(query.get('with'), 12)
      if (!sinner || !context.every(id => UUID.test(id))) return bad()
      const [formations, catalog] = await Promise.all([getFormations(), getRecCatalog()])
      const result = suggestIdentities(buildIdentityModel(formations, catalog), { context, sinner, keywords: list(query.get('keywords'), 6), now: Date.now() }, { limit: 24 })
      return NextResponse.json(result, { headers })
    }
    if (type === 'ego') {
      const identity = query.get('identity') ?? '', board = list(query.get('with'), 12), equipped = list(query.get('equipped'), 24)
      if (!UUID.test(identity) || ![...board, ...equipped].every(id => UUID.test(id))) return bad()
      const [formations, catalog] = await Promise.all([getFormations(), getRecCatalog()])
      return NextResponse.json(suggestEgos(buildEgoModel(formations, catalog), { identity, board, equipped, now: Date.now() }, { limit: 12 }), { headers })
    }
    if (type === 'floor') {
      const floor = Number(query.get('floor'))
      const identities = list(query.get('identities'), 12)
      const others = list(query.get('others'), 15).map(pair => pair.split(':')).filter(pair => pair.length === 2 && /^\d+$/.test(pair[1]))
        .map(([otherFloor, theme]) => ({ floor: Number(otherFloor), theme })).filter(other => Number.isInteger(other.floor) && other.floor >= 1 && other.floor <= 15)
      const difficulty = query.get('difficulty')
      const theme = query.get('theme')
      const taken = list(query.get('taken'), 200)
      if (!Number.isInteger(floor) || floor < 1 || floor > 15 || !identities.every(id => UUID.test(id)) || (difficulty && !(difficulty in DIFFICULTY_FLOOR_KEY))
        || (theme && !/^\d+$/.test(theme)) || !taken.every(id => /^\d+$/.test(id))) return bad()
      const [formations, catalog] = await Promise.all([getFormations(), getRecCatalog()])
      const model = buildFloorModel(formations, catalog)
      const keys = difficulty ? [DIFFICULTY_FLOOR_KEY[difficulty as Difficulty]] : Object.values(DIFFICULTY_FLOOR_KEY)
      const used = new Set(others.map(other => other.theme))
      const packs = new Map<string, true>()
      for (const key of keys) for (const pack of getAvailableThemes(Object.values(catalog.themes).map(row => ({ id: row.id, floor_info: row.floorInfo })), key, floor)) if (!used.has(pack.id)) packs.set(pack.id, true)
      const declared = list(query.get('keywords'), 6)
      const asked = { floor, identities, keywords: declared, others, theme, taken, now: Date.now() }
      // Only what some similar plan took (or a gift that matches the team's keyword): a guess with no plan behind it is not a suggestion.
      const themes = rankThemes(model, { ...asked, candidates: [...packs.keys()] }).filter(row => row.count > 0).slice(0, 30)
      const gifts = rankGifts(model, { ...asked, candidates: theme ? catalog.themes[theme]?.gifts ?? [] : Object.keys(catalog.gifts) })
        .filter(row => row.count > 0 || row.reasons.some(code => code.startsWith('keyword:'))).slice(0, 60)
      const board = identities.flatMap(id => catalog.identities[id] ? [catalog.identities[id]] : [])
      return NextResponse.json({ themes: themes.map(({ id, count, score, reasons }) => ({ id, count, score: Math.round(score * 1000) / 1000, reasons })), gifts: gifts.map(({ id, count, score, reasons }) => ({ id, count, score: Math.round(score * 1000) / 1000, reasons })), archetype: detectArchetype(catalog, board.filter(identity => !identity.starter), declared) }, { headers })
    }
    return bad()
  } catch (error) {
    console.error('[discovery/suggest]', error instanceof Error ? error.message : error)
    return NextResponse.json({ error: 'Unavailable' }, { status: 503, headers: { 'Cache-Control': 'no-store' } })
  }
}

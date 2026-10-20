/**
 * Server time of one suggestion request on the real data (model build included, as the API does per request).
 *   npx tsx scripts/recommender/bench.ts
 */
import { buildEgoModel, suggestEgos } from '@/lib/discovery/ego-recs'
import { buildFloorModel, rankGifts, rankThemes } from '@/lib/discovery/floor-recs'
import { buildIdentityModel, suggestIdentities } from '@/lib/discovery/identity-recs'
import { buildRecCatalog } from '@/lib/discovery/rec-catalog'
import { loadSnapshot } from './load-snapshot'
import { toFormation } from './v2'

const snapshot = loadSnapshot()
const catalog = buildRecCatalog(snapshot.catalog)
const formations = snapshot.formations.map(toFormation)
const time = <T>(label: string, runs: number, fn: () => T) => {
  fn()
  const start = performance.now()
  for (let i = 0; i < runs; i++) fn()
  console.log(`${label.padEnd(34)} ${((performance.now() - start) / runs).toFixed(2)} ms`)
}

const rich = snapshot.formations.filter(f => f.identities.length >= 7 && f.floors.length)[0]
const sinnerOf = new Map(snapshot.catalog.identities.map(i => [i.id, i.sinner_id]))
const board = rich.identities.slice(0, 5), target = sinnerOf.get(rich.identities[5])!
const now = Date.now()

time('buildIdentityModel', 20, () => buildIdentityModel(formations, catalog))
const model = buildIdentityModel(formations, catalog)
time('suggestIdentities (5 on board)', 50, () => suggestIdentities(model, { context: board, sinner: target, now }, { limit: 24 }))
time('suggestIdentities (empty board)', 50, () => suggestIdentities(model, { context: [], sinner: target, now }, { limit: 24 }))
time('build + suggest (request)', 20, () => suggestIdentities(buildIdentityModel(formations, catalog), { context: board, sinner: target, now }, { limit: 24 }))
time('buildEgoModel + suggestEgos', 20, () => suggestEgos(buildEgoModel(formations, catalog), { identity: board[0], board: board.slice(1), now }, { limit: 12 }))
time('buildFloorModel + themes + gifts', 20, () => {
  const floorModel = buildFloorModel(formations, catalog)
  const packs = Object.keys(catalog.themes)
  const query = { floor: 5, identities: board, candidates: packs, now }
  rankThemes(floorModel, query)
  rankGifts(floorModel, { ...query, theme: rich.floors[4]?.theme, candidates: catalog.themes[rich.floors[4]?.theme ?? '']?.gifts ?? [] })
})

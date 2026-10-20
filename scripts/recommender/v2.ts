import type { Formation } from '@/lib/discovery/co-occurrence'
import { buildEgoModel, EGO_CONFIG, rankEgos, type EgoConfig, type EgoModel } from '@/lib/discovery/ego-recs'
import { buildFloorModel, FLOOR_CONFIG, rankGifts, rankThemes, type FloorConfig, type FloorModel } from '@/lib/discovery/floor-recs'
import { buildIdentityModel, IDENTITY_CONFIG, rankIdentities, type IdentityConfig, type IdentityModel } from '@/lib/discovery/identity-recs'
import { buildRecCatalog, type RecCatalog } from '@/lib/discovery/rec-catalog'
import type { Rankers } from './baseline'
import type { EvalFormation, Snapshot } from './load-snapshot'
import type { FloorQuery as EvalFloorQuery } from './queries'

export const toFormation = (f: EvalFormation): Formation => ({
  kind: f.kind, id: f.id, identities: f.identities, votes: f.votes, views: f.views, createdAt: f.createdAt,
  egos: f.egos.map(ego => ego.ego_id), floors: f.floors,
})

const cached = <T>(build: (train: EvalFormation[]) => T) => {
  const models = new WeakMap<EvalFormation[], T>()
  return (train: EvalFormation[]) => { let model = models.get(train); if (!model) { model = build(train); models.set(train, model) } return model }
}

export type V2Parts = { catalog: RecCatalog; identityModel: (train: EvalFormation[]) => IdentityModel; egoModel: (train: EvalFormation[]) => EgoModel; floorModel: (train: EvalFormation[]) => FloorModel }

/** Models are built once per training set (the harness shares one array per author / formation). */
export function v2Parts(snapshot: Snapshot): V2Parts {
  const catalog = buildRecCatalog(snapshot.catalog)
  return {
    catalog,
    identityModel: cached(train => buildIdentityModel(train.map(toFormation), catalog)),
    egoModel: cached(train => buildEgoModel(train.map(toFormation), catalog)),
    floorModel: cached(train => buildFloorModel(train.map(toFormation), catalog)),
  }
}

export const floorQueryOf = (query: EvalFloorQuery) => ({
  floor: query.floor, identities: query.f.identities, theme: query.theme, taken: query.takenGifts, candidates: query.candidates, now: query.now,
  others: query.f.floors.filter(other => other.floor !== query.floor && other.theme).map(other => ({ floor: other.floor, theme: other.theme! })),
})

export type Overrides = { identity?: Partial<IdentityConfig>; ego?: Partial<EgoConfig>; floor?: Partial<FloorConfig> }

export function v2Rankers(snapshot: Snapshot, overrides: Overrides = {}): Rankers {
  const parts = v2Parts(snapshot)
  const identityCfg = { ...IDENTITY_CONFIG, ...overrides.identity, weights: { ...IDENTITY_CONFIG.weights, ...overrides.identity?.weights } }
  const egoCfg = { ...EGO_CONFIG, ...overrides.ego, weights: { ...EGO_CONFIG.weights, ...overrides.ego?.weights } }
  const floorCfg = { ...FLOOR_CONFIG, ...overrides.floor }
  return {
    identity: query => rankIdentities(parts.identityModel(query.train), { context: query.context, sinner: query.sinner, candidates: query.candidates, now: query.now }, identityCfg).ranked.map(row => row.id),
    ego: query => rankEgos(parts.egoModel(query.train), { identity: query.identity, board: query.team, equipped: query.otherEgos, candidates: query.candidates, now: query.now }, egoCfg).map(row => row.id),
    theme: query => rankThemes(parts.floorModel(query.train), floorQueryOf(query), floorCfg).map(row => row.id),
    gift: query => rankGifts(parts.floorModel(query.train), floorQueryOf(query), floorCfg).map(row => row.id),
  }
}

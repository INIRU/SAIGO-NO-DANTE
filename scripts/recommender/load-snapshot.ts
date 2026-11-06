import fs from 'node:fs'
import path from 'node:path'
import type { RawCatalog } from '@/features/community/lib/rec-catalog'

export type { RawCatalog }

/** One public deck or plan as the evaluation sees it. */
export type EvalFormation = {
  key: string
  kind: 'deck' | 'planner'
  id: string
  createdAt: number
  votes: number
  views: number
  /** Hashed author, only to keep one author's near-copies on the same side of a split. */
  author: string
  /** Fielded identities (slot_order < 99), one per sinner, in slot order. */
  identities: string[]
  /** [s1, s2, s3] counts per identity. */
  distribution: Record<string, [number, number, number]>
  egos: { ego_id: string; sinner_id: string; grade: string }[]
  mainKeywords: string[]
  /** Plans only: per floor the pack and gifts taken. */
  floors: { floor: number; theme: string | null; gifts: string[]; difficulty: string }[]
}

export type Snapshot = {
  catalog: RawCatalog
  formations: EvalFormation[]
  exportedAt: string
}

const dir = path.resolve(process.cwd(), '.recsys-snapshot')
const read = <T>(name: string): T => JSON.parse(fs.readFileSync(path.join(dir, `${name}.json`), 'utf8')) as T

type Row = Record<string, unknown>

export function loadSnapshot(): Snapshot {
  if (!fs.existsSync(dir)) throw new Error('Run `node scripts/recommender/export-snapshot.mjs` first (it writes the git-ignored .recsys-snapshot/).')
  const identities = read<RawCatalog['identities']>('identities')
  // The LCB 수감자 every sinner starts with (rarity 1) fills a board slot but says nothing about the team: not a formation member.
  const sinnerOf = new Map(identities.filter(identity => identity.rarity > 1).map(identity => [identity.id, identity.sinner_id]))
  const egos = read<RawCatalog['egos']>('egos')
  const egoSinner = new Map(egos.map(ego => [ego.id, ego.sinner_id]))
  const formations: EvalFormation[] = []

  const fielded = (rows: Row[]) => {
    const seen = new Set<string>()
    const out: { id: string; order: number; dist: [number, number, number] }[] = []
    for (const row of rows.filter(r => typeof r.identity_id === 'string' && typeof r.slot_order === 'number' && (r.slot_order as number) >= 0 && (r.slot_order as number) < 99)
      .sort((a, b) => (a.slot_order as number) - (b.slot_order as number))) {
      const id = row.identity_id as string
      const sinner = sinnerOf.get(id)
      if (!sinner || seen.has(sinner)) continue
      seen.add(sinner)
      out.push({ id, order: row.slot_order as number, dist: [Number(row.s1_count ?? 3), Number(row.s2_count ?? 2), Number(row.s3_count ?? 1)] })
    }
    return out
  }

  for (const deck of read<Row[]>('decks')) {
    const slots = fielded(deck.deck_identities as Row[])
    if (!slots.length) continue
    formations.push({
      key: `deck:${deck.id}`, kind: 'deck', id: deck.id as string, votes: Number(deck.vote_count ?? 0), views: Number(deck.view_count ?? 0), createdAt: Date.parse(deck.created_at as string), author: deck.author as string,
      identities: slots.map(slot => slot.id), distribution: Object.fromEntries(slots.map(slot => [slot.id, slot.dist])),
      egos: ((deck.deck_egos as Row[]) ?? []).flatMap(ego => egoSinner.has(ego.ego_id as string) ? [{ ego_id: ego.ego_id as string, sinner_id: egoSinner.get(ego.ego_id as string)!, grade: String(ego.grade) }] : []),
      mainKeywords: (deck.main_keywords as string[]) ?? [], floors: [],
    })
  }
  for (const plan of read<Row[]>('plans')) {
    const slots = fielded((plan.deck as Row[]) ?? [])
    if (!slots.length) continue
    const floors: EvalFormation['floors'] = []
    for (const row of (plan.floor_plan as Row[]) ?? []) {
      const floor = Number(row?.floor)
      if (!Number.isInteger(floor) || floor < 1 || floor > 15 || floors.some(entry => entry.floor === floor)) continue
      floors.push({
        floor, theme: row.theme_id === null || row.theme_id === undefined || row.theme_id === '' ? null : String(row.theme_id),
        gifts: Array.isArray(row.gift_ids) ? (row.gift_ids as unknown[]).map(String).filter(id => /^\d+$/.test(id)) : [], difficulty: String(row.difficulty ?? 'hard'),
      })
    }
    formations.push({
      key: `planner:${plan.id}`, kind: 'planner', id: plan.id as string, votes: Number(plan.vote_count ?? 0), views: Number(plan.view_count ?? 0), createdAt: Date.parse(plan.created_at as string), author: plan.author as string,
      identities: slots.map(slot => slot.id), distribution: Object.fromEntries(slots.map(slot => [slot.id, slot.dist])),
      egos: ((plan.egos as Row[]) ?? []).flatMap(ego => egoSinner.has(ego.ego_id as string) ? [{ ego_id: ego.ego_id as string, sinner_id: egoSinner.get(ego.ego_id as string)!, grade: String(ego.grade) }] : []),
      mainKeywords: (plan.tags as string[]) ?? [], floors,
    })
  }
  formations.sort((a, b) => a.createdAt - b.createdAt || a.key.localeCompare(b.key))

  return {
    catalog: {
      identities, egos,
      skills: read('skills'), passives: read('passives'), gifts: read('gifts'), themes: read('themes'),
    },
    formations,
    exportedAt: read<{ exported_at: string }>('meta').exported_at,
  }
}

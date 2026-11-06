/**
 * Prints suggestions side by side, old algorithm against v2, on all public posts (no hold-out):
 *   npx tsx scripts/recommender/scenario.ts            the reported case: 새벽 사무소 파우스트 + 그레고르 + 거미집 엄지 아비, then 이상's slot
 *   npx tsx scripts/recommender/scenario.ts real       three real formations with one identity hidden
 */
import { COMPONENTS, IDENTITY_CONFIG, identityComponents, suggestIdentities, type SuggestedIdentity } from '@/features/community/lib/identity-recs'
import { legacySuggestIdentities } from './legacy'
import { loadSnapshot } from './load-snapshot'
import { rbo } from './metrics'
import { hash, identityQueries } from './queries'
import { toFormation, v2Parts } from './v2'

const snapshot = loadSnapshot()
const parts = v2Parts(snapshot)
const nameOf = new Map(snapshot.catalog.identities.map(i => [i.id, `${i.name_kr} (${i.sinner_id})`]))
const now = Date.parse(snapshot.exportedAt)
const formations = snapshot.formations
const model = parts.identityModel(formations)
const override = JSON.parse(process.env.SET ?? '{}')
const cfg = { ...IDENTITY_CONFIG, ...override, weights: { ...IDENTITY_CONFIG.weights, ...override.weights } }

const show = (identity: string) => nameOf.get(identity) ?? identity
function printV2(context: string[], sinner: string, atNow = now, candidates?: string[]) {
  const { items, archetype } = suggestIdentities(model, { context, sinner, candidates, now: atNow }, { limit: 6, cfg })
  console.log(`  v2 archetype: keywords [${archetype.keywords.join(', ')}] factions [${archetype.factions.join(', ')}]`)
  items.forEach((item: SuggestedIdentity, i) => console.log(`  v2 ${i + 1}. ${show(item.id)}  score ${item.score}  reasons [${item.reasons.join(', ')}]  partners [${item.partners.map(p => `${p.chosen ? '*' : ''}${show(p.id).split(' (')[0]}`).join(', ')}]`))
  if (process.env.DEBUG_Z) {
    const { scored } = identityComponents(model, { context, sinner, candidates, now: atNow }, IDENTITY_CONFIG, { withSin: true })
    for (const row of scored.filter(r => items.some(i => i.id === r.id))) console.log(`     z ${show(row.id).padEnd(34)} ` + COMPONENTS.map((c, i) => `${c}:${(row.z[i] * IDENTITY_CONFIG.weights[c]).toFixed(2)}`).join(' '))
  }
  return items.map(item => item.id)
}
function printLegacy(context: string[], sinner: string, candidates?: string[]) {
  const pool = new Set(candidates ?? snapshot.catalog.identities.filter(i => i.sinner_id === sinner && i.rarity > 1).map(i => i.id))
  const rows = legacySuggestIdentities(formations.map(f => ({ kind: f.kind, id: f.id, identities: f.identities, votes: 0, views: 0 })), context, pool, 6)
  if (!rows.length) console.log('  old: (nothing)')
  rows.forEach((row, i) => console.log(`  old ${i + 1}. ${show(row.id)}  score ${row.score.toFixed(2)}`))
  return rows.map(row => row.id)
}

if (process.argv[2] === 'real') {
  // Posts where the old list missed the hidden identity at the top and v2 found it, as three examples picked by a fixed hash.
  const asOld = (q: ReturnType<typeof identityQueries>[number]) => legacySuggestIdentities(q.train.map(f => ({ kind: f.kind, id: f.id, identities: f.identities, votes: 0, views: 0 })), q.context, new Set(q.candidates), 6)
  const v2Top = (q: ReturnType<typeof identityQueries>[number]) => suggestIdentities(parts.identityModel(q.train), { context: q.context, sinner: q.sinner, candidates: q.candidates, now: q.now }, { limit: 1 }).items[0]?.id
  const queries = identityQueries(snapshot, 'author', 'three').filter(q => q.context.length === 3 && q.f.identities.length >= 6 && asOld(q)[0]?.id !== q.held && v2Top(q) === q.held)
  console.log(`${queries.length} posts where the old top pick missed and v2's hit`)
  for (const q of queries.sort((a, b) => hash(a.f.key + a.held) - hash(b.f.key + b.held)).slice(0, 3)) {
    const trainModel = parts.identityModel(q.train)
    console.log(`\n== ${q.f.key}: board ${q.context.map(id => show(id).split(' (')[0]).join(' + ')}  ->  hidden ${show(q.held)}`)
    const pool = new Set(q.candidates)
    const old = legacySuggestIdentities(q.train.map(f => ({ kind: f.kind, id: f.id, identities: f.identities, votes: 0, views: 0 })), q.context, pool, 6)
    old.forEach((row, i) => console.log(`  old ${i + 1}. ${show(row.id)}${row.id === q.held ? '  <= hidden' : ''}`))
    if (!old.length) console.log('  old: (nothing)')
    const { items, archetype } = suggestIdentities(trainModel, { context: q.context, sinner: q.sinner, candidates: q.candidates, now: q.now }, { limit: 6 })
    console.log(`  v2 archetype: keywords [${archetype.keywords.join(', ')}] factions [${archetype.factions.join(', ')}]`)
    items.forEach((item, i) => console.log(`  v2 ${i + 1}. ${show(item.id)}${item.id === q.held ? '  <= hidden' : ''}  reasons [${item.reasons.join(', ')}]  partners [${item.partners.map(p => `${p.chosen ? '*' : ''}${show(p.id).split(' (')[0]}`).join(', ')}]`))
  }
} else {
  const byName = (name: string, sinner: string) => snapshot.catalog.identities.find(i => i.name_kr === name && i.sinner_id === sinner)!.id
  const board = [byName('새벽 사무소 해결사', 'faust'), byName('새벽 사무소 대표', 'gregor'), byName('거미집 엄지 아비', 'rodion')]
  console.log(`board: ${board.map(show).join(' + ')}\n\n[1] open 이상's slot`)
  const oldFirst = printLegacy(board, 'yi-sang')
  const newFirst = printV2(board, 'yi-sang')
  console.log('\n[2] after picking the first suggestion for 이상, open 이명한 (대표의 다음 칸): ')
  for (const [label, pick] of [['old', oldFirst[0]], ['v2', newFirst[0]]] as const) {
    if (!pick) continue
    console.log(`\n-- picked (${label}) ${show(pick)}; board + pick, sinner: don-quixote`)
    const next = [...board, pick]
    if (label === 'old') printLegacy(next, 'don-quixote'); else printV2(next, 'don-quixote')
  }
  const quiet = (fn: () => string[]) => { const log = console.log; console.log = () => {}; try { return fn() } finally { console.log = log } }
  const before = board.slice(0, 2), oldBefore = quiet(() => printLegacy(before, 'yi-sang')), newBefore = quiet(() => printV2(before, 'yi-sang'))
  console.log(`\n[1b] 아비를 더하기 전(${before.map(id => show(id).split(' (')[0]).join(' + ')}) -> 후, 이상 칸 상위 목록 겹침(RBO): old ${rbo(oldBefore, oldFirst).toFixed(2)}, v2 ${rbo(newBefore, newFirst).toFixed(2)}`)
  console.log('\n[3] empty board, 이상 / 파우스트 slots')
  printV2([], 'yi-sang')
  printV2([], 'faust')
}
void toFormation

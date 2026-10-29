/**
 * Production game-data integrity check (read-only, publishable key).
 * Fails when a reference points at a missing row, an image URL does not load,
 * a public name lacks en/ja text, or an identity affiliation has no translation.
 *   npx tsx scripts/audit/data-integrity.ts
 */
import { createClient } from '@supabase/supabase-js'
import { getLocalizedAffiliation } from '../../lib/i18n/localize'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
if (!url || !key) throw new Error('NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY are required')
const db = createClient(url, key, { db: { schema: 'limbus' } })

type Row = Record<string, any>
async function all(table: string, columns: string): Promise<Row[]> {
  const { data, error } = await db.from(table).select(columns).range(0, 9999)
  if (error) throw new Error(table + ': ' + error.message)
  return data as Row[]
}

const problems: string[] = []

async function main() {
const report = (msg: string) => problems.push(msg)

const [gifts, themes, recipes, events, identities, egos] = await Promise.all([
  all('ego_gifts', 'game_id,name,name_en,name_jp,convert_to,image_url'),
  all('ego_gift_themes', 'id,name,name_en,name_jp,ego_gift_ids,specific_ego_gift_ids,fixed_reward_gift_ids,image_url,boss_image_url'),
  all('ego_gift_recipes', 'result_name,ingredients'),
  all('md_events', 'id,name,name_en,name_jp,gift_ids,theme_ids,image_url'),
  all('identities', 'game_id,name_kr,name_en,name_jp,affiliation,association_list,bg_image_url'),
  all('ego', 'game_id,name_kr,name_en,name_jp,image_url,cor_image_url'),
])

const giftIds = new Set(gifts.map(g => g.game_id))
const giftNames = new Set(gifts.map(g => g.name))
const themeIds = new Set(themes.map(t => t.id))

for (const t of themes) {
  for (const col of ['ego_gift_ids', 'specific_ego_gift_ids', 'fixed_reward_gift_ids']) {
    for (const id of t[col] ?? []) if (!giftIds.has(id)) report('theme ' + t.id + ' ' + t.name + ': ' + col + ' has missing gift ' + id)
  }
}
for (const g of gifts) if (g.convert_to != null && !giftIds.has(g.convert_to)) report('gift ' + g.game_id + ' ' + g.name + ': convert_to ' + g.convert_to + ' is missing')
for (const r of recipes) {
  for (const name of [r.result_name, ...(r.ingredients ?? [])]) {
    if (name && !giftNames.has(name)) report('recipe ' + r.result_name + ': gift "' + name + '" is missing')
  }
}
for (const e of events) {
  for (const id of e.gift_ids ?? []) if (!giftIds.has(id)) report('event ' + e.id + ' ' + e.name + ': missing gift ' + id)
  for (const id of e.theme_ids ?? []) if (!themeIds.has(id)) report('event ' + e.id + ' ' + e.name + ': missing theme ' + id)
}

const named: [string, Row[], string, string][] = [
  ['gift', gifts, 'game_id', 'name'],
  ['theme', themes, 'id', 'name'],
  ['identity', identities, 'game_id', 'name_kr'],
  ['ego', egos, 'game_id', 'name_kr'],
]
for (const [kind, rows, id, ko] of named) {
  for (const r of rows) {
    if (!r[ko]) report(kind + ' ' + r[id] + ': Korean name is empty')
    if (!r.name_en) report(kind + ' ' + r[id] + ' ' + r[ko] + ': English name is empty')
    if (!r.name_jp) report(kind + ' ' + r[id] + ' ' + r[ko] + ': Japanese name is empty')
  }
}

// A Hangul affiliation that comes back unchanged has no en/ja entry in AFFILIATION_MAP.
const affiliations = new Set(identities.flatMap(i => [i.affiliation, ...(i.association_list ?? [])]).filter(Boolean).map((a: string) => a.trim()))
for (const a of affiliations) {
  if (/[가-힣]/.test(a) && (getLocalizedAffiliation(a, 'en') === a || getLocalizedAffiliation(a, 'ja') === a)) report('affiliation "' + a + '" has no en/ja translation')
}

const images = [
  ...gifts.map(g => ['gift ' + g.game_id, g.image_url]),
  ...themes.flatMap(t => [['theme ' + t.id, t.image_url], ['theme boss ' + t.id, t.boss_image_url]]),
  ...events.map(e => ['event ' + e.id, e.image_url]),
  ...identities.map(i => ['identity ' + i.game_id, i.bg_image_url]),
  ...egos.flatMap(e => [['ego ' + e.game_id, e.image_url], ['ego corrosion ' + e.game_id, e.cor_image_url]]),
].filter(([, u]) => u) as [string, string][]
for (const [label] of gifts.filter(g => !g.image_url).map(g => ['gift ' + g.game_id + ' ' + g.name])) report(label + ': image_url is empty')

async function status(u: string): Promise<number> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(u, { method: 'HEAD' })
      if (res.status < 500) return res.status
    } catch {}
    await new Promise(r => setTimeout(r, 1000 * (attempt + 1)))
  }
  return 0
}
let next = 0
await Promise.all(Array.from({ length: 16 }, async () => {
  while (next < images.length) {
    const [label, u] = images[next++]
    const s = await status(u)
    if (s !== 200) report(label + ': image ' + (s || 'unreachable') + ' ' + u)
  }
}))

console.log('checked ' + gifts.length + ' gifts, ' + themes.length + ' themes, ' + recipes.length + ' recipes, ' + events.length + ' events, ' + identities.length + ' identities, ' + egos.length + ' E.G.O, ' + images.length + ' images')
if (problems.length) {
  console.error(problems.length + ' problem(s):')
  for (const p of problems) console.error('- ' + p)
  process.exit(1)
}
console.log('no problems found')
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})

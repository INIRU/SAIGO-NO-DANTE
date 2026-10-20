// Reads the public formations and the catalog the recommender needs with the publishable key (SELECT only, same rows the
// site shows anyone) and writes them to .recsys-snapshot/ (git-ignored). Run: node scripts/recommender/export-snapshot.mjs
// Deck/plan author ids, titles and memos are never written: a formation is only identities, E.G.O, floors and a date.
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'

const root = path.resolve(import.meta.dirname, '../..')
const envFile = [path.join(root, '.env.local'), '/Users/iniru/Documents/Project/Limbus/limbus-archive-restored/.env.local'].find(file => fs.existsSync(file))
const env = { ...(envFile ? Object.fromEntries(fs.readFileSync(envFile, 'utf8').split('\n').filter(l => l && !l.startsWith('#') && l.includes('=')).map(l => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1).replace(/^["']|["']$/g, '')] })) : {}), ...process.env }
const url = env.NEXT_PUBLIC_SUPABASE_URL, key = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
if (!url || !key) throw new Error('NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY missing')

async function readAll(table, select, query = '') {
  const rows = []
  for (let from = 0; ; from += 1000) {
    const response = await fetch(`${url}/rest/v1/${table}?select=${encodeURIComponent(select)}${query}`, {
      headers: { apikey: key, Authorization: `Bearer ${key}`, 'Accept-Profile': 'limbus', Range: `${from}-${from + 999}`, 'Range-Unit': 'items' },
    })
    if (!response.ok) throw new Error(`${table}: ${response.status} ${await response.text()}`)
    const page = await response.json()
    rows.push(...page)
    if (page.length < 1000) return rows
  }
}

const out = path.join(root, '.recsys-snapshot')
fs.mkdirSync(out, { recursive: true })
const write = (name, data) => { fs.writeFileSync(path.join(out, `${name}.json`), JSON.stringify(data)); console.log(name, Array.isArray(data) ? data.length : Object.keys(data).length) }

const [identities, skills, passives, egos, gifts, themes, keywords, decks, plans] = await Promise.all([
  readAll('identities', 'id,sinner_id,name_kr,rarity,release_date,keywords,skill_keyword_list,unit_keyword_list,association_list,affiliation,sin_affinity,game_id', '&order=id'),
  readAll('skills', 'identity_id,skill_order,sin_affinity,atk_type,skill_type,uptie_level,variant_order,coins,description', '&skill_order=in.(1,2,3)&order=identity_id,skill_order,uptie_level.desc,variant_order'),
  readAll('passives', 'identity_id,passive_type,passive_order,sin_affinity,sin_count,active_cond,uptie_level,sin_requirements,description', '&order=identity_id,passive_order,uptie_level.desc'),
  readAll('ego', 'id,sinner_id,grade,sin_affinity,keywords,release_date,cost,game_id,name_kr', '&order=id'),
  readAll('ego_gifts', 'game_id,name,keyword,grade,difficulty,enhancement,is_synthesis', '&order=game_id'),
  readAll('ego_gift_themes', 'id,name,difficulty,ego_gift_ids,specific_ego_gift_ids,attribute_type,attack_type,is_hidden,floor_info', '&order=id'),
  readAll('keyword_meta', 'name,category,sin_affinity,effect_type', '&order=name'),
  readAll('decks', 'id,user_id,guest_tag,created_at,vote_count,view_count,main_keywords,content_type,deck_identities(identity_id,slot_order,s1_count,s2_count,s3_count),deck_egos(ego_id,grade)', '&order=id'),
  readAll('md_plans', 'id,user_id,guest_tag,created_at,vote_count,view_count,tags,difficulty,deck,egos,floor_plan', '&order=id'),
])

// Highest uptie, first variant, per skill order / passive order: what the catalog shows.
const bestSkills = []
const seenSkill = new Set()
for (const row of skills) { const k = `${row.identity_id}:${row.skill_order}`; if (seenSkill.has(k)) continue; seenSkill.add(k); bestSkills.push(row) }
const bestPassives = []
const seenPassive = new Set()
for (const row of passives) { const k = `${row.identity_id}:${row.passive_type}:${row.passive_order}`; if (seenPassive.has(k)) continue; seenPassive.add(k); bestPassives.push(row) }

write('identities', identities)
write('skills', bestSkills)
write('passives', bestPassives)
write('egos', egos)
write('gifts', gifts)
write('themes', themes)
write('keywords', keywords)
// Only to keep one author's near-copies on the same side of an evaluation split; the id itself is never written.
const author = row => crypto.createHash('sha256').update(`recsys:${row.user_id ?? row.guest_tag ?? row.id}`).digest('hex').slice(0, 10)
write('decks', decks.map(({ user_id, guest_tag, ...deck }) => ({ ...deck, author: author({ user_id, guest_tag, id: deck.id }) })))
write('plans', plans.map(plan => ({ id: plan.id, author: author(plan), created_at: plan.created_at, vote_count: plan.vote_count, view_count: plan.view_count, tags: plan.tags, difficulty: plan.difficulty, deck: plan.deck, egos: plan.egos, floor_plan: plan.floor_plan })))
write('meta', { exported_at: new Date().toISOString() })

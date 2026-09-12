/** Restore stage-aware EGO passive text, preserving the legacy latest-stage summary. */
import { readFileSync, readdirSync, mkdirSync, writeFileSync, existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { createClient } from '@supabase/supabase-js'
import { loadEgoSyncContext } from './identity-data'
import { passiveStageRange } from './ego-passives'
async function main() {
const source = process.env.LIMBUS_DATA_DIR
if (!source) throw Error('LIMBUS_DATA_DIR is required')
const root = resolve(process.env.LIMBUS_RECOVERY_ROOT || '../assets/recovery-2026-09-10')
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY!, { db: {schema:'limbus'}, auth:{persistSession:false} })
const context = loadEgoSyncContext()
function load(pattern: RegExp) {
  const rows = new Map<number, any>()
  for (const file of readdirSync(source!).sort().filter(f=>pattern.test(f))) for (const row of JSON.parse(readFileSync(join(source!,file),'utf8').replace(/^\uFEFF/,'')).list || []) rows.set(row.id,row)
  return rows
}
const definitions = load(/^ego-(?:\d+|a\d+c\d+p\d+)\.txt$/i)
const passives = load(/^passive-.*\.txt$/i)
const {data:egos,error} = await db.from('ego').select('*, stages:ego_skills(construe_level)').limit(1000)
if(error)throw error
const rows: any[] = [], updates: any[] = []
for(const ego of egos || []) {
  const sourceEgo = definitions.get(Number(ego.game_id))
  if(!sourceEgo)throw Error(`Missing EGO ${ego.game_id}`)
  const maximum = Math.max(...ego.stages.map((s:any)=>s.construe_level))
  const current: any[] = []
  for(const id of new Set<number>([...(sourceEgo.awakeningPassiveList||[]),...(sourceEgo.passiveList||[])])) {
    const def=passives.get(id);if(!def)throw Error(`Missing passive ${id}`)
    const row:any={ego_id:ego.id,game_passive_id:id,...passiveStageRange(def.requireIDList||[])}
    for(const lang of ['kr','en','jp'] as const) {
      const loc=context.passives[lang].get(id)
      if(!loc?.name || !loc.desc)throw Error(`Missing ${lang} passive ${id}`)
      const suffix=lang==='kr'?'':'_'+lang
      row['name'+suffix]=loc.name;row['description'+suffix]=context.formatText(loc.desc,lang)
    }
    rows.push(row);if(maximum>=row.min_stage&&maximum<=row.max_stage)current.push(row)
  }
  const patch:any={}
  for(const suffix of ['','_en','_jp']) {patch['passive_name'+suffix]=current.map(r=>r['name'+suffix]).join('\n\n')||null;patch['passive_content'+suffix]=current.map(r=>r['description'+suffix]).join('\n\n')||null}
  updates.push({id:ego.id,patch})
}
writeFileSync(join(root,'ego-passive-plan.json'),JSON.stringify({rows,updates},null,2))
console.log({egos:updates.length,passives:rows.length,apply:process.argv.includes('--fix')})
if(process.argv.includes('--fix')) {
  const backup=join(root,'before-ego-passives');mkdirSync(backup,{recursive:true})
  for(const table of ['ego','ego_passives']) {const f=join(backup,table+'.json');if(existsSync(f))continue;const {data,error}=await db.from(table).select('*').limit(1000);if(error)throw error;writeFileSync(f,JSON.stringify(data),{flag:'wx'})}
  for(let i=0;i<rows.length;i+=100){const {error}=await db.from('ego_passives').upsert(rows.slice(i,i+100));if(error)throw error}
  for(const {id,patch} of updates){const {error}=await db.from('ego').update(patch).eq('id',id);if(error)throw error}
  const {data,error}=await db.from('ego_passives').select('*').limit(1000);if(error)throw error
  for(const row of rows){const saved=data.find(r=>r.ego_id===row.ego_id&&r.game_passive_id===row.game_passive_id);if(!saved||Object.keys(row).some(k=>saved[k]!==row[k]))throw Error('Passive readback mismatch')}
  console.log({verified:rows.length})
}

}
main().catch(error => { console.error(error.message); process.exitCode = 1 })

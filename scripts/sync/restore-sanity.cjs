/** Restore source-backed sanity text. Default dry run; never deletes existing rows. */
const fs = require('node:fs'), path = require('node:path')
const { createClient } = require('@supabase/supabase-js')
const plain = text => (text || '').replace(/<[^>]*>/g, '').trim()
const parseCondition = id => ({ template: id.replace(/\d+/g, ''), params: (id.match(/\d+/g) || []).map(Number) })
async function main() {
  process.loadEnvFile('.env.local')
  const base = path.resolve(process.env.LIMBUS_RECOVERY_ROOT || '../assets/recovery-2026-09-10')
  const source = path.join(base, 'complete-data'), files = fs.readdirSync(source).sort()
  const read = n => JSON.parse(fs.readFileSync(path.join(source,n),'utf8').replace(/^\uFEFF/,''))
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY, {db:{schema:'limbus'},auth:{persistSession:false}})
  const fetchRows = async table => { const {data,error}=await db.from(table).select('*').limit(10000);if(error)throw error;return data }
  const identities=await fetchRows('identities'), existing=await fetchRows('identity_sanity_conditions')
  const templates=new Map(), panics=new Map(), definitions=new Map()
  for(const locale of ['KR','EN','JP']) {
    const suffix=locale==='KR'?'':'_'+locale.toLowerCase()
    for(const f of files.filter(f=>f.startsWith(locale+'_MentalCondition')&&f.endsWith('.txt'))) for(const x of read(f).dataList||[]) {
      const item=templates.get(x.id)||{id:x.id};item['add_text'+suffix]=plain(x.add);item['min_text'+suffix]=plain(x.min);templates.set(x.id,item)
    }
    for(const f of files.filter(f=>f.startsWith(locale+'_PanicInfo')&&f.endsWith('.txt'))) for(const x of read(f).dataList||[]) {
      const item=panics.get(x.id)||{id:x.id};item['name'+suffix]=plain(x.panicName);item['description'+suffix]=plain(x.panicDescription);panics.set(x.id,item)
    }
  }
  for(const f of files.filter(f=>/^personality-(?:\d+|a\d+c\d+p\d+)\.txt$/.test(f))) for(const x of read(f).list||[]) {
    const prior=definitions.get(String(x.id));if(!prior || (x.updatedDate||0)>=(prior.updatedDate||0)) definitions.set(String(x.id),x)
  }
  const conditions=[], updates=[], usedTemplates=new Set(), usedPanics=new Set(), missing=[]
  const key = r => JSON.stringify([r.identity_id,r.template_id,r.condition_type,r.params,r.sort_order])
  const oldIds = new Map(existing.map(r=>[key(r),r.id]));let nextId=Math.max(0,...existing.map(r=>r.id))+1
  for(const row of identities) {
    const def=definitions.get(String(row.game_id));if(!def){missing.push('identity:'+row.game_id);continue}
    if(panics.has(def.panicType)){usedPanics.add(def.panicType);updates.push({id:row.id,panic_type:def.panicType})}else missing.push('panic:'+def.panicType)
    let sort=0
    for(const mode of ['add','min']) {
      const stages=def.mentalConditionInfo?.[mode]||[]
      // This table serves the current fully uptied identity. Each later source list replaces the earlier list.
      const stage=[...stages].filter(x=>x.level<=4).sort((a,b)=>b.level-a.level)[0]
      for(const condition of stage?.conditionIDList||[]) {
        const parsed=parseCondition(condition.conditionID)
        if(!templates.has(parsed.template)){missing.push(condition.conditionID);continue}
        usedTemplates.add(parsed.template)
        const entry={identity_id:row.id,template_id:parsed.template,condition_type:mode==='add'?'increase':'decrease',params:condition.params||parsed.params,sort_order:++sort}
        entry.id=oldIds.get(key(entry))||nextId++;conditions.push(entry)
      }
    }
  }
  const templateRows=[...usedTemplates].map(id=>templates.get(id)),panicRows=[...usedPanics].map(id=>panics.get(id))
  const report={identities:updates.length,templates:templateRows.length,panics:panicRows.length,conditions:conditions.length,missing:[...new Set(missing)]}
  fs.writeFileSync(path.join(base,'sanity-plan.json'),JSON.stringify({report,templateRows,panicRows,conditions,updates},null,2));console.log(report)
  if(report.missing.length)throw Error('Unresolved source sanity references')
  if(!process.argv.includes('--apply'))return
  const backup=path.join(base,'before-sanity-restore');fs.mkdirSync(backup,{recursive:true})
  for(const table of ['identities','identity_sanity_conditions','mental_condition_templates','panic_types']) {
    const f=path.join(backup,table+'.json');if(!fs.existsSync(f))fs.writeFileSync(f,JSON.stringify(await fetchRows(table)),{flag:'wx'})
  }
  const upsert=async(table,rows)=>{for(let i=0;i<rows.length;i+=100){const {error}=await db.from(table).upsert(rows.slice(i,i+100),{onConflict:'id'});if(error)throw error}}
  await upsert('mental_condition_templates',templateRows);await upsert('panic_types',panicRows);await upsert('identity_sanity_conditions',conditions)
  for(const row of updates){const {error}=await db.from('identities').update({panic_type:row.panic_type}).eq('id',row.id);if(error)throw error}
  const saved=await fetchRows('identity_sanity_conditions');const actual=new Set(saved.map(key))
  if(conditions.some(r=>!actual.has(key(r))))throw Error('Sanity readback mismatch')
  console.log({verifiedConditions:conditions.length})
}
module.exports={parseCondition}
if(require.main===module)main().catch(e=>{console.error(e.message);process.exitCode=1})

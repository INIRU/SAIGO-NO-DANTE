/** Apply a reviewed source audit and EGO keyword links without removing existing entries. */
import { createClient } from '@supabase/supabase-js'
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { loadSourceEgoKeywords } from './identity-data'
import { getKeywordCategory } from '../../lib/keywords/category'

async function main() {
  const [input] = process.argv.slice(2)
  const root = process.env.LIMBUS_RECOVERY_ROOT
  if (!input || !root || !process.env.LIMBUS_DATA_DIR) throw new Error('Provide audit JSON, LIMBUS_RECOVERY_ROOT and LIMBUS_DATA_DIR')
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {db:{schema:'limbus'},auth:{persistSession:false}})
  const audit = JSON.parse(readFileSync(input, 'utf8')) as Array<Record<string, any>>
  const all = async (table: string) => {
    const result: Record<string, any>[] = []
    for (let from=0;;from+=1000) {
      const {data,error}=await db.from(table).select('*').range(from,from+999)
      if(error)throw error
      result.push(...data)
      if(data.length<1000)return result
    }
  }
  const existing = await all('keyword_meta'), egos = await all('ego')
  const byName = new Map(existing.map(row=>[row.name,row]))
  const fields = ['name','description','name_en','name_jp','description_en','description_jp','icon_slug','effect_type','category']
  const keywordChanges = audit.map((row): Record<string, any>=>({...Object.fromEntries(fields.map(key=>[key,row[key] ?? null])), category:getKeywordCategory({name:String(row.name),tag:row.tag,effect_type:row.effect_type})}))
    .filter(row=>fields.some(key=>byName.get(row.name)?.[key]!==row[key]))
  const sources = loadSourceEgoKeywords()
  const egoChanges = egos.flatMap(row=>{
    const source=sources.get(String(row.game_id))
    if(!source)throw new Error(`Missing source EGO ${row.game_id}`)
    const keywords=[...new Set([...(row.keywords??[]),...source.keywords])].sort((a,b)=>a.localeCompare(b,'ko'))
    return JSON.stringify([...(row.keywords??[])].sort((a,b)=>a.localeCompare(b,'ko')))===JSON.stringify(keywords)?[]:[{id:row.id,game_id:row.game_id,keywords}]
  })
  const plan={keywords:keywordChanges,egos:egoChanges}
  if(keywordChanges.length || egoChanges.length || !existsSync(join(root,'keyword-catalog-plan.json'))) writeFileSync(join(root,'keyword-catalog-plan.json'),JSON.stringify(plan,null,2)+'\n')
  console.log({keywords:keywordChanges.length,egos:egoChanges.length,apply:process.argv.includes('--fix')})
  if(!process.argv.includes('--fix'))return
  const backup=join(root,'before-keyword-catalog');mkdirSync(backup,{recursive:true})
  for(const [table,rows] of [['keyword_meta',existing],['ego',egos]] as const) {
    const file=join(backup,table+'.json')
    if(!existsSync(file))writeFileSync(file,JSON.stringify(rows,null,2)+'\n',{flag:'wx'})
  }
  for(let i=0;i<keywordChanges.length;i+=100) {
    const {error}=await db.from('keyword_meta').upsert(keywordChanges.slice(i,i+100),{onConflict:'name'})
    if(error)throw error
  }
  for(const row of egoChanges) {
    const {error}=await db.from('ego').update({keywords:row.keywords}).eq('id',row.id)
    if(error)throw error
  }
  const savedKeywords=new Map((await all('keyword_meta')).map(row=>[row.name,row]))
  for(const row of keywordChanges)if(fields.some(key=>savedKeywords.get(row.name)?.[key]!==row[key]))throw new Error(`Keyword readback mismatch: ${row.name}`)
  const savedEgos=new Map((await all('ego')).map(row=>[row.id,row]))
  for(const row of egoChanges)if(JSON.stringify(savedEgos.get(row.id)?.keywords)!==JSON.stringify(row.keywords))throw new Error(`EGO readback mismatch: ${row.game_id}`)
  console.log({verifiedKeywords:keywordChanges.length,verifiedEgos:egoChanges.length})
}
main().catch(error=>{console.error(error.message);process.exitCode=1})

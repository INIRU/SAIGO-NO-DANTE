/** Match game IDs to verified uploaded artwork. Only image columns are updated. */
const fs=require('node:fs'),path=require('node:path')
const {createClient}=require('@supabase/supabase-js')
async function main(){
 process.loadEnvFile('.env.local');const base=path.resolve(process.argv[2]||'../assets/recovery-2026-09-10')
 const assets=JSON.parse(fs.readFileSync(path.join(base,'artwork-upload-results.json'))).filter(x=>x.status==='verified')
 const keys=new Set(assets.map(x=>x.key));const db=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY,{db:{schema:'limbus'},auth:{persistSession:false}})
 const plan=[],missing=[],backup=path.join(base,'before-artwork-link');fs.mkdirSync(backup,{recursive:true})
 for(const table of ['identities','ego']){
  const {data:rows,error}=await db.from(table).select('*').limit(1000);if(error)throw error
  const dest=path.join(backup,table+'.json');if(!fs.existsSync(dest))fs.writeFileSync(dest,JSON.stringify(rows),{flag:'wx'})
  for(const row of rows){
   const filename=row.game_id+(table==='ego'?'_awaken_profile.webp':'_normal.webp')
   let match=assets.filter(x=>x.key.startsWith(`sinners/${row.sinner_id}/${table==='ego'?'ego':'identities'}/`)&&x.key.endsWith('/'+filename)&&x.key.split('/').length===5)
   if(table==='ego' && match.length===0) match=assets.filter(x=>x.key.startsWith(`sinners/${row.sinner_id}/ego/`)&&x.key.endsWith('/'+row.game_id+'_cg.webp')&&x.key.split('/').length===5)
   if(match.length!==1){missing.push({table,game_id:row.game_id,matches:match.length});continue}
   const key=match[0].key,folder=key.split('/').slice(3,-1).join('/'),patch={folder_name:folder}
   if(table==='identities')patch.bg_image_url=db.storage.from('limbus-assets').getPublicUrl(key).data.publicUrl
   if(table==='ego'){
    const url=k=>db.storage.from('limbus-assets').getPublicUrl(k).data.publicUrl
    patch.image_url=url(key);const cor=key.endsWith('_cg.webp')?key.replace('_cg.webp','_e_cg.webp'):key.replace('_awaken_profile','_erosion_profile');patch.cor_image_url=keys.has(cor)?url(cor):null
   }
   if(Object.entries(patch).some(([k,v])=>row[k]!==v))plan.push({table,id:row.id,game_id:row.game_id,patch})
  }
 }
 fs.writeFileSync(path.join(base,'artwork-link-plan.json'),JSON.stringify({plan,missing},null,2));console.log({updates:plan.length,missing})
 if(missing.length)throw Error('Artwork mappings incomplete')
 if(!process.argv.includes('--apply'))return
 for(const item of plan){const {error}=await db.from(item.table).update(item.patch).eq('id',item.id);if(error)throw error}
 for(const table of ['identities','ego']){const {data,error}=await db.from(table).select('*').limit(1000);if(error)throw error;for(const item of plan.filter(p=>p.table===table)){const row=data.find(r=>r.id===item.id);if(Object.entries(item.patch).some(([k,v])=>row[k]!==v))throw Error('Artwork link readback mismatch')}}
 console.log({verified:plan.length})
}
main().catch(e=>{console.error(e.message);process.exitCode=1})

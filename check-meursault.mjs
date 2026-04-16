import { createClient } from '@supabase/supabase-js'
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const { data: id_row } = await sb.schema('limbus').from('identities').select('id,name').ilike('name', '%뫼르소%').limit(1)
console.log('identity:', id_row)
const id = id_row?.[0]?.id
if (!id) { console.log('not found'); process.exit(1) }
const { data: skills } = await sb.schema('limbus').from('skills').select('name,skill_order,uptie_level,description_en,name_en').eq('identity_id', id).order('uptie_level').order('skill_order')
for (const s of skills ?? []) console.log(`  ${s.name} (${s.skill_order}) uptie${s.uptie_level} | en:${s.name_en} | ${s.description_en?.slice(0,60)}`)

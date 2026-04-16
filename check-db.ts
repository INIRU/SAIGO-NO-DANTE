import { createClient } from '@supabase/supabase-js'
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { db: { schema: 'limbus' } })
// Find meursault identities by game_id range 10501-10599
const { data: ids } = await sb.from('identities').select('id,name,game_id').gte('game_id', '10501').lte('game_id', '10599').limit(20)
console.log('meursault identities:', ids?.map(x => `${x.name}(${x.game_id})`).join(', '))
if (ids?.length) {
  const id = ids[0].id
  const { data: skills } = await sb.from('skills').select('name,skill_order,uptie_level,description_en,name_en').eq('identity_id', id).order('uptie_level').order('skill_order')
  console.log(`\nskills for ${ids[0].name}:`)
  for (const s of skills ?? []) console.log(`  ${s.name} uptie${s.uptie_level} | en:${s.name_en ?? 'NULL'} | ${s.description_en?.slice(0,60) ?? 'NULL'}`)
}

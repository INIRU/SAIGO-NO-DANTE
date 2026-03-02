import { readFileSync } from 'fs'
const env = Object.fromEntries(
  readFileSync(process.cwd() + '/.env.local', 'utf-8')
    .split('\n').filter(l => l.trim() && !l.startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()] })
)
const h = { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: 'Bearer ' + env.SUPABASE_SERVICE_ROLE_KEY, 'Accept-Profile': 'limbus' }
const res = await fetch(env.NEXT_PUBLIC_SUPABASE_URL + '/rest/v1/ego?sinner_id=eq.yi-sang&select=name_kr,ego_skills,ego_cor_skills', { headers: h })
const data = await res.json()

for (const e of data) {
  console.log(`\n========== ${e.name_kr} ==========`)
  for (const list of [e.ego_skills, e.ego_cor_skills]) {
    if (!list) continue
    for (const s of list) {
      const type = list === e.ego_skills ? '각성' : '침식'
      console.log(`\n--- ${type} ${s.construeLevel}해석: ${s.name} ---`)
      console.log(`  normalEffect: "${s.normalEffect || ''}"`)
      if (s.coin1Effect) console.log(`  coin1: "${s.coin1Effect}"`)
      if (s.coin2Effect) console.log(`  coin2: "${s.coin2Effect}"`)
      if (s.coin3Effect) console.log(`  coin3: "${s.coin3Effect}"`)
    }
  }
}

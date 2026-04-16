import { createClient } from '@supabase/supabase-js'
import { readFileSync, readdirSync, existsSync } from 'fs'
import { join, resolve } from 'path'
import { homedir } from 'os'

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

const DATA_DIR = resolve(join(homedir(), 'Documents/Limbus/assets/data/Json (Text)'))
const EN_LATEST_DIR = resolve(join(homedir(), 'Documents/Limbus/assets/data/en'))

function globFiles(dir, pattern) {
  try { return readdirSync(dir).filter(f => pattern.test(f)).sort() } catch { return [] }
}

function readJson(p) {
  try { return JSON.parse(readFileSync(p, 'utf8').replace(/^\uFEFF/, '')) } catch { return null } 
}

// Load EN skills
const skillMap = new Map()
const files = globFiles(EN_LATEST_DIR, /^EN_Skills/i).filter(f => f.endsWith('.json'))
console.log(`EN skill files: ${files.length}`)
for (const f of files) {
  const data = readJson(join(EN_LATEST_DIR, f))
  for (const item of data?.dataList ?? []) {
    const id = item?.id
    if (!id) continue
    const existing = skillMap.get(id)
    if (existing) {
      for (const lvl of item.levelList ?? []) existing.levelList.push(lvl)
    } else {
      skillMap.set(id, { levelList: [...(item.levelList ?? [])] })
    }
  }
}
console.log(`EN skillMap size: ${skillMap.size}`)

// Check skill 1010101 specifically
const s = skillMap.get(1010101)
console.log('EN 1010101:', s ? `found, ${s.levelList.length} levels` : 'NOT FOUND')

// Now get the identity "남부 섕크 협회 4과 부장" id and its skills from DB
const { data: identity } = await sb.schema('limbus').from('identities').select('id,name,game_id').eq('name', '남부 섕크 협회 4과 부장').single()
console.log('Identity:', identity?.id, identity?.game_id)

if (!identity) { console.log('identity not found'); process.exit(1) }

// Get its skills from DB
const { data: dbSkills } = await sb.schema('limbus').from('skills').select('name,skill_order,uptie_level,description_en').eq('identity_id', identity.id).order('uptie_level').order('skill_order')
console.log('DB skills:')
for (const s of dbSkills ?? []) console.log(`  name=${s.name} order=${s.skill_order} uptie=${s.uptie_level} desc_en=${s.description_en}`)

// Load KR skills
const KR_LATEST_DIR = resolve(join(homedir(), 'Documents/Limbus/assets/data/kr'))
const krMap = new Map()
const krFiles = globFiles(KR_LATEST_DIR, /^KR_Skills(?!_Ego).*\.(json|txt)$/i).filter(f => f.endsWith('.json') || f.endsWith('.txt'))
console.log(`\nKR skill files: ${krFiles.length}`)
for (const f of krFiles) {
  const data = readJson(join(KR_LATEST_DIR, f))
  for (const item of data?.dataList ?? []) {
    const id = item?.id
    if (!id) continue
    if (!krMap.has(id)) krMap.set(id, { levelList: [] })
    for (const lvl of item.levelList ?? []) krMap.get(id).levelList.push(lvl)
  }
}
console.log(`KR skillMap size: ${krMap.size}`)

// Load personality for sinner 1 (섕크 = sinner index 01)
// Find game_id of the identity
const gameId = identity.game_id
console.log(`\ngame_id: ${gameId}`)

// Load the personality data file for sinner 1 
const pad = '01'
const personalityData = readJson(join(DATA_DIR, `personality-${pad}.txt`))
const personalities = personalityData?.dataList ?? []
console.log(`Sinner 01 personalities: ${personalities.length}`)
const p = personalities.find(pp => pp.id === gameId)
if (!p) { console.log('personality not found for gameId', gameId); process.exit(1) }
console.log('Found personality, attributeList:', JSON.stringify(p.attributeList))

// Check if EN locale has these skill IDs
for (const a of p.attributeList ?? []) {
  const en = skillMap.get(a.skillId)
  const kr = krMap.get(a.skillId)
  console.log(`  skillId=${a.skillId} EN=${en ? `${en.levelList.length} levels` : 'MISSING'} KR=${kr ? kr.levelList.map(l=>l.name+':'+l.level).join(',') : 'MISSING'}`)
}

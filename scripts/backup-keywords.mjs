#!/usr/bin/env node
/**
 * keyword_meta + identities.keywords + skills 데이터 백업
 *
 * 사용법:
 *   node --env-file=.env.local scripts/backup-keywords.mjs
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { resolve } from 'node:path'

const ROOT = process.cwd()
const envFile = readFileSync(resolve(ROOT, '.env.local'), 'utf-8')
const env = Object.fromEntries(
  envFile.split('\n').filter(l => l.trim() && !l.startsWith('#')).map(l => {
    const idx = l.indexOf('=')
    return [l.slice(0, idx).trim(), l.slice(idx + 1).trim()]
  })
)

const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY = env.SUPABASE_SECRET_KEY
const headers = {
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${SUPABASE_KEY}`,
  'Content-Type': 'application/json',
  'Accept-Profile': 'limbus',
  'Content-Profile': 'limbus',
}

async function supaGet(table, params = '') {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${params}`, { headers })
  if (!res.ok) throw new Error(`GET ${table}: ${res.status} ${await res.text()}`)
  return res.json()
}

async function main() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const backupDir = resolve(ROOT, 'backups', timestamp)
  mkdirSync(backupDir, { recursive: true })

  // 1. keyword_meta 전체 백업
  console.log('=== keyword_meta 백업 ===')
  const keywords = await supaGet('keyword_meta', 'select=*&order=name&limit=2000')
  writeFileSync(resolve(backupDir, 'keyword_meta.json'), JSON.stringify(keywords, null, 2))
  console.log(`  ${keywords.length}개 키워드 백업 완료`)

  // 2. identities (id, name, keywords) 백업
  console.log('=== identities.keywords 백업 ===')
  const identities = await supaGet('identities', 'select=id,name,game_id,keywords&order=id&limit=2000')
  writeFileSync(resolve(backupDir, 'identities_keywords.json'), JSON.stringify(identities, null, 2))
  console.log(`  ${identities.length}개 인격 백업 완료`)

  // 3. skills (id, identity_id, name, description, keywords 관련 필드) 백업
  console.log('=== skills 백업 ===')
  const skills = await supaGet('skills', 'select=id,identity_id,name,description,skill_type,uptie_level,skill_order&order=id&limit=10000')
  writeFileSync(resolve(backupDir, 'skills.json'), JSON.stringify(skills, null, 2))
  console.log(`  ${skills.length}개 스킬 백업 완료`)

  // 4. ego (id, name, keywords) 백업
  console.log('=== ego.keywords 백업 ===')
  const ego = await supaGet('ego', 'select=id,name,game_id,keywords&order=id&limit=2000')
  writeFileSync(resolve(backupDir, 'ego_keywords.json'), JSON.stringify(ego, null, 2))
  console.log(`  ${ego.length}개 EGO 백업 완료`)

  // 5. ego_gifts activation_condition 백업
  console.log('=== ego_gifts 백업 ===')
  const gifts = await supaGet('ego_gifts', 'select=id,name,game_id,activation_condition,keyword&order=id&limit=2000')
  writeFileSync(resolve(backupDir, 'ego_gifts.json'), JSON.stringify(gifts, null, 2))
  console.log(`  ${gifts.length}개 EGO 기프트 백업 완료`)

  console.log(`\n✅ 백업 완료: ${backupDir}`)

  // 6. 중복 키워드 분석
  console.log('\n=== 중복 키워드 분석 ===')
  const nameSet = new Map()
  const duplicates = []

  for (const kw of keywords) {
    // 대괄호 내용 제거한 것과 원본 비교
    const stripped = kw.name
      .replace(/【[^】]*】/g, '')
      .replace(/\[[^\]]*\]/g, '')
      .replace(/\s+/g, ' ')
      .trim()

    if (nameSet.has(stripped)) {
      duplicates.push({ original: nameSet.get(stripped), duplicate: kw.name, strippedForm: stripped })
    } else {
      nameSet.set(stripped, kw.name)
    }
  }

  // 띄어쓰기 차이 중복 분석
  const spaceNormalized = new Map()
  for (const kw of keywords) {
    const normalized = kw.name.replace(/\s+/g, '').replace(/-/g, '')
    if (spaceNormalized.has(normalized)) {
      const existing = spaceNormalized.get(normalized)
      if (existing !== kw.name) {
        duplicates.push({ original: existing, duplicate: kw.name, strippedForm: `[spacing] ${normalized}` })
      }
    } else {
      spaceNormalized.set(normalized, kw.name)
    }
  }

  if (duplicates.length > 0) {
    console.log(`\n⚠️  ${duplicates.length}개 중복 의심 키워드:`)
    for (const d of duplicates) {
      console.log(`  "${d.original}" ↔ "${d.duplicate}" (${d.strippedForm})`)
    }
    writeFileSync(resolve(backupDir, 'duplicates.json'), JSON.stringify(duplicates, null, 2))
  } else {
    console.log('  중복 없음')
  }
}

main().catch(e => { console.error(e); process.exit(1) })

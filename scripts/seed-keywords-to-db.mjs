/**
 * keyword-descriptions.ts → keyword_meta DB 시딩
 * 실행: node --env-file=.env.local scripts/seed-keywords-to-db.mjs
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 필요')
  process.exit(1)
}

// ── keyword-descriptions.ts 파싱 ───────────────────────────────────
const tsPath = path.join(__dirname, '..', 'lib', 'data', 'keyword-descriptions.ts')
const raw = fs.readFileSync(tsPath, 'utf-8')

const entries = []
// 각 라인: '키워드명': { desc: '...', maxStack: N },
const re = /^\s*'([^']+)':\s*\{\s*desc:\s*'((?:[^'\\]|\\.)*)'\s*(?:,\s*maxStack:\s*(\d+)\s*)?\}/gm
let m
while ((m = re.exec(raw)) !== null) {
  entries.push({
    name: m[1],
    description: m[2].replace(/\\'/g, "'").replace(/\\n/g, '\n'),
    max_stack: m[3] ? parseInt(m[3]) : null,
  })
}

console.log(`파싱 완료: ${entries.length}개 키워드`)

if (entries.length === 0) {
  console.error('키워드를 파싱하지 못했습니다. keyword-descriptions.ts 형식을 확인해주세요.')
  process.exit(1)
}

// ── DB upsert (50개씩 배치) ─────────────────────────────────────────
const headers = {
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${SUPABASE_KEY}`,
  'Content-Type': 'application/json',
  'Content-Profile': 'limbus',
  'Accept-Profile': 'limbus',
  Prefer: 'resolution=merge-duplicates,return=minimal',
}

const BATCH = 50
let upserted = 0

for (let i = 0; i < entries.length; i += BATCH) {
  const batch = entries.slice(i, i + BATCH)
  const res = await fetch(`${SUPABASE_URL}/rest/v1/keyword_meta`, {
    method: 'POST',
    headers,
    body: JSON.stringify(batch),
  })

  if (!res.ok) {
    const err = await res.text()
    console.error(`배치 ${i}-${i + batch.length} 실패: ${res.status} ${err}`)
  } else {
    upserted += batch.length
    console.log(`  upserted ${i + 1}~${i + batch.length}`)
  }
}

console.log(`\n완료: ${upserted}/${entries.length}개 키워드 DB 삽입`)

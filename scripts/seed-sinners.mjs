/**
 * scripts/seed-sinners.mjs
 * data/sinners.json → Supabase limbus.sinners 동기화
 *
 * 실행: node scripts/seed-sinners.mjs
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ .env.local에서 SUPABASE_URL / SERVICE_ROLE_KEY를 설정해주세요.')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

const sinners = JSON.parse(
  readFileSync(join(__dirname, '../data/sinners.json'), 'utf8')
)

console.log(`📋 ${sinners.length}개 수감자 데이터를 Supabase에 동기화 중...\n`)

// supabase-js .schema()는 Supabase 대시보드 → Settings → API → Extra search path에
// 'limbus'가 등록돼 있어야 작동합니다.
// 등록이 안 된 경우를 위해 fetch로 직접 스키마 헤더를 보냅니다.
const res = await fetch(`${SUPABASE_URL}/rest/v1/sinners`, {
  method: 'POST',
  headers: {
    apikey:            SUPABASE_KEY,
    Authorization:     `Bearer ${SUPABASE_KEY}`,
    'Content-Type':    'application/json',
    'Accept-Profile':  'limbus',
    'Content-Profile': 'limbus',
    Prefer:            'resolution=merge-duplicates',
  },
  body: JSON.stringify(sinners),
})

if (!res.ok) {
  const body = await res.text()
  console.error(`❌ 동기화 실패 (HTTP ${res.status}):`, body)
  process.exit(1)
}

console.log('✅ 완료: limbus.sinners 테이블 업데이트됨')
console.log('\n수감자 목록:')
sinners.forEach(s => console.log(`  ${String(s.order_num).padStart(2,'0')}. ${s.name_kr} (${s.name})`))

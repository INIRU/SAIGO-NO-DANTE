/**
 * 덱 노트의 옛 스킬 토큰을 새 형식으로 마이그레이션
 *
 * 변경: [s:수감자:5] → [s:수감자:3:1], [s:수감자:6] → [s:수감자:3:2] 등
 * (skill_order >= 5는 S3의 변형이므로 base 3 + subIdx로 변환)
 *
 * 사용법:
 *   node --env-file=.env.local scripts/migrate-skill-tokens.mjs --dry-run
 *   node --env-file=.env.local scripts/migrate-skill-tokens.mjs --fix
 */

import { createClient } from '@supabase/supabase-js'

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const dryRun = !process.argv.includes('--fix')

if (dryRun) console.log('=== DRY RUN (--fix 없이 실행) ===\n')

// skill_order >= 5인 토큰 패턴: [s:이름:5], [s:이름:6] 등
const TOKEN_RE = /\[s:([^:\]]+):(\d+)\]/g

function migrateDescription(desc) {
  let changed = false
  const result = desc.replace(TOKEN_RE, (match, name, orderStr) => {
    const order = parseInt(orderStr)
    if (order < 5) return match
    // skill_order 5 → base 3, subIdx 1 → [s:name:3:1]
    // skill_order 6 → base 3, subIdx 2 → [s:name:3:2]
    const subIdx = order - 4
    changed = true
    return `[s:${name}:3:${subIdx}]`
  })
  return { result, changed }
}

async function main() {
  // 모든 덱의 description 가져오기
  const { data: decks, error } = await sb
    .schema('limbus')
    .from('decks')
    .select('id, title, description')
    .not('description', 'is', null)

  if (error) {
    console.error('덱 조회 실패:', error.message)
    process.exit(1)
  }

  let updatedCount = 0

  for (const deck of decks) {
    if (!deck.description) continue
    const { result, changed } = migrateDescription(deck.description)
    if (!changed) continue

    updatedCount++
    console.log(`[${deck.id}] ${deck.title}`)

    // 변경된 토큰 표시
    const oldTokens = [...deck.description.matchAll(TOKEN_RE)]
      .filter(m => parseInt(m[2]) >= 5)
    for (const m of oldTokens) {
      const order = parseInt(m[2])
      const subIdx = order - 4
      console.log(`  ${m[0]} → [s:${m[1]}:3:${subIdx}]`)
    }

    if (!dryRun) {
      const { error: updateErr } = await sb
        .schema('limbus')
        .from('decks')
        .update({ description: result })
        .eq('id', deck.id)
      if (updateErr) {
        console.log(`  ❌ 업데이트 실패: ${updateErr.message}`)
      } else {
        console.log(`  ✅ 업데이트 완료`)
      }
    }
  }

  console.log(`\n총 ${decks.length}개 덱 중 ${updatedCount}개 변경 ${dryRun ? '예정' : '완료'}`)
}

main()

#!/usr/bin/env tsx
/**
 * game-text-refs.ts
 * limbus.game_text_refs 동기화: KR/EN/JP BattleKeywords·SkillTag 원문을 id별 이름·설명으로 저장하고,
 * 공백을 무시한 KR 이름이 같은 keyword_meta 행을 keyword_name으로 잇는다.
 *
 * Usage:
 *   LIMBUS_DATA_DIR=<complete-data> npx tsx scripts/sync/game-text-refs.ts [--fix]
 *
 * Options:
 *   --dry-run   비교만 (기본값)
 *   --fix       변경·신규 행을 upsert (행은 지우지 않는다)
 */

import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { buildGameTextRefs, diffGameTextRefs, readGameTextSources, type GameTextRefRow } from './game-text-refs-rules'
import { gameDataPaths, implicitDataDirWarning } from './source-paths'
import { failOnLoggedErrors, printSyncSummary } from './sync-result'

config({ path: '.env.local' })

const FIX = process.argv.slice(2).includes('--fix')
const PAGE = 1000
const BATCH = 500

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
if (!supabaseUrl || !supabaseKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY/SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}
const supabase = createClient(supabaseUrl, supabaseKey)

async function triggerRevalidation(options: { scope?: 'all-game-data' | 'announcements' } = {}): Promise<void> {
  const siteUrl = process.env.SITE_URL || process.env.NEXT_PUBLIC_SITE_URL
  const secret = process.env.REVALIDATION_SECRET
  if (!siteUrl || !secret) {
    console.warn('[sync] SITE_URL or REVALIDATION_SECRET not set — skipping revalidate')
    return
  }

  try {
    const res = await fetch(`${siteUrl}/api/revalidate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-revalidation-secret': secret,
      },
      body: JSON.stringify({ scope: options.scope ?? 'all-game-data' }),
    })
    if (!res.ok) {
      console.warn(`[sync] revalidate call failed: ${res.status} ${res.statusText}`)
      return
    }
    const data = await res.json().catch(() => ({}))
    console.log('[sync] revalidated:', (data as { revalidated?: unknown }).revalidated)
  } catch (err) {
    console.warn('[sync] revalidate call threw:', err instanceof Error ? err.message : err)
  }
}

const SELECT = 'id, kind, name, name_en, name_jp, description, description_en, description_jp, keyword_name'

/** PostgREST / Postgres "table does not exist": the migration has not been applied yet. */
const isMissingTable = (error: { code?: string; message?: string }) =>
  error.code === 'PGRST205' || error.code === '42P01' || /could not find the table|does not exist/i.test(error.message ?? '')

async function fetchKeywordMetaNames(): Promise<string[]> {
  const names: string[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase.schema('limbus').from('keyword_meta').select('name').order('name').range(from, from + PAGE - 1)
    if (error) throw new Error(`keyword_meta 조회 실패: ${error.message}`)
    if (!data?.length) break
    names.push(...data.map(row => row.name as string))
    if (data.length < PAGE) break
  }
  return names
}

/** Stored rows; null when the table does not exist yet. */
async function fetchStoredRows(): Promise<GameTextRefRow[] | null> {
  const rows: GameTextRefRow[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase.schema('limbus').from('game_text_refs').select(SELECT).order('id').range(from, from + PAGE - 1)
    if (error) {
      if (isMissingTable(error)) return null
      throw new Error(`game_text_refs 조회 실패: ${error.message}`)
    }
    if (!data?.length) break
    rows.push(...(data as GameTextRefRow[]))
    if (data.length < PAGE) break
  }
  return rows
}

async function main(): Promise<void> {
  const { data: dataDir } = gameDataPaths()
  console.log('게임 텍스트 참조 표 동기화')
  console.log(`모드: ${FIX ? '--fix (DB 수정)' : '--dry-run (비교만)'}`)
  console.log(`데이터: ${dataDir}`)
  const pathWarning = implicitDataDirWarning('게임 텍스트 참조 표', dataDir)
  if (pathWarning) console.warn(pathWarning)

  const sources = readGameTextSources(dataDir)
  const keywordMetaNames = await fetchKeywordMetaNames()
  const rows = buildGameTextRefs({ ...sources, keywordMetaNames })
  const keywords = rows.filter(row => row.kind === 'keyword')
  if (!keywords.length || !rows.some(row => row.kind === 'skilltag')) {
    throw new Error(`BattleKeywords/SkillTag 항목이 없습니다 (${dataDir} 에 {KR,EN,JP} 폴더가 있는지 확인)`)
  }
  const matched = keywords.filter(row => row.keyword_name).length
  console.log(`원문: 키워드 ${keywords.length}종, SkillTag ${rows.length - keywords.length}종, keyword_meta ${keywordMetaNames.length}개`)

  const stored = await fetchStoredRows()
  if (stored === null) {
    if (FIX) throw new Error('limbus.game_text_refs 표가 없습니다. 마이그레이션 20261001023933_game_text_refs.sql을 먼저 적용하세요.')
    console.log('  game_text_refs 표가 아직 없습니다 (마이그레이션 미적용): 저장된 행을 비어 있는 것으로 보고 비교합니다.')
  }
  const { created, changed, unchanged } = diffGameTextRefs(stored ?? [], rows)
  const known = new Set(rows.map(row => row.id))
  const missingFromSource = (stored ?? []).filter(row => !known.has(row.id)).length
  console.log(`  신규 ${created.length}, 변경 ${changed.length}, 동일 ${unchanged.length}, 원문에 없는 DB 행 ${missingFromSource} (지우지 않음)`)
  console.log(`  keyword_name 연결 ${matched}, 미연결 ${keywords.length - matched} (키워드 기준)`)

  const writes = [...created, ...changed]
  if (FIX && writes.length) {
    const now = new Date().toISOString()
    let applied = 0
    for (let i = 0; i < writes.length; i += BATCH) {
      const batch = writes.slice(i, i + BATCH).map(row => ({ ...row, updated_at: now }))
      const { error } = await supabase.schema('limbus').from('game_text_refs').upsert(batch, { onConflict: 'id' })
      if (error) console.error(`  ❌ 배치 ${i + 1}~${i + batch.length} 실패: ${error.message}`)
      else { applied += batch.length; console.log(`  ✅ ${i + 1}~${i + batch.length} 저장`) }
    }
    // Rows changed: drop the site's cached game data (the table is read through the game-text-refs tag).
    if (applied > 0) await triggerRevalidation({ scope: 'all-game-data' })
  } else if (!FIX) {
    console.log('  --dry-run 모드. DB 수정 없음. (--fix 옵션으로 반영)')
  }

  printSyncSummary({
    gameTextRefs: {
      new: created.length,
      changed: changed.length,
      unchanged: unchanged.length,
      missingFromSource,
      keywordMatched: matched,
      keywordUnmatched: keywords.length - matched,
      tableMissing: stored === null,
    },
  })
}

failOnLoggedErrors()
main().catch(err => {
  console.error('\n❌ 오류 발생:', (err as Error).message)
  process.exit(1)
})

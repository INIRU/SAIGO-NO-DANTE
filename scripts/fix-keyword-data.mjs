#!/usr/bin/env node
/**
 * 키워드 데이터 정리 스크립트
 *
 * 게임 클라이언트 JSON 기준으로 keyword_meta + identities.keywords + ego.keywords 수정.
 * - 【】→ [] 괄호 변환 (게임 원본 기준)
 * - 띄어쓰기/특수문자 중복 제거
 * - 한자 오류 수정
 *
 * 사용법:
 *   node --env-file=.env.local scripts/fix-keyword-data.mjs --dry-run
 *   node --env-file=.env.local scripts/fix-keyword-data.mjs --fix
 */

import { readFileSync } from 'node:fs'
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
const SUPABASE_KEY = env.SUPABASE_SERVICE_ROLE_KEY
const headers = {
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${SUPABASE_KEY}`,
  'Content-Type': 'application/json',
  'Accept-Profile': 'limbus',
  'Content-Profile': 'limbus',
}

const autoFix = process.argv.includes('--fix')
const dryRun = !autoFix

async function supaGet(table, params = '') {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${params}`, { headers })
  if (!res.ok) throw new Error(`GET ${table}: ${res.status} ${await res.text()}`)
  return res.json()
}

async function supaPatch(table, filterParams, data) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${filterParams}`, {
    method: 'PATCH',
    headers: { ...headers, Prefer: 'return=minimal' },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error(`PATCH ${table}: ${res.status} ${await res.text()}`)
}

async function supaDelete(table, filterParams) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${filterParams}`, {
    method: 'DELETE',
    headers: { ...headers, Prefer: 'return=minimal' },
  })
  if (!res.ok) throw new Error(`DELETE ${table}: ${res.status} ${await res.text()}`)
}

async function supaInsert(table, data) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: { ...headers, Prefer: 'return=representation,resolution=merge-duplicates' },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error(`INSERT ${table}: ${res.status} ${await res.text()}`)
  return res.json()
}

// ══════════════════════════════════════════════════════════════════
// 수정 목록: [DB 현재값, 게임 원본값]
// ══════════════════════════════════════════════════════════════════

// 1. 괄호 변환 (DB 【】 → 게임 [])
const BRACKET_RENAMES = [
  ['나생【羅生】', '나생[羅生]'],
  ['대【待】', '대[待]'],
  ['매화첨【埋花櫼】', '매화첨[埋花櫼]'],
  ['매화침【埋花針】', '매화침[埋花針]'],
  ['발각【發角】', '발각[發角]'],
  ['불허【不許】', '불허[不許]'],
  ['사중구활【死中求活】', '사중구활[死中求活]'],
  ['시【始】', '시[始]'],
  ['원【援】', '원[援]'],
  ['재장전【포자보충】', '재장전[포자보충]'],
  ['포자탄【기본】', '포자탄[기본]'],
  ['포자탄【산탄】', '포자탄[산탄]'],
  ['호넷【라이플】', '호넷[라이플]'],
  ['호넷【샷건】', '호넷[샷건]'],
  ['지령【단말기】 I', '지령[단말기] I'],
  ['지령【단말기】 II', '지령[단말기] II'],
  ['지령【단말기】 III', '지령[단말기] III'],
  ['지령【단말기】 IV', '지령[단말기] IV'],
  ['지령【쪽지】 I', '지령[쪽지] I'],
  ['지령【쪽지】 II', '지령[쪽지] II'],
  ['지령【쪽지】 III', '지령[쪽지] III'],
  ['지령【쪽지】 IV', '지령[쪽지] IV'],
  // 괄호 + 한자 오류
  ['흑수환염【黑獸丸染】', '흑수환염[黑獣丸染]'],
]

// 2. 해금: 로마 숫자 특수문자 → 라틴 문자 (게임 원본)
const HAEGEUM_RENAMES = [
  ['해금 - Ⅰ', '해금 - I'],
  ['해금 - Ⅱ', '해금 - II'],
  ['해금 - Ⅲ', '해금 - III'],
]

// 3. 띄어쓰기 중복 → 게임 원본이 아닌 쪽 삭제 (참조를 올바른 쪽으로 이동)
const SPACING_DELETES = [
  // [삭제할 잘못된 형태, 올바른 게임 형태]
  ['신(心)-대행', '신(心) - 대행'],
  ['역변 - 리버스드', '역변-리버스드'],
  ['진동-작열', '진동 - 작열'],
  ['탄환-고독', '탄환 - 고독'],
  ['E.G.O 자원 획득량+', 'E.G.O 자원 획득량 +'],
]

// 4. 삭제 목록 (중복/아티팩트)
const PURE_DELETES = [
  // 대괄호 제거된 중복
  ['흑수환염', '흑수환염[黑獣丸染]'],
  ['사중구활', '사중구활[死中求活]'],
  // 나무위키 각주 아티팩트
  ['가열된 가스 작살【21】', '가열된 가스 작살'],
  ['과열된 가스 작살【22】', '과열된 가스 작살'],
  // 잘못된 괄호 형태 중복
  ['일렁임 [혈귀]', '일렁임【혈귀】'],
  // 해금 띄어쓰기 중복
  ['해금-Ⅰ', '해금 - I'],
  ['해금-Ⅱ', '해금 - II'],
  ['해금-Ⅲ', '해금 - III'],
  ['해금 -Ⅰ', '해금 - I'],
  ['해금 -Ⅱ', '해금 - II'],
  // 로마 숫자 중복 (지령쪽지)
  ['지령【쪽지】 Ⅰ', '지령[쪽지] I'],
  ['지령【쪽지】 Ⅱ', '지령[쪽지] II'],
  ['지령【쪽지】 Ⅲ', '지령[쪽지] III'],
  ['지령【쪽지】 Ⅳ', '지령[쪽지] IV'],
  // 게임에 없는 standalone
  ['지령【단말기】', '지령'],
  ['지령【단말기】 III - 검지 아비', '지령[단말기] III'],
]

// ══════════════════════════════════════════════════════════════════

async function main() {
  console.log(`\n${'='.repeat(60)}`)
  console.log(`키워드 데이터 정리 (${dryRun ? 'DRY-RUN' : '⚠️  FIX 모드'})`)
  console.log(`${'='.repeat(60)}\n`)

  // 현재 DB 상태 로드
  const allKeywords = await supaGet('keyword_meta', 'select=*&order=name&limit=2000')
  const kwMap = new Map(allKeywords.map(k => [k.name, k]))
  console.log(`keyword_meta: ${allKeywords.length}개 로드`)

  const allIdentities = await supaGet('identities', 'select=id,name,keywords&order=id&limit=2000')
  console.log(`identities: ${allIdentities.length}개 로드`)

  const allEgo = await supaGet('ego', 'select=id,name,keywords&order=id&limit=2000')
  console.log(`ego: ${allEgo.length}개 로드`)

  let renamedCount = 0
  let deletedCount = 0
  let refsUpdated = 0

  // ── 참조 업데이트 헬퍼 ──
  async function updateRefs(oldName, newName) {
    // identities.keywords 배열 업데이트
    for (const ident of allIdentities) {
      if (!ident.keywords || !ident.keywords.includes(oldName)) continue
      const updated = ident.keywords.map(k => k === oldName ? newName : k)
      // 중복 제거 (이미 newName이 있는 경우)
      const deduped = [...new Set(updated)]
      console.log(`    📝 identity "${ident.name}": "${oldName}" → "${newName}"`)
      if (!dryRun) {
        await supaPatch('identities', `id=eq.${ident.id}`, { keywords: deduped })
      }
      ident.keywords = deduped  // 로컬 캐시도 업데이트
      refsUpdated++
    }

    // ego.keywords 배열 업데이트
    for (const ego of allEgo) {
      if (!ego.keywords || !ego.keywords.includes(oldName)) continue
      const updated = ego.keywords.map(k => k === oldName ? newName : k)
      const deduped = [...new Set(updated)]
      console.log(`    📝 ego "${ego.name}": "${oldName}" → "${newName}"`)
      if (!dryRun) {
        await supaPatch('ego', `id=eq.${ego.id}`, { keywords: deduped })
      }
      ego.keywords = deduped
      refsUpdated++
    }
  }

  // ── keyword_meta 이름 변경 ──
  async function renameKeyword(oldName, newName) {
    const oldEntry = kwMap.get(oldName)
    if (!oldEntry) {
      console.log(`  ⏭️  "${oldName}" → DB에 없음, 스킵`)
      return false
    }

    const existingNew = kwMap.get(newName)
    console.log(`  🔄 "${oldName}" → "${newName}"`)

    if (!dryRun) {
      if (!existingNew) {
        // 새 이름으로 INSERT (기존 데이터 복사)
        await supaInsert('keyword_meta', {
          name: newName,
          description: oldEntry.description,
          max_stack: oldEntry.max_stack,
          icon_slug: oldEntry.icon_slug,
          sin_affinity: oldEntry.sin_affinity,
        })
      } else {
        // 이미 존재하면 icon_slug/sin_affinity가 비어있으면 채워넣기
        const patch = {}
        if (!existingNew.icon_slug && oldEntry.icon_slug) patch.icon_slug = oldEntry.icon_slug
        if (!existingNew.sin_affinity && oldEntry.sin_affinity) patch.sin_affinity = oldEntry.sin_affinity
        if (!existingNew.description && oldEntry.description) patch.description = oldEntry.description
        if (Object.keys(patch).length > 0) {
          await supaPatch('keyword_meta', `name=eq.${encodeURIComponent(newName)}`, patch)
        }
      }
    }

    // 참조 업데이트
    await updateRefs(oldName, newName)

    // 이전 항목 삭제
    if (!dryRun) {
      await supaDelete('keyword_meta', `name=eq.${encodeURIComponent(oldName)}`)
    }
    kwMap.delete(oldName)
    renamedCount++
    return true
  }

  // ── keyword_meta 삭제 (참조를 올바른 이름으로 이동 후) ──
  async function deleteKeyword(wrongName, correctName) {
    const entry = kwMap.get(wrongName)
    if (!entry) {
      console.log(`  ⏭️  "${wrongName}" → DB에 없음, 스킵`)
      return false
    }

    console.log(`  🗑️  "${wrongName}" (→ refs를 "${correctName}"로 이동)`)

    // 참조를 올바른 이름으로 이동
    await updateRefs(wrongName, correctName)

    // 올바른 keyword_meta에 icon_slug 등 없으면 채워넣기
    const correctEntry = kwMap.get(correctName)
    if (correctEntry && !dryRun) {
      const patch = {}
      if (!correctEntry.icon_slug && entry.icon_slug) patch.icon_slug = entry.icon_slug
      if (!correctEntry.sin_affinity && entry.sin_affinity) patch.sin_affinity = entry.sin_affinity
      if (Object.keys(patch).length > 0) {
        await supaPatch('keyword_meta', `name=eq.${encodeURIComponent(correctName)}`, patch)
      }
    }

    // 삭제
    if (!dryRun) {
      await supaDelete('keyword_meta', `name=eq.${encodeURIComponent(wrongName)}`)
    }
    kwMap.delete(wrongName)
    deletedCount++
    return true
  }

  // ══════════════════════════════════════════════════════════════
  // 실행
  // ══════════════════════════════════════════════════════════════

  // 1. 괄호 변환 (【】→ [])
  console.log('\n── 1. 괄호 변환 (【】→ []) ──')
  for (const [oldName, newName] of BRACKET_RENAMES) {
    await renameKeyword(oldName, newName)
  }

  // 2. 해금 문자 변환
  console.log('\n── 2. 해금 로마숫자 → 라틴 ──')
  for (const [oldName, newName] of HAEGEUM_RENAMES) {
    await renameKeyword(oldName, newName)
  }

  // 3. 띄어쓰기 중복 삭제
  console.log('\n── 3. 띄어쓰기 중복 삭제 ──')
  for (const [wrongName, correctName] of SPACING_DELETES) {
    await deleteKeyword(wrongName, correctName)
  }

  // 4. 기타 중복/아티팩트 삭제
  console.log('\n── 4. 중복/아티팩트 삭제 ──')
  for (const [wrongName, correctName] of PURE_DELETES) {
    await deleteKeyword(wrongName, correctName)
  }

  // ── 결과 ──
  console.log(`\n${'='.repeat(60)}`)
  console.log(`결과: ${renamedCount}개 이름 변경, ${deletedCount}개 삭제, ${refsUpdated}개 참조 수정`)
  if (dryRun) {
    console.log('⚠️  DRY-RUN 모드 — DB 변경 없음. --fix로 실행하면 반영됩니다.')
  } else {
    console.log('✅ DB 수정 완료!')
  }
  console.log(`${'='.repeat(60)}\n`)
}

main().catch(e => { console.error(e); process.exit(1) })

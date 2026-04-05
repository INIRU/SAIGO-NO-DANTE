#!/usr/bin/env node
/**
 * sync-ego-gifts-gamedata.mjs
 * 게임 클라이언트 추출 JSON → Supabase ego_gifts + ego_gift_themes 동기화
 *
 * Usage:
 *   node --env-file=.env.local scripts/sync-ego-gifts-gamedata.mjs [options]
 *
 * Options:
 *   --dry-run       비교만 (기본값)
 *   --fix           DB 자동 수정
 *   --data-dir PATH 게임 JSON 디렉토리 (기본: ~/Documents/Limbus/assets/data/Json-2)
 *   --verbose       상세 로그
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync, readdirSync } from 'fs'
import { join, resolve } from 'path'
import { homedir } from 'os'

// ── CLI args ─────────────────────────────────────────────────────────────────
const args = process.argv.slice(2)
const FIX = args.includes('--fix')
const VERBOSE = args.includes('--verbose')
const dataDirArg = args.find((_, i, a) => a[i - 1] === '--data-dir')
const DATA_DIR = resolve(dataDirArg || join(homedir(), 'Documents/Limbus/assets/data/Json-2'))

// ── Supabase ─────────────────────────────────────────────────────────────────
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!supabaseUrl || !supabaseKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}
const supabase = createClient(supabaseUrl, supabaseKey)

// ── 매핑 테이블 ──────────────────────────────────────────────────────────────
const ATTR_TO_KEYWORD = {
  CRIMSON: '화상', SCARLET: '출혈', INDIGO: '진동',
  AMBER: '파열', AZURE: '침잠', SHAMROCK: '호흡', VIOLET: '충전',
}

const KEYWORD_EN_TO_KR = {
  Combustion: '화상', Laceration: '출혈', Vibration: '진동',
  Burst: '파열', Sinking: '침잠', Breath: '호흡', Charge: '충전',
  Random: '무작위', Slash: '참격', Penetrate: '관통', Hit: '타격',
  None: '공통', Common: '공통',
  // cleanDesc용 합성 키워드
  Burn: '화상', Bleed: '출혈', Rupture: '파열', Poise: '호흡',
  VibrationExplosion: '진동 폭발', Switch_Vibration: '진동 전환',
  FusionVibration: '합성 진동', VibrationDistribution: '진동-분배',
  Binding: '속박', DefenseDown: '방어 레벨 감소', AttackUp: '공격 레벨 증가',
  Enhancement: '위력 증가', Vulnerable: '취약', Fragile: '취약',
  Blunt: '타격', Slash: '참격', Penetrate: '관통',
}

function parseGrade(tags) {
  for (const tag of tags || []) {
    if (tag === 'TIER_EX') return 'EX'
    const m = tag.match(/^TIER_(\d)$/)
    if (m) return m[1]
  }
  return '1'
}

function isBuyDisabled(tags) {
  return (tags || []).includes('NO_SALE')
}

// BattleKeywords 로컬라이즈에서 전체 매핑 로드 (lazy)
let _battleKeywordMap = null
function getBattleKeywordMap() {
  if (_battleKeywordMap) return _battleKeywordMap
  _battleKeywordMap = { ...KEYWORD_EN_TO_KR }
  try {
    const krDir = join(DATA_DIR, 'KR')
    for (const fn of readdirSync(krDir)) {
      if (fn.startsWith('KR_BattleKeywords') && fn.endsWith('.json')) {
        const data = loadJson(join(krDir, fn))
        for (const item of data.dataList || []) {
          if (item.id && item.name && !_battleKeywordMap[item.id]) {
            _battleKeywordMap[item.id] = item.name
          }
        }
      }
    }
  } catch { /* ignore */ }
  if (VERBOSE) console.log(`  배틀 키워드 매핑: ${Object.keys(_battleKeywordMap).length}종`)
  return _battleKeywordMap
}

function cleanDesc(desc) {
  if (!desc) return null
  let cleaned = desc
    .replace(/<style="[^"]*">/g, '')
    .replace(/<\/style>/g, '')
  // 영문 키워드 → 한글 치환 + 대괄호 제거 (키워드 매핑 호환)
  const map = getBattleKeywordMap()
  cleaned = cleaned.replace(/\[([A-Za-z_]+)\]/g, (match, key) => {
    return map[key] ? map[key] : match
  })
  return cleaned.trim()
}

// ── JSON 로더 ────────────────────────────────────────────────────────────────
function loadJson(path) {
  return JSON.parse(readFileSync(path, 'utf-8'))
}

function loadJsonGlob(dir, pattern) {
  const files = readdirSync(dir).filter(f => f.match(pattern)).sort()
  const items = []
  for (const f of files) {
    const data = loadJson(join(dir, f))
    const list = data.list || data.dataList || []
    items.push(...list)
    if (VERBOSE) console.log(`  ${f}: ${list.length} items`)
  }
  return items
}

// ── 메인 ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`\n🔄 EGO 기프트 게임 데이터 동기화`)
  console.log(`   모드: ${FIX ? '--fix (DB 수정)' : '--dry-run (비교만)'}`)
  console.log(`   데이터: ${DATA_DIR}\n`)

  // 1. 카테고리 매핑 로드
  const krDir = join(DATA_DIR, 'KR')
  let categoryMap = { ...KEYWORD_EN_TO_KR }
  try {
    const cats = loadJson(join(krDir, 'KR_EgoGiftCategory.json')).dataList
    for (const c of cats) categoryMap[c.id] = c.name
  } catch (e) {
    console.warn('⚠ KR_EgoGiftCategory.json 로드 실패, 기본 매핑 사용')
  }

  // 2. 기프트 정의 로드 (거울 던전 + 왈푸 + 스토리 기프트 + 절차탁춘 등, 스토리 챕터 제외)
  console.log('📦 기프트 정의 로드...')
  const giftItems = loadJsonGlob(DATA_DIR, /^ego-gift-(mirrordungeon|walpu|story-|cultivation|pilgrimage|hellschicken|buff|reuse).*\.json$/)

  // 히든보스 기프트 ID 수집 (*-hb.json 파일)
  const hiddenBossIds = new Set()
  const hbFiles = readdirSync(DATA_DIR).filter(f => f.match(/^ego-gift-.*-hb\.json$/))
  for (const f of hbFiles) {
    const data = loadJson(join(DATA_DIR, f))
    const list = data.list || data.dataList || data
    if (Array.isArray(list)) list.forEach(g => hiddenBossIds.add(g.id))
  }
  if (hiddenBossIds.size > 0) console.log(`   히든보스 기프트: ${hiddenBossIds.size}종 (${hbFiles.join(', ')})`)

  const giftMap = new Map()
  for (const item of giftItems) {
    giftMap.set(item.id, item)
  }
  console.log(`   총 ${giftMap.size}종 기프트`)

  // 3. 로컬라이즈 로드
  console.log('📝 로컬라이즈 로드...')
  const localizeItems = loadJsonGlob(krDir, /^KR_EGOgift.*\.json$/)
  const localizeMap = new Map()
  for (const item of localizeItems) {
    localizeMap.set(item.id, item)
  }
  console.log(`   총 ${localizeMap.size}개 로컬라이즈 항목`)

  // 4. 기프트 데이터 변환
  console.log('\n🔧 기프트 변환...')
  const gifts = []
  let missingLocalize = 0

  for (const [id, item] of giftMap) {
    const upgrades = item.upgradeDataList || []
    const baseUpgrade = upgrades.find(u => u.upgradeLevel === 0)
    const plusUpgrade = upgrades.find(u => u.upgradeLevel === 1)
    const ppUpgrade = upgrades.find(u => u.upgradeLevel === 2)

    const baseLocalizeId = baseUpgrade?.localizeID ?? id
    const plusLocalizeId = plusUpgrade?.localizeID
    const ppLocalizeId = ppUpgrade?.localizeID

    const baseLoc = localizeMap.get(baseLocalizeId)
    if (!baseLoc) {
      missingLocalize++
      if (VERBOSE) console.log(`   ⚠ ID ${id}: 로컬라이즈 없음 (localizeID: ${baseLocalizeId})`)
      continue
    }

    // 키워드 결정: keyword 필드만 사용 (attributeType은 시각 카테고리일 뿐)
    let keyword = '공통'
    if (item.keyword && item.keyword !== 'None') {
      keyword = categoryMap[item.keyword] || KEYWORD_EN_TO_KR[item.keyword] || item.keyword
    }

    // convert_to (변환 기프트)
    const convertTo = item.convertDataList?.[0] || null

    // {0} 플레이스홀더 → 변환 기프트 이름으로 치환
    let effectBase = cleanDesc(baseLoc.desc)
    if (effectBase && convertTo && effectBase.includes('{0}')) {
      const convertLoc = localizeMap.get(convertTo)
      const convertName = convertLoc?.name || `기프트 #${convertTo}`
      effectBase = effectBase.replace('{0}', `→ [${convertName}]`)
    }

    const gift = {
      game_id: id,
      name: baseLoc.name,
      keyword,
      grade: parseGrade(item.tag),
      price: item.price || null,
      sell_price: item.sellPrice || null,
      buy_disabled: isBuyDisabled(item.tag),
      enhancement: upgrades.length > 1,
      effect_base: effectBase,
      effect_plus: plusLocalizeId ? cleanDesc(localizeMap.get(plusLocalizeId)?.desc) : null,
      effect_plusplus: ppLocalizeId ? cleanDesc(localizeMap.get(ppLocalizeId)?.desc) : null,
      is_synthesis: false,
      convert_to: convertTo,
    }

    // + / ++ 이름에서 is_synthesis 여부 추론 (이름에 '+' 없는 것만 기본)
    if (baseLoc.name && !baseLoc.name.endsWith('+')) {
      gifts.push(gift)
    }
  }

  console.log(`   변환 완료: ${gifts.length}종 (로컬라이즈 누락: ${missingLocalize})`)

  // 4-1. droppool 기반 난이도 설정
  console.log('\n🎯 난이도 분류...')
  try {
    const droppoolFiles = readdirSync(DATA_DIR).filter(f => f.match(/^mirrordungeon-egogift-droppool-\d+\.json$/)).sort()
    const latestDroppool = droppoolFiles[droppoolFiles.length - 1]
    if (latestDroppool) {
      const dpData = loadJson(join(DATA_DIR, latestDroppool))
      const dpItem = (Array.isArray(dpData) ? dpData : dpData.list || [dpData])[0]
      const normalExclude = new Set(dpItem.excludeEgoGifts || [])
      const globalExclude = new Set(dpItem.globalExcludeEgoGifts || [])
      let normalCount = 0, hardCount = 0, extremeCount = 0
      for (const gift of gifts) {
        if (hiddenBossIds.has(gift.game_id)) {
          gift.difficulty = '익스트림'
          extremeCount++
        } else if (normalExclude.has(gift.game_id) || globalExclude.has(gift.game_id)) {
          gift.difficulty = '하드'
          hardCount++
        } else {
          gift.difficulty = '노말'
          normalCount++
        }
      }
      console.log(`   ${latestDroppool} 기준: 노말 ${normalCount}, 하드 ${hardCount}, 익스트림 ${extremeCount}`)
    } else {
      console.log('   ⚠ droppool 파일 없음, 모두 노말로 설정')
      for (const gift of gifts) gift.difficulty = '노말'
    }
  } catch (e) {
    console.warn('   ⚠ 난이도 분류 실패:', e.message)
    for (const gift of gifts) gift.difficulty = '노말'
  }

  // 5. 테마팩 로드
  console.log('\n🃏 테마팩 로드...')
  const themeItems = loadJsonGlob(DATA_DIR, /^mirrordungeon-theme-floor-t\d+\.json$/)
  const themeNameData = (() => {
    try {
      return loadJson(join(krDir, 'KR_MirrorDungeonTheme-1.json')).dataList
    } catch { return [] }
  })()
  const themeNameMap = new Map()
  for (const t of themeNameData) themeNameMap.set(t.id, t.name)

  const themes = []
  for (const item of themeItems) {
    const name = themeNameMap.get(item.id) || item.desc || `Theme ${item.id}`
    const egoGiftIds = item.egoGiftPool || []
    themes.push({
      id: item.id,
      name,
      dungeon_id: null,
      unlock_code: item.unlockCondition?.unlockCode || null,
      ego_gift_ids: egoGiftIds,
      specific_ego_gift_ids: item.specificEgoGiftPool || [],
    })
  }
  console.log(`   테마팩 ${themes.length}종`)

  // 6. 기존 DB 데이터 조회
  console.log('\n📊 DB 비교...')
  const { data: existingGifts } = await supabase
    .schema('limbus')
    .from('ego_gifts')
    .select('id, name, game_id, keyword, grade, effect_base, effect_plus, effect_plusplus, price, image_url, difficulty, convert_to')

  const existingByName = new Map()
  const existingByGameId = new Map()
  for (const g of existingGifts || []) {
    existingByName.set(g.name, g)
    if (g.game_id) existingByGameId.set(g.game_id, g)
  }

  // 비교
  let newCount = 0, updateCount = 0, matchCount = 0
  const toUpsert = []

  for (const gift of gifts) {
    // game_id로 먼저 매칭, 없으면 name으로
    const existing = existingByGameId.get(gift.game_id) || existingByName.get(gift.name)

    if (!existing) {
      newCount++
      if (VERBOSE) console.log(`   🆕 ${gift.name} (game_id: ${gift.game_id})`)
      toUpsert.push(gift)
    } else {
      // 변경 확인
      const changes = []
      if (existing.keyword !== gift.keyword) changes.push(`keyword: ${existing.keyword} → ${gift.keyword}`)
      if (existing.grade !== gift.grade) changes.push(`grade: ${existing.grade} → ${gift.grade}`)
      if (existing.effect_base !== gift.effect_base) changes.push('effect_base 변경')
      if (existing.effect_plus !== gift.effect_plus) changes.push('effect_plus 변경')
      if (existing.effect_plusplus !== gift.effect_plusplus) changes.push('effect_plusplus 변경')
      if (existing.price !== gift.price) changes.push(`price: ${existing.price} → ${gift.price}`)
      if (existing.game_id !== gift.game_id) changes.push(`game_id: ${existing.game_id} → ${gift.game_id}`)
      if (existing.difficulty !== gift.difficulty) changes.push(`difficulty: ${existing.difficulty} → ${gift.difficulty}`)

      if (changes.length > 0) {
        updateCount++
        if (VERBOSE) console.log(`   📝 ${gift.name}: ${changes.join(', ')}`)
        // 기존 image_url 보존
        toUpsert.push({ ...gift, id: existing.id, image_url: existing.image_url })
      } else {
        matchCount++
        // game_id만 없으면 업데이트
        if (!existing.game_id) {
          toUpsert.push({ ...gift, id: existing.id, image_url: existing.image_url })
        }
      }
    }
  }

  console.log(`\n   ✅ 일치: ${matchCount}`)
  console.log(`   📝 변경: ${updateCount}`)
  console.log(`   🆕 신규: ${newCount}`)
  console.log(`   🃏 테마팩: ${themes.length}`)

  // 7. DB 업데이트
  if (FIX) {
    console.log('\n💾 DB 업데이트 중...')

    // 기프트 upsert (50개씩 배치)
    for (let i = 0; i < toUpsert.length; i += 50) {
      const batch = toUpsert.slice(i, i + 50)
      const { error } = await supabase
        .schema('limbus')
        .from('ego_gifts')
        .upsert(batch, { onConflict: 'id' })
      if (error) {
        // id 없는 신규는 name으로 시도
        for (const item of batch) {
          if (!item.id) {
            const { error: insertErr } = await supabase
              .schema('limbus')
              .from('ego_gifts')
              .insert(item)
            if (insertErr) console.error(`   ❌ ${item.name}: ${insertErr.message}`)
            else console.log(`   ✅ 신규 추가: ${item.name}`)
          }
        }
      } else {
        console.log(`   ✅ 기프트 배치 ${i + 1}~${i + batch.length} upsert 완료`)
      }
    }

    // 테마팩 upsert
    if (themes.length > 0) {
      const { error } = await supabase
        .schema('limbus')
        .from('ego_gift_themes')
        .upsert(themes, { onConflict: 'id' })
      if (error) console.error(`   ❌ 테마팩 upsert 실패: ${error.message}`)
      else console.log(`   ✅ 테마팩 ${themes.length}종 upsert 완료`)
    }

    console.log('\n✅ 동기화 완료!')
  } else {
    console.log('\n📋 --dry-run 모드. DB 수정 없음. --fix 옵션으로 실행하세요.')
  }
}

main().catch(e => { console.error(e); process.exit(1) })

#!/usr/bin/env node
/**
 * 거울 던전 이벤트 동기화 스크립트
 *
 * 게임 클라이언트 JSON → DB mirror_dungeon_events 테이블
 *
 * 사용법:
 *   node --env-file=.env.local scripts/sync-mirror-dungeon-events.mjs [옵션]
 *
 * 옵션:
 *   --dry-run    비교만 (기본값)
 *   --fix        DB에 반영
 *   --verbose    상세 로그
 */

import { readFileSync, readdirSync } from 'fs'
import { join, resolve } from 'path'
import { createClient } from '@supabase/supabase-js'

const ROOT = process.cwd()
const DATA_DIR = resolve(process.env.HOME, 'Downloads/JSON')
const KR_DIR = join(DATA_DIR, 'KR')

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)
const args = process.argv.slice(2)
const FIX = args.includes('--fix')
const VERBOSE = args.includes('--verbose')

function loadJson(path) {
  return JSON.parse(readFileSync(path, 'utf-8'))
}

/* ── 재귀 유틸 ── */
function extractGiftsRecursive(obj) {
  const gifts = []
  if (obj && typeof obj === 'object') {
    if (Array.isArray(obj)) {
      for (const item of obj) gifts.push(...extractGiftsRecursive(item))
    } else {
      const ir = obj.itemReward
      if (ir && ir.type === 'EGO_GIFT' && ir.rewardId < 990000) {
        gifts.push(ir.rewardId)
      }
      for (const v of Object.values(obj)) {
        gifts.push(...extractGiftsRecursive(v))
      }
    }
  }
  return gifts
}

function extractNextEventIds(obj) {
  const ids = []
  if (obj && typeof obj === 'object') {
    if (Array.isArray(obj)) {
      for (const item of obj) ids.push(...extractNextEventIds(item))
    } else {
      const nid = obj.nextEventID
      if (typeof nid === 'number' && nid > 0) ids.push(nid)
      for (const v of Object.values(obj)) {
        ids.push(...extractNextEventIds(v))
      }
    }
  }
  return ids
}

async function main() {
  console.log('🔄 거울 던전 이벤트 동기화')
  console.log(`   모드: ${FIX ? '--fix (DB 반영)' : '--dry-run (비교만)'}`)

  /* ── 1. 게임 이벤트 데이터 로드 ── */
  console.log('\n📂 게임 이벤트 데이터 로드...')

  const actionEvents = loadJson(join(DATA_DIR, 'mirror-dungeon-action-choice-event.json'))
  const personalityEvents = loadJson(join(DATA_DIR, 'mirror-dungeon-personality-choice-event.json'))

  const allGameEvents = new Map()
  for (const ev of [...actionEvents.list, ...personalityEvents.list]) {
    allGameEvents.set(ev.id, ev)
  }
  console.log(`   action: ${actionEvents.list.length}개, personality: ${personalityEvents.list.length}개`)

  /* ── 2. KR 이벤트 텍스트 로드 ── */
  console.log('\n📝 KR 이벤트 텍스트 로드...')
  const krTexts = new Map()

  // 거울 던전 관련 소스만 포함 (Refraction = 굴절철도, 제외)
  const ALLOWED_SOURCES = [
    'KR_ActionEvents_Mirror', 'KR_ActionEvents_Mirror3', 'KR_ActionEvents_Mirror4',
    'KR_ActionEvents_Mirror6', 'KR_ActionEvents_Mirror7',
    'KR_ActionEvents.json', 'KR_ActionEvents-walpu4', 'KR_ActionEvents-walpu5',
    'KR_ActionEvents-walpu6', 'KR_ActionEvents-walpu8',
    'KR_ActionEvents-cultivation', 'KR_ActionEvents-pilgrimage',
    'KR_ActionEvents-tktRe',
    'KR_ActionEvents_lcbcheckup', 'KR_ActionEvents_mowe', 'KR_ActionEvents_mowe-re',
    'KR_ActionEvents_night-clean-up', 'KR_ActionEvents_tkt', 'KR_ActionEvents_Ycgd',
    'KR_AbEvents_Mirror', 'KR_AbEvents_Mirror3', 'KR_AbEvents_Mirror4', 'KR_AbEvents_Mirror6',
    'KR_AbEvents-walpu4', 'KR_AbEvents-walpu5', 'KR_AbEvents-walpu6', 'KR_AbEvents-walpu8',
    'KR_AbEvents-cultivation', 'KR_AbEvents-pilgrimage', 'KR_AbEvents-tktRe',
    'KR_AbEvents_lcbcheckup', 'KR_AbEvents_mowe-re',
    'KR_AbEvents_mowe', 'KR_AbEvents_night-clean-up', 'KR_AbEvents_tkt', 'KR_AbEvents_Ycgd',
  ]

  for (const fname of readdirSync(KR_DIR)) {
    if (!fname.startsWith('KR_ActionEvents') && !fname.startsWith('KR_AbEvents')) continue
    if (!fname.endsWith('.json')) continue
    // 굴절철도, 스토리 던전 등 거울 던전 무관 소스 제외
    const baseName = fname.replace('.json', '')
    if (baseName.includes('Refraction') || baseName.includes('a1c5') || baseName.includes('a1c6') ||
        baseName.includes('a1c7') || baseName.includes('a1c8') || baseName.includes('a1c9')) continue
    try {
      const data = loadJson(join(KR_DIR, fname))
      for (const item of data.dataList || []) {
        if (typeof item.id === 'number' && (item.id >= 900000 || item.id >= 10000)) {
          const isAbEvent = fname.startsWith('KR_AbEvents')
          if (isAbEvent) {
            // AbEvents: title, behaveDesc, successDesc[], failureDesc[]
            const descParts = []
            if (item.behaveDesc) descParts.push(item.behaveDesc)
            krTexts.set(item.id, {
              name: item.title || null,
              desc: descParts.join('\n') || null,
              options: (item.successDesc || item.failureDesc) ? [
                ...(item.successDesc || []).map((s, i) => ({
                  message: `성공${item.successDesc.length > 1 ? ` ${i + 1}` : ''}`,
                  result: [s],
                })),
                ...(item.failureDesc || []).map((s, i) => ({
                  message: `실패${item.failureDesc.length > 1 ? ` ${i + 1}` : ''}`,
                  result: [s],
                })),
              ] : null,
              source: fname.replace('KR_', '').replace('.json', ''),
            })
          } else {
            // ActionEvents: name, desc, options[]
            krTexts.set(item.id, {
              name: item.name || null,
              desc: item.desc || item.eventDesc || null,
              options: item.options || null,
              source: fname.replace('KR_', '').replace('.json', ''),
            })
          }
        }
      }
    } catch {}
  }
  console.log(`   KR 텍스트: ${krTexts.size}개`)

  /* ── 3. 이벤트→테마팩 매핑 (eventPool) ── */
  console.log('\n🎯 테마팩 eventPool 매핑...')
  const eventToThemes = new Map()

  for (let i = 1; i <= 6; i++) {
    const data = loadJson(join(DATA_DIR, `mirrordungeon-theme-floor-t${i}.json`))
    for (const item of data.list) {
      const events = item.mapGenOption?.eventPool || []
      for (const eid of events) {
        if (!eventToThemes.has(eid)) eventToThemes.set(eid, new Set())
        eventToThemes.get(eid).add(item.id)
      }
    }
  }

  // 테마팩 전체 ID를 tier별로 수집
  const themeIdsByTier = {}
  const allThemeIds = []
  for (let i = 1; i <= 6; i++) {
    const data = loadJson(join(DATA_DIR, `mirrordungeon-theme-floor-t${i}.json`))
    themeIdsByTier[i] = data.list.map(item => item.id)
    allThemeIds.push(...themeIdsByTier[i])
  }

  // 1차: generatenodepool 파일에서 이벤트 → dungeonId 자동 매핑
  const eventToDungeonIds = new Map()
  for (const fname of readdirSync(DATA_DIR)) {
    if (!fname.includes('generatenodepool-event') || !fname.endsWith('.json')) continue
    try {
      const data = loadJson(join(DATA_DIR, fname))
      for (const item of data.list || []) {
        const did = item.dungeonId
        for (const eid of item.dungeonEventList || []) {
          if (!eventToDungeonIds.has(eid)) eventToDungeonIds.set(eid, new Set())
          eventToDungeonIds.get(eid).add(did)
        }
      }
    } catch {}
  }

  // dungeonId → 테마팩 범위
  // 일반 거던: 1=초기(t1), 2=MD4(t1~t5), 3=MD5+(전체)
  // 특수 던전: 910301/910302=헬스치킨(1101), 910701/911501=육참골단(1104,1116),
  //           910901/911801=시간살인시간(1105,1120)
  const dungeonIdToThemes = {
    1: [...themeIdsByTier[1]],
    2: [...themeIdsByTier[1], ...themeIdsByTier[2], ...themeIdsByTier[3], ...themeIdsByTier[4], ...themeIdsByTier[5]],
    3: allThemeIds,
    // 특수 던전
    910301: [1101], 910302: [1101],           // 헬스치킨
    910701: [1104], 911501: [1104, 1116],     // 육참골단 + BokGak
    910901: [1105], 911801: [1105, 1120],     // 시간살인시간 + BokGak
  }

  // nodepool 기반 이벤트 → 테마팩 자동 매핑
  const nodepoolEventThemes = new Map()
  for (const [eid, dids] of eventToDungeonIds) {
    const themes = new Set()
    for (const did of dids) {
      if (dungeonIdToThemes[did]) {
        dungeonIdToThemes[did].forEach(t => themes.add(t))
      }
      // 특수 던전 dungeonId (910xxx)는 eventPool 매핑으로 처리됨
    }
    if (themes.size > 0) nodepoolEventThemes.set(eid, [...themes])
  }

  console.log(`   nodepool 자동 매핑: ${nodepoolEventThemes.size}개 이벤트`)

  // 2차 fallback: source 파일명 기반 (nodepool에 없는 이벤트용)
  // Mirror 공통 = 해당 버전 전체 테마팩, 특수 던전 = 특정 테마팩
  const sourceToThemes = {
    // Mirror 공통
    'ActionEvents_Mirror': allThemeIds,
    'ActionEvents_Mirror3': [...themeIdsByTier[1]],
    'ActionEvents_Mirror4': [...themeIdsByTier[1], ...themeIdsByTier[2], ...themeIdsByTier[3], ...themeIdsByTier[4], ...themeIdsByTier[5]],
    'ActionEvents_Mirror6': allThemeIds,
    'ActionEvents_Mirror7': allThemeIds,
    'ActionEvents': allThemeIds,
    'AbEvents_Mirror': allThemeIds,
    'AbEvents_Mirror3': [...themeIdsByTier[1]],
    'AbEvents_Mirror4': [...themeIdsByTier[1], ...themeIdsByTier[2], ...themeIdsByTier[3], ...themeIdsByTier[4], ...themeIdsByTier[5]],
    'AbEvents_Mirror6': allThemeIds,
    // 왈푸르기스
    'ActionEvents-walpu4': [1107],
    'ActionEvents-walpu5': [1114],
    'ActionEvents-walpu6': [1119],
    'ActionEvents-walpu8': [1124],
    'AbEvents-walpu4': [1107],
    'AbEvents-walpu5': [1114],
    'AbEvents-walpu6': [1119],
    'AbEvents-walpu8': [1124],
    // 특수 던전
    'ActionEvents-cultivation': [1121],
    'ActionEvents-pilgrimage': [1122],
    'ActionEvents_lcbcheckup': [1115, 1125],
    'ActionEvents_mowe': [1106, 1123],
    'ActionEvents_mowe-re': [1123],
    'ActionEvents_night-clean-up': [1117],
    'ActionEvents_tkt': [1105, 1120],
    'ActionEvents-tktRe': [1120],
    'ActionEvents_Ycgd': [1104, 1116],
    'AbEvents_tkt': [1105, 1120],
    'AbEvents-tktRe': [1120],
    'AbEvents_Ycgd': [1104, 1116],
    'AbEvents_lcbcheckup': [1115, 1125],
    'AbEvents_mowe': [1106, 1123],
    'AbEvents_mowe-re': [1123],
    'AbEvents_night-clean-up': [1117],
    'AbEvents-cultivation': [1121],
    'AbEvents-pilgrimage': [1122],
  }

  console.log(`   테마 eventPool: ${eventToThemes.size}개 이벤트`)

  /* ── 4. 부모-자식 관계 + 선택지별 기프트 ── */
  console.log('\n🔗 부모-자식 관계 + 선택지별 기프트...')
  const childToParent = new Map()
  const parentOptionGifts = new Map()
  const eventAllGifts = new Map()

  for (const ev of actionEvents.list) {
    const action = ev.actionEvent || {}
    const opts = action.eachOptionList || []
    const og = []
    const allGifts = new Set(extractGiftsRecursive(ev))

    for (const opt of opts) {
      const gifts = new Set(extractGiftsRecursive(opt))
      const nextIds = extractNextEventIds(opt)

      for (const nid of nextIds) {
        childToParent.set(nid, ev.id)
        if (allGameEvents.has(nid)) {
          const childGifts = extractGiftsRecursive(allGameEvents.get(nid))
          childGifts.forEach(g => { gifts.add(g); allGifts.add(g) })
          // 자식의 자식도
          for (const cnid of extractNextEventIds(allGameEvents.get(nid))) {
            if (allGameEvents.has(cnid)) {
              const grandGifts = extractGiftsRecursive(allGameEvents.get(cnid))
              grandGifts.forEach(g => { gifts.add(g); allGifts.add(g) })
            }
          }
        }
      }
      og.push([...gifts])
    }

    if (og.some(g => g.length > 0)) parentOptionGifts.set(ev.id, og)
    if (allGifts.size > 0) eventAllGifts.set(ev.id, [...allGifts])
  }

  console.log(`   부모-자식: ${childToParent.size}개`)
  console.log(`   선택지별 기프트: ${parentOptionGifts.size}개`)
  console.log(`   전체 기프트: ${eventAllGifts.size}개`)

  /* ── 5. 거울 던전 등장 이벤트 필터 ── */
  // nodepool + eventPool에 있는 이벤트만 포함 (거던에서 실제 등장하는 것)
  const allNodepoolEvents = new Set()
  for (const [eid] of eventToDungeonIds) allNodepoolEvents.add(eid)
  for (const [eid] of eventToThemes) allNodepoolEvents.add(eid)

  // 자식 이벤트도 포함 (부모가 nodepool에 있으면)
  const allowedEvents = new Set(allNodepoolEvents)
  for (const [childId, parentId] of childToParent) {
    if (allowedEvents.has(parentId)) allowedEvents.add(childId)
  }
  // 게임 이벤트 데이터에 있는 모든 action/personality 이벤트도 허용
  // (10xxx tkt 이벤트는 nodepool에 있지만, 971xxx 원본은 게임 이벤트에만 있음)
  for (const [eid] of allGameEvents) {
    allowedEvents.add(eid)
  }
  // 8자리 ID fallback: 앞 5~6자리 부모가 allowed면 자식도 허용
  for (const [eid] of krTexts) {
    if (String(eid).length >= 7) {
      const parentId6 = Number(String(eid).slice(0, 6))
      const parentId5 = Number(String(eid).slice(0, 5))
      if (allowedEvents.has(parentId6) || allowedEvents.has(parentId5)) allowedEvents.add(eid)
    }
  }

  console.log(`\n📊 DB 행 구성... (거던 등장 이벤트: ${allowedEvents.size}개)`)
  const rows = []

  for (const [eid, kr] of krTexts) {
    if (!allowedEvents.has(eid)) continue // 거던에 안 나오는 이벤트 제외

    // 테마팩 매핑 우선순위: 1) eventPool 직접, 2) nodepool 자동, 3) source fallback
    const themeIds = eventToThemes.has(eid)
      ? [...eventToThemes.get(eid)]
      : nodepoolEventThemes.has(eid)
        ? nodepoolEventThemes.get(eid)
        : (sourceToThemes[kr.source] || null)

    rows.push({
      id: eid,
      name: kr.name,
      desc_text: kr.desc,
      options: kr.options,
      gift_ids: eventAllGifts.get(eid) || null,
      option_gifts: parentOptionGifts.get(eid) || null,
      source: kr.source,
      parent_id: childToParent.has(eid) && krTexts.has(childToParent.get(eid))
        ? childToParent.get(eid)
        // 8자리 ID → 앞 6자리가 부모 (fallback)
        : (String(eid).length >= 8 && krTexts.has(Number(String(eid).slice(0, 6))))
          ? Number(String(eid).slice(0, 6))
          : null,
      theme_ids: themeIds && themeIds.length > 0 ? themeIds : null,
    })
  }

  // 변형 이벤트 image_url 자동 매핑 (같은 desc_text → 원본 이미지 복사)
  // 기존 image_url은 나중에 병합하므로 여기서는 desc 기반 매핑만 준비
  const descToImageId = new Map() // desc_text → 첫 번째 이벤트 ID (이미지 원본)
  for (const r of rows) {
    if (r.parent_id || !r.desc_text) continue
    if (!descToImageId.has(r.desc_text)) {
      descToImageId.set(r.desc_text, r.id)
    }
  }

  // 중복 제거 통계
  const descSet = new Set()
  let dupeCount = 0
  for (const r of rows) {
    if (r.parent_id) continue
    if (r.desc_text && descSet.has(r.desc_text)) dupeCount++
    else if (r.desc_text) descSet.add(r.desc_text)
  }

  const rootCount = rows.filter(r => !r.parent_id).length
  console.log(`   총 행: ${rows.length}개 (루트: ${rootCount}, 자식: ${rows.length - rootCount})`)
  console.log(`   중복 desc: ${dupeCount}개`)
  console.log(`   테마팩 연결: ${rows.filter(r => r.theme_ids).length}개`)
  console.log(`   기프트 연결: ${rows.filter(r => r.gift_ids).length}개`)
  console.log(`   선택지 기프트: ${rows.filter(r => r.option_gifts).length}개`)

  /* ── 6. DB 반영 ── */
  if (FIX) {
    console.log('\n💾 DB 업데이트...')

    // 기존 image_url 보존
    const { data: existingRows } = await supabase
      .schema('limbus')
      .from('mirror_dungeon_events')
      .select('id, image_url')
    const existingImageMap = new Map()
    for (const r of existingRows || []) {
      if (r.image_url) existingImageMap.set(r.id, r.image_url)
    }
    console.log(`   기존 image_url 보존: ${existingImageMap.size}개`)

    // 행에 기존 image_url 병합 + 변형 이벤트 자동 매핑
    for (const r of rows) {
      if (existingImageMap.has(r.id)) {
        // 기존 이미지 보존
        r.image_url = existingImageMap.get(r.id)
      } else if (r.desc_text && descToImageId.has(r.desc_text)) {
        // 같은 desc_text를 가진 원본 이벤트의 이미지 복사
        const originalId = descToImageId.get(r.desc_text)
        r.image_url = existingImageMap.get(originalId) || null
      } else if (r.parent_id && existingImageMap.has(r.parent_id)) {
        // 자식 이벤트는 부모 이미지 상속
        r.image_url = existingImageMap.get(r.parent_id)
      } else {
        r.image_url = null
      }
    }
    const imageCount = rows.filter(r => r.image_url).length
    console.log(`   image_url 매핑: ${imageCount}개 (보존 ${existingImageMap.size} + 변형/자식 자동)`)

    // 기존 데이터 삭제 후 삽입 (clean sync)
    // parent_id FK 때문에 자식 먼저 삭제
    await supabase.schema('limbus').from('mirror_dungeon_events')
      .update({ parent_id: null }).not('parent_id', 'is', null)
    const { error: delErr } = await supabase
      .schema('limbus')
      .from('mirror_dungeon_events')
      .delete()
      .not('id', 'is', null)

    if (delErr) {
      console.error(`   ❌ 삭제 실패: ${delErr.message}`)
    }

    // 1단계: parent_id 없이 전부 삽입
    const rowsWithoutParent = rows.map(r => ({ ...r, parent_id: null }))
    for (let i = 0; i < rowsWithoutParent.length; i += 50) {
      const batch = rowsWithoutParent.slice(i, i + 50)
      const { error } = await supabase
        .schema('limbus')
        .from('mirror_dungeon_events')
        .upsert(batch, { onConflict: 'id' })
      if (error) console.error(`   ❌ 삽입 배치 ${i}: ${error.message}`)
      else if (VERBOSE) console.log(`   ✅ 삽입 ${i + 1}~${i + batch.length}`)
    }

    // 2단계: parent_id 업데이트
    const childRows = rows.filter(r => r.parent_id)
    let parentUpdated = 0
    for (const r of childRows) {
      const { error } = await supabase
        .schema('limbus')
        .from('mirror_dungeon_events')
        .update({ parent_id: r.parent_id })
        .eq('id', r.id)
      if (error) console.error(`   ❌ parent_id ${r.id}: ${error.message}`)
      else parentUpdated++
    }

    // 3단계: 이벤트 gift_ids를 DB의 실제 game_id로 치환
    // (같은 기프트가 이벤트용 ID(9xxx)와 DB용 ID(1xxx/2xxx)로 다를 수 있음)
    console.log('\n🔄 이벤트 gift_id → DB game_id 치환...')
    const { data: allDbGifts } = await supabase
      .schema('limbus')
      .from('ego_gifts')
      .select('name, game_id')
      .not('game_id', 'is', null)
    const giftNameToDbId = new Map()
    for (const g of allDbGifts || []) giftNameToDbId.set(g.name, Number(g.game_id))

    // KR 로컬라이즈에서 이벤트 gift_id → 이름 매핑
    const eventGiftIdToName = new Map()
    for (const fname of readdirSync(KR_DIR)) {
      if (!fname.startsWith('KR_EGOgift') || !fname.endsWith('.json')) continue
      try {
        const data = loadJson(join(KR_DIR, fname))
        for (const item of data.dataList || []) {
          if (item.id && item.name) eventGiftIdToName.set(item.id, item.name)
        }
      } catch {}
    }

    // 치환 맵 생성: 이벤트 gift_id → DB game_id
    const giftIdRemap = new Map()
    const allEventGiftIds = new Set()
    for (const r of rows) {
      for (const gid of r.gift_ids || []) allEventGiftIds.add(gid)
      for (const opts of r.option_gifts || []) {
        for (const gid of opts) allEventGiftIds.add(gid)
      }
    }
    const dbGameIds = new Set((allDbGifts || []).map(g => Number(g.game_id)))
    for (const eid of allEventGiftIds) {
      if (dbGameIds.has(eid)) continue // 이미 DB에 있으면 스킵
      const name = eventGiftIdToName.get(eid)
      if (name && giftNameToDbId.has(name)) {
        giftIdRemap.set(eid, giftNameToDbId.get(name))
      }
    }

    if (giftIdRemap.size > 0) {
      console.log(`   치환 매핑: ${giftIdRemap.size}개`)
      let remapped = 0
      for (const r of rows) {
        let changed = false
        if (r.gift_ids) {
          r.gift_ids = r.gift_ids.map(gid => {
            if (giftIdRemap.has(gid)) { changed = true; return giftIdRemap.get(gid) }
            return gid
          })
        }
        if (r.option_gifts) {
          r.option_gifts = r.option_gifts.map(opts =>
            opts.map(gid => {
              if (giftIdRemap.has(gid)) { changed = true; return giftIdRemap.get(gid) }
              return gid
            })
          )
        }
        if (changed) remapped++
      }
      console.log(`   ${remapped}개 이벤트 치환`)

      // DB도 업데이트
      for (const r of rows) {
        if (!r.gift_ids && !r.option_gifts) continue
        const payload = {}
        if (r.gift_ids) payload.gift_ids = r.gift_ids
        if (r.option_gifts) payload.option_gifts = r.option_gifts
        await supabase.schema('limbus').from('mirror_dungeon_events')
          .update(payload).eq('id', r.id)
      }
    } else {
      console.log('   치환 필요 없음')
    }

    // 4단계: 기프트 acquisition 텍스트 자동 생성
    console.log('\n📝 기프트 acquisition 업데이트...')
    const giftAcquisition = new Map() // game_id → text

    for (const r of rows) {
      if (!r.option_gifts || !r.options) continue
      // 부모 이벤트면 직접 desc 사용, 자식이면 부모 desc 찾기
      let eventDesc = r.desc_text || ''
      if (r.parent_id) {
        const parent = rows.find(p => p.id === r.parent_id)
        if (parent?.desc_text) eventDesc = parent.desc_text
      }
      const firstLine = eventDesc.split('\n')[0].slice(0, 60)

      for (let i = 0; i < r.option_gifts.length; i++) {
        if (!r.option_gifts[i] || r.option_gifts[i].length === 0 || i >= r.options.length) continue
        const opt = r.options[i]
        const choiceText = opt.message || ''
        const choiceDesc = opt.messageDesc || ''

        for (const gid of r.option_gifts[i]) {
          let acq = `"${firstLine}" 이벤트 → '${choiceText}' 선택`
          if (choiceDesc) acq += ` (${choiceDesc})`

          if (giftAcquisition.has(gid)) {
            giftAcquisition.set(gid, giftAcquisition.get(gid) + `\n또는: ${acq}`)
          } else {
            giftAcquisition.set(gid, acq)
          }
        }
      }
    }

    console.log(`   acquisition 텍스트: ${giftAcquisition.size}개 기프트`)

    // ego_gifts 테이블에서 game_id → uuid 매핑
    const { data: allGifts } = await supabase
      .schema('limbus')
      .from('ego_gifts')
      .select('id, game_id')
      .not('game_id', 'is', null)
    const gidToUuid = new Map()
    for (const g of allGifts || []) gidToUuid.set(g.game_id, g.id)

    let acqUpdated = 0
    for (const [gameId, acqText] of giftAcquisition) {
      const uuid = gidToUuid.get(gameId)
      if (!uuid) continue
      const { error } = await supabase
        .schema('limbus')
        .from('ego_gifts')
        .update({ acquisition: acqText })
        .eq('id', uuid)
      if (error) { if (VERBOSE) console.error(`   ❌ acquisition ${gameId}: ${error.message}`) }
      else acqUpdated++
    }

    console.log(`   ✅ acquisition ${acqUpdated}/${giftAcquisition.size}개 업데이트`)

    console.log(`\n✅ 동기화 완료! (이벤트: ${rows.length}, parent_id: ${parentUpdated}, acquisition: ${acqUpdated})`)
  } else {
    console.log('\n📋 --dry-run 모드. DB 수정 없음. --fix 옵션으로 실행하세요.')
  }
}

main().catch(e => { console.error(e); process.exit(1) })

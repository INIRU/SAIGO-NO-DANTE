#!/usr/bin/env node
/**
 * 거울 던전 이벤트 보상 데이터 보강
 * 게임 데이터에서 선택지별 보상(코스트, 기프트, HP/MP, 확률)을 추출하여 DB options에 추가
 *
 * 사용법:
 *   node --env-file=.env.local scripts/enrich-mirror-dungeon-event-rewards.mjs [옵션]
 *
 * 옵션:
 *   --dry-run    비교만 (기본값)
 *   --fix        DB에 반영
 *   --verbose    상세 로그
 */

import { readFileSync, existsSync } from 'fs'
import { resolve } from 'path'
import { createClient } from '@supabase/supabase-js'

const DATA_DIR = resolve(process.env.HOME, 'Documents/Limbus/assets/data/Json-2')
const TEXT_DIR = resolve(process.env.HOME, 'Documents/Limbus/assets/data/Json (Text)')

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

// ── 파일 로드 유틸 ──────────────────────────────────────────────

function loadJson(path) {
  return JSON.parse(readFileSync(path, 'utf-8'))
}

/** BOM 있는 .txt 파일(JSON 형식)을 로드 */
function loadBomJson(path) {
  const raw = readFileSync(path)
  const text = raw.toString('utf-8').replace(/^\uFEFF/, '')
  return JSON.parse(text)
}

// ── 확률 파싱 ────────────────────────────────────────────────────

/**
 * resultCondition 문자열 → 숫자(0~1) 또는 조건 문자열 그대로
 * "Prob_1" | null → 1.0
 * "Prob_0.5"      → 0.5
 * "MpAverage_*"   → 조건 문자열 그대로
 * "ProbTimesRepeatCount_*" → 조건 문자열 그대로
 */
function parseProbability(cond) {
  if (!cond || cond === 'Prob_1') return 1.0
  const m = cond.match(/^Prob_([\d.]+)$/)
  if (m) return parseFloat(m[1])
  // 조건부 확률 (MpAverage_*, ProbTimesRepeatCount_* 등) → 문자열 그대로
  return cond
}

// ── resultEffect → 보상 객체 매핑 ───────────────────────────────

/**
 * HP/MP 관련 이펙트 파싱
 * "LoseHpOnly_10"              → { type: 'hp_loss', amount: 10 }
 * "RecoverHpOnly_15"           → { type: 'hp_recover', amount: 15 }
 * "LoseMpOnly_20"              → { type: 'mp_loss', amount: 20 }
 * "RecoverMpOnly_10"           → { type: 'mp_recover', amount: 10 }
 * "RecoverMpOnlyUntilMax"      → { type: 'mp_recover_full' }
 * "RecoverHpOnlyUntilMax"      → { type: 'hp_recover_full' }
 * "RecoverHpMpSameAmount_10"   → { type: 'hp_mp_recover', amount: 10 }
 * "LoseHpMpSameAmount_12"      → { type: 'hp_mp_loss', amount: 12 }
 * "LoseHpMpDifferentAmount_12_8" → { type: 'hp_mp_loss_diff', hp: 12, mp: 8 }
 * "RecoverRatioHpOnly_20"      → { type: 'hp_recover_ratio', amount: 20 }
 */
function parseHpMpEffect(effect) {
  // 別々の量 (LoseHpMpDifferentAmount_12_8)
  let m = effect.match(/^LoseHpMpDifferentAmount_(\d+)_(\d+)$/)
  if (m) return { type: 'hp_mp_loss_diff', hp: parseInt(m[1]), mp: parseInt(m[2]) }

  m = effect.match(/^RecoverHpMpDifferentAmount_(\d+)_(\d+)$/)
  if (m) return { type: 'hp_mp_recover_diff', hp: parseInt(m[1]), mp: parseInt(m[2]) }

  // 최대치까지 회복
  if (effect === 'RecoverMpOnlyUntilMax') return { type: 'mp_recover_full' }
  if (effect === 'RecoverHpOnlyUntilMax') return { type: 'hp_recover_full' }
  if (effect === 'RecoverHpMpUntilMax') return { type: 'hp_mp_recover_full' }

  // 비율 회복/손실
  m = effect.match(/^RecoverRatioHpOnly_(\d+)$/)
  if (m) return { type: 'hp_recover_ratio', amount: parseInt(m[1]) }

  m = effect.match(/^LoseRatioHpOnly_(\d+)$/)
  if (m) return { type: 'hp_loss_ratio', amount: parseInt(m[1]) }

  // 동일 양 HP+MP
  m = effect.match(/^RecoverHpMpSameAmount_(\d+)$/)
  if (m) return { type: 'hp_mp_recover', amount: parseInt(m[1]) }

  m = effect.match(/^LoseHpMpSameAmount_(\d+)$/)
  if (m) return { type: 'hp_mp_loss', amount: parseInt(m[1]) }

  // HP 단독
  m = effect.match(/^LoseHpOnly_(\d+)$/)
  if (m) return { type: 'hp_loss', amount: parseInt(m[1]) }

  m = effect.match(/^RecoverHpOnly_(\d+)$/)
  if (m) return { type: 'hp_recover', amount: parseInt(m[1]) }

  // MP 단독
  m = effect.match(/^LoseMpOnly_(\d+)$/)
  if (m) return { type: 'mp_loss', amount: parseInt(m[1]) }

  m = effect.match(/^RecoverMpOnly_(\d+)$/)
  if (m) return { type: 'mp_recover', amount: parseInt(m[1]) }

  return null
}

const EFFECT_MAP = {
  'MirrorDungeonAcquireCost': (item) => ({ type: 'cost', amount: item?.num ?? 0 }),
  'MirrorDungeonLossCost':    (item) => ({ type: 'cost_loss', amount: item?.num ?? 0 }),
  'GetConfirmedEgogift':           (item) => ({ type: 'gift', gift_id: item?.rewardId ?? null, count: item?.num ?? 1 }),
  'GetConfirmedEgogiftOnWinBattle':(item) => ({ type: 'gift_battle', gift_id: item?.rewardId ?? null, count: item?.num ?? 1 }),
  'StartBattle_Abnormality': (_item, rf) => ({ type: 'battle_abnormality', battle_id: rf?.nextBattleID ?? null }),
  'StartBattle':             (_item, rf) => ({ type: 'battle', battle_id: rf?.nextBattleID ?? null }),
  'Nothing':                 () => ({ type: 'nothing' }),
  'GetCharacter':            () => ({ type: 'get_character' }),
  'LevelupPersonality':      () => ({ type: 'level_up' }),
}

/**
 * resultForm 하나에서 effect 객체를 추출
 * 알 수 없는 이펙트는 { type: 'unknown', effect } 로 폴백
 */
function parseResultForm(rf) {
  const effect = rf.resultEffect
  if (!effect) return null

  // HP/MP 이펙트 먼저 시도
  const hpmp = parseHpMpEffect(effect)
  if (hpmp) return hpmp

  // 매핑된 이펙트
  const fn = EFFECT_MAP[effect]
  if (fn) return fn(rf.itemReward, rf)

  // 폴백: 알 수 없는 이펙트
  if (VERBOSE) console.log(`    unknown effect: ${effect}`)
  return { type: 'unknown', effect }
}

// ── Action 이벤트에서 선택지별 rewards 추출 ──────────────────────

/**
 * actionEvent.eachOptionList → options 배열과 평행한 rewards 배열 반환
 * 각 원소: [ { probability, next_event_id?, effects: [...] }, ... ]
 */
function extractActionOptionRewards(actionEvent) {
  const optionList = actionEvent?.eachOptionList ?? []
  return optionList.map((opt) => {
    const results = opt.resultList ?? []
    const rewardGroups = results.map((result) => {
      const prob = parseProbability(result.resultCondition)
      const nextId = (result.nextEventID && result.nextEventID > 0) ? result.nextEventID : undefined
      const effects = (result.eventResultDataList ?? [])
        .map(rd => parseResultForm(rd.resultForm))
        .filter(Boolean)
        // nothing만 있고 다른 효과가 없을 때만 포함 (의도적 nothing 표시)
      return { probability: prob, ...(nextId !== undefined ? { next_event_id: nextId } : {}), effects }
    })
    // 의미 없는 결과 제거: effects가 모두 비어 있고 next_event_id도 없는 경우
    const meaningful = rewardGroups.filter(rg =>
      rg.effects.length > 0 || rg.next_event_id !== undefined
    )
    return meaningful
  })
}

// ── Personality 이벤트에서 성공/실패별 rewards 추출 ───────────────

/**
 * personalityEvent.eventResults → SUCCESS/FAILURE 별 rewards 반환
 * 형태: { success: [...], failure: [...] }
 */
function extractPersonalityRewards(personalityEvent) {
  const eventResults = personalityEvent?.eventResults ?? []
  const out = {}
  for (const er of eventResults) {
    const label = er.eventResult?.toLowerCase() ?? 'unknown'
    const resultList = er.eventResultDataList ?? []
    const rewardGroups = resultList.map((result) => {
      const prob = parseProbability(result.resultCondition)
      const nextId = (result.nextEventID && result.nextEventID > 0) ? result.nextEventID : undefined
      const effects = (result.eventResultDataList ?? [])
        .map(rd => parseResultForm(rd.resultForm))
        .filter(Boolean)
      return { probability: prob, ...(nextId !== undefined ? { next_event_id: nextId } : {}), effects }
    })
    const meaningful = rewardGroups.filter(rg =>
      rg.effects.length > 0 || rg.next_event_id !== undefined
    )
    out[label] = meaningful
  }
  return out
}

// ── 메인 ─────────────────────────────────────────────────────────

async function main() {
  console.log('거울 던전 이벤트 보상 데이터 보강')
  console.log(`모드: ${FIX ? '--fix (DB 반영)' : '--dry-run (비교만)'}`)

  // 1. 게임 이벤트 데이터 로드 (Text 버전이 더 많으면 우선 사용)
  console.log('\n[1/5] 게임 이벤트 데이터 로드...')

  const j2ActionPath  = resolve(DATA_DIR, 'mirror-dungeon-action-choice-event.json')
  const txtActionPath = resolve(TEXT_DIR, 'mirror-dungeon-action-choice-event.txt')
  const j2PersonPath  = resolve(DATA_DIR, 'mirror-dungeon-personality-choice-event.json')
  const txtPersonPath = resolve(TEXT_DIR, 'mirror-dungeon-personality-choice-event.txt')

  const j2ActionData  = loadJson(j2ActionPath)
  const txtActionData = existsSync(txtActionPath) ? loadBomJson(txtActionPath) : null
  const j2PersonData  = loadJson(j2PersonPath)
  const txtPersonData = existsSync(txtPersonPath) ? loadBomJson(txtPersonPath) : null

  // Text 버전이 더 많은 이벤트를 포함하면 우선 사용
  const actionList = (txtActionData && txtActionData.list.length > j2ActionData.list.length)
    ? txtActionData.list
    : j2ActionData.list
  const personList = (txtPersonData && txtPersonData.list.length > j2PersonData.list.length)
    ? txtPersonData.list
    : j2PersonData.list

  console.log(`  action 이벤트: ${actionList.length}개 (Json-2: ${j2ActionData.list.length}, Text: ${txtActionData?.list.length ?? 'N/A'})`)
  console.log(`  personality 이벤트: ${personList.length}개 (Json-2: ${j2PersonData.list.length}, Text: ${txtPersonData?.list.length ?? 'N/A'})`)

  // ID → 게임 이벤트 맵
  const actionMap = new Map(actionList.map(e => [e.id, e]))
  const personMap = new Map(personList.map(e => [e.id, e]))

  // 2. DB 이벤트 전체 로드
  console.log('\n[2/5] DB 이벤트 로드...')
  const dbEvents = []
  const PAGE = 200
  let from = 0
  while (true) {
    const { data, error } = await supabase
      .schema('limbus')
      .from('mirror_dungeon_events')
      .select('id, options, parent_id')
      .range(from, from + PAGE - 1)
    if (error) { console.error('DB 조회 실패:', error.message); process.exit(1) }
    if (!data || data.length === 0) break
    dbEvents.push(...data)
    if (data.length < PAGE) break
    from += PAGE
  }
  console.log(`  DB 이벤트: ${dbEvents.length}개`)

  // 3. 각 DB 이벤트에 대해 게임 데이터에서 rewards 추출
  console.log('\n[3/5] 보상 데이터 추출...')

  const updates = []   // { id, options } — DB 업데이트 대상
  let noGameData = 0
  let noOptions = 0
  let noRewards = 0
  let optionCountMismatch = 0
  let totalOptionsEnriched = 0
  let totalRewardGroups = 0

  for (const row of dbEvents) {
    const gameId = row.id

    // options가 없는 이벤트는 스킵
    if (!row.options || row.options.length === 0) {
      noOptions++
      continue
    }

    // 게임 데이터에서 매칭 찾기
    let rewardsByOption = null   // action 이벤트용: 배열 (options 인덱스 순)
    let personalityRewards = null // personality 이벤트용: { success, failure }

    if (actionMap.has(gameId)) {
      const gameEv = actionMap.get(gameId)
      rewardsByOption = extractActionOptionRewards(gameEv.actionEvent)
    } else if (personMap.has(gameId)) {
      const gameEv = personMap.get(gameId)
      personalityRewards = extractPersonalityRewards(gameEv.personalityEvent)
    } else {
      noGameData++
      continue
    }

    // Action 이벤트: options 배열에 rewards 삽입
    if (rewardsByOption !== null) {
      if (rewardsByOption.length !== row.options.length) {
        if (VERBOSE) {
          console.log(`  [옵션 수 불일치] id=${gameId} game=${rewardsByOption.length} db=${row.options.length}`)
        }
        optionCountMismatch++
        // 옵션 수가 다를 경우 인덱스 범위 내에서만 처리
      }

      const newOptions = row.options.map((opt, i) => {
        const rewards = rewardsByOption[i] ?? []
        if (rewards.length === 0) return opt
        totalOptionsEnriched++
        totalRewardGroups += rewards.length
        return { ...opt, rewards }
      })

      // 하나라도 rewards가 추가되었는지 확인
      const hasAnyReward = newOptions.some(o => o.rewards && o.rewards.length > 0)
      if (!hasAnyReward) {
        noRewards++
        continue
      }

      updates.push({ id: gameId, options: newOptions })

    // Personality 이벤트: options 배열에 success/failure rewards 삽입
    // DB의 options는 success/failure 레이블을 message 필드로 구분
    } else if (personalityRewards !== null) {
      const hasAnyReward = Object.values(personalityRewards).some(r => r.length > 0)
      if (!hasAnyReward) {
        noRewards++
        continue
      }

      const newOptions = row.options.map((opt) => {
        // message 필드로 success/failure 판별
        const msg = (opt.message ?? '').toLowerCase()
        let rewards = null
        if (msg.includes('성공') || msg === 'success') {
          rewards = personalityRewards.success ?? []
        } else if (msg.includes('실패') || msg === 'failure') {
          rewards = personalityRewards.failure ?? []
        }
        if (!rewards || rewards.length === 0) return opt
        totalOptionsEnriched++
        totalRewardGroups += rewards.length
        return { ...opt, rewards }
      })

      const hasAny = newOptions.some(o => o.rewards && o.rewards.length > 0)
      if (!hasAny) {
        noRewards++
        continue
      }

      updates.push({ id: gameId, options: newOptions })
    }
  }

  console.log(`  게임 데이터 없음: ${noGameData}개`)
  console.log(`  options 없음: ${noOptions}개`)
  console.log(`  보상 없음: ${noRewards}개`)
  console.log(`  옵션 수 불일치: ${optionCountMismatch}개`)
  console.log(`  보강 대상 이벤트: ${updates.length}개`)
  console.log(`  보강된 옵션 수: ${totalOptionsEnriched}개`)
  console.log(`  총 보상 그룹 수: ${totalRewardGroups}개`)

  // 4. 상세 미리보기 (dry-run 또는 verbose)
  if (!FIX || VERBOSE) {
    const preview = updates.slice(0, 5)
    console.log('\n[4/5] 미리보기 (상위 5개):')
    for (const u of preview) {
      console.log(`\n  id=${u.id}`)
      for (const opt of u.options) {
        if (!opt.rewards) continue
        console.log(`    [${opt.message ?? ''}]`)
        for (const rg of opt.rewards) {
          const prob = typeof rg.probability === 'number' ? `${(rg.probability * 100).toFixed(0)}%` : rg.probability
          const effs = rg.effects.map(e => JSON.stringify(e)).join(', ')
          console.log(`      prob=${prob} effects=[${effs}]${rg.next_event_id ? ` -> event ${rg.next_event_id}` : ''}`)
        }
      }
    }
  }

  // 5. DB 업데이트
  if (!FIX) {
    console.log('\n[5/5] --dry-run 모드. DB 수정 없음. --fix 옵션으로 실행하세요.')
    return
  }

  console.log(`\n[5/5] DB 업데이트 (${updates.length}개)...`)
  let successCount = 0
  let failCount = 0

  for (let i = 0; i < updates.length; i++) {
    const { id, options } = updates[i]
    const { error } = await supabase
      .schema('limbus')
      .from('mirror_dungeon_events')
      .update({ options })
      .eq('id', id)

    if (error) {
      console.error(`  [${i + 1}/${updates.length}] id=${id} 실패: ${error.message}`)
      failCount++
    } else {
      if (VERBOSE) console.log(`  [${i + 1}/${updates.length}] id=${id} 완료`)
      successCount++
    }

    // 배치 간 짧은 딜레이 (rate limit 방지)
    if ((i + 1) % 50 === 0 && i + 1 < updates.length) {
      await new Promise(r => setTimeout(r, 100))
    }
  }

  console.log(`\n완료!`)
  console.log(`  성공: ${successCount}개`)
  if (failCount > 0) console.log(`  실패: ${failCount}개`)
  console.log(`  보강된 옵션: ${totalOptionsEnriched}개`)
  console.log(`  총 보상 그룹: ${totalRewardGroups}개`)
}

main().catch(e => { console.error(e); process.exit(1) })

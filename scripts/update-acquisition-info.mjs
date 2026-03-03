/**
 * acquisition 텍스트 → acquisition_info JSONB 변환 스크립트
 * 실행: node --env-file=.env.local scripts/update-acquisition-info.mjs
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const headers = {
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${SUPABASE_KEY}`,
  'Content-Type': 'application/json',
  'Accept-Profile': 'limbus',
  'Content-Profile': 'limbus',
}

// ── 시즌 시작일 ──
const SEASON_DATES = [
  { season: 1, start: '2023-02-27' },
  { season: 2, start: '2023-06-08' },
  { season: 3, start: '2023-09-14' },
  { season: 4, start: '2024-03-28' },
  { season: 5, start: '2024-10-03' },
  { season: 6, start: '2025-04-03' },
  { season: 7, start: '2025-12-18' },
]

function getSeasonFromDate(dateStr) {
  if (!dateStr) return 1
  for (let i = SEASON_DATES.length - 1; i >= 0; i--) {
    if (dateStr >= SEASON_DATES[i].start) return SEASON_DATES[i].season
  }
  return 1
}

const SINNER_NAMES = ['이상', '파우스트', '돈키호테', '료슈', '뫼르소', '홍루', '히스클리프', '이스마엘', '로쟈', '싱클레어', '오티스', '그레고르']

// ── 파서 ──
function parseAcquisition(acq, releaseDate) {
  if (!acq || acq === '기본') {
    return { type: 'default', release_season: 0, fragment_cost: null, gacha: 'none' }
  }

  const result = {
    type: 'standard',
    release_season: null,
    fragment_cost: null,
    gacha: 'always',
    gacha_from_season: null,
    target_sinner: null,
    exchange_from_season: null,
    walpurgis_edition: null,
    event_name: null,
    event_currency: null,
    event_cost: null,
  }

  // ── 파편 비용 추출 ──
  const fragMatch = acq.match(/파편\s*(\d+)\s*교환/)
  if (fragMatch) result.fragment_cost = parseInt(fragMatch[1])

  // ── 특정 추출 수감자 ──
  for (const sinner of SINNER_NAMES) {
    const re = new RegExp(`${sinner}\\s*특정\\s*추출`)
    if (re.test(acq)) {
      result.target_sinner = sinner
      const seasonRe = new RegExp(`${sinner}\\s*특정\\s*추출\\s*\\(?시즌\\s*(\\d+)\\s*이후\\)?`)
      const m = acq.match(seasonRe)
      if (m) result.gacha_from_season = parseInt(m[1])
      break
    }
  }

  // ── 메인 타입 분류 ──
  if (acq.includes('발푸르기스의 밤')) {
    // ▸ 발푸르기스
    result.type = 'walpurgis'
    result.gacha = 'walpurgis'
    const edMatch = acq.match(/(\d+)회차\s*이후/)
    if (edMatch) result.walpurgis_edition = parseInt(edMatch[1])

  } else if (acq.includes('출석 이벤트')) {
    // ▸ 출석 이벤트
    result.type = 'attendance'
    result.gacha = 'none'

  } else if (acq.includes('사전 예약')) {
    // ▸ 사전 예약
    result.type = 'standard'
    result.gacha = 'always'

  } else if (acq.includes('이벤트 추출')) {
    // ▸ 이벤트 추출 (시즌 한정 픽업)
    result.type = 'event'
    const evSeasonMatch = acq.match(/이벤트 추출\s*\(시즌\s*(\d+)\)/)
    if (evSeasonMatch) result.release_season = parseInt(evSeasonMatch[1])

    if (result.target_sinner) {
      result.gacha = 'seasonal'
    } else {
      // 이후 추출 가능 여부 체크
      const laterGacha = acq.match(/추출\s*\(시즌\s*(\d+)\s*이후\)/)
      if (laterGacha) {
        result.gacha = 'seasonal'
        result.gacha_from_season = parseInt(laterGacha[1])
      } else {
        result.gacha = 'none'
      }
    }

  } else if (/이벤트/.test(acq) && !acq.startsWith('추출')) {
    // ▸ 이벤트 재화 교환 / 이벤트 교환
    result.type = 'event'

    // "{이벤트명} 이벤트 {재화명} {N}개 교환/보상"
    const namedEvent = acq.match(/^(.+?)\s*이벤트\s+(.+?)\s+(\d+)개\s*(교환|보상)/)
    if (namedEvent) {
      result.event_name = namedEvent[1].trim()
      result.event_currency = namedEvent[2].trim()
      result.event_cost = parseInt(namedEvent[3])
    } else {
      // "{이벤트명} 이벤트 / ..."
      const simpleEvent = acq.match(/^(.+?)\s*이벤트\s*\//)
      if (simpleEvent) {
        result.event_name = simpleEvent[1].trim()
      }
      // "이벤트 재화 {N}개 교환"
      const genericEvent = acq.match(/이벤트\s*재화\s*(\d+)개\s*교환/)
      if (genericEvent) {
        result.event_cost = parseInt(genericEvent[1])
      }
      // "이벤트 교환" (generic)
    }

    if (result.target_sinner) {
      result.gacha = 'seasonal'
    } else {
      result.gacha = 'none'
    }

  } else {
    // ▸ 표준 (추출 / 파편 교환)
    result.type = 'standard'

    if (acq.includes('상시') || acq.match(/^추출\s*\//)) {
      // "추출(상시)" or "추출 / 파편..." (no season = old style always)
      result.gacha = 'always'
    }

    // "추출 (시즌 N 이후)" or "추출(시즌 N 이후)"
    const gachaSeasonMatch = acq.match(/추출\s*\(시즌\s*(\d+)\s*이후\)/)
    if (gachaSeasonMatch) {
      result.gacha = 'seasonal'
      result.gacha_from_season = parseInt(gachaSeasonMatch[1])
    }

    // "추출(시즌 N)" without 이후 (limited to that season)
    const gachaLimitedMatch = acq.match(/추출\s*\(시즌\s*(\d+)\)(?!\s*이후)/)
    if (gachaLimitedMatch && !gachaSeasonMatch) {
      result.gacha = 'seasonal'
      result.gacha_from_season = parseInt(gachaLimitedMatch[1])
    }

    // If has target sinner, override gacha
    if (result.target_sinner) {
      result.gacha = 'seasonal'
    }
  }

  // ── exchange_from_season 추출 ──
  // 교환 부분에서 "시즌 M 이후" 찾기 (마지막 매칭)
  const exchangeParts = acq.split('/').filter(p => p.includes('교환'))
  for (const part of exchangeParts) {
    if (part.includes('상시')) {
      result.exchange_from_season = null
      break
    }
    const allSeasons = [...part.matchAll(/시즌\s*(\d+)\s*이후/g)]
    if (allSeasons.length > 0) {
      result.exchange_from_season = parseInt(allSeasons[allSeasons.length - 1][1])
    }
  }

  // ── release_season 결정 ──
  if (result.release_season === null) {
    // acquisition 텍스트에서 첫 번째 시즌 추출
    const allSeasons = [...acq.matchAll(/시즌\s*(\d+)/g)]
    if (allSeasons.length > 0 && !acq.includes('상시')) {
      result.release_season = parseInt(allSeasons[0][1])
    } else {
      result.release_season = getSeasonFromDate(releaseDate)
    }
  }

  // ── null 필드 제거 (compact JSON) ──
  const cleaned = {
    type: result.type,
    release_season: result.release_season,
    fragment_cost: result.fragment_cost,
    gacha: result.gacha,
  }
  if (result.gacha_from_season !== null) cleaned.gacha_from_season = result.gacha_from_season
  if (result.target_sinner !== null) cleaned.target_sinner = result.target_sinner
  if (result.exchange_from_season !== null) cleaned.exchange_from_season = result.exchange_from_season
  if (result.walpurgis_edition !== null) cleaned.walpurgis_edition = result.walpurgis_edition
  if (result.event_name !== null) cleaned.event_name = result.event_name
  if (result.event_currency !== null) cleaned.event_currency = result.event_currency
  if (result.event_cost !== null) cleaned.event_cost = result.event_cost

  return cleaned
}

// ── 메인 ──
async function main() {
  // 1. 전체 인격 조회
  const res = await fetch(`${SUPABASE_URL}/rest/v1/identities?select=id,name_kr,acquisition,release_date&order=name_kr`, { headers })
  if (!res.ok) { console.error('Fetch failed:', res.status); process.exit(1) }
  const identities = await res.json()
  console.log(`총 ${identities.length}개 인격 조회\n`)

  let updated = 0, errors = 0

  for (const id of identities) {
    const info = parseAcquisition(id.acquisition, id.release_date)

    // 2. UPDATE
    const updateRes = await fetch(
      `${SUPABASE_URL}/rest/v1/identities?id=eq.${id.id}`,
      {
        method: 'PATCH',
        headers: { ...headers, Prefer: 'return=minimal' },
        body: JSON.stringify({ acquisition_info: info }),
      }
    )

    if (updateRes.ok) {
      updated++
      console.log(`✓ ${id.name_kr.padEnd(20)} → ${JSON.stringify(info)}`)
    } else {
      errors++
      console.error(`✗ ${id.name_kr}: ${updateRes.status} ${await updateRes.text()}`)
    }
  }

  console.log(`\n완료: ${updated} 업데이트, ${errors} 에러`)
}

main().catch(console.error)

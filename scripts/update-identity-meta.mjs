import { createClient } from '@supabase/supabase-js'

const sb = createClient(
  'https://lpgqcleszdlldneiwgep.supabase.co',
  'REMOVED'
)

// 내성: [참격, 관통, 타격] — 내성/보통/취약
// 단빵숲 API에서 추출한 데이터
const identityMeta = {
  'LCB Sinner': {
    slash_res: '취약', pierce_res: '내성', blunt_res: '보통',
    release_date: '2023-02-27', acquisition: '기본',
  },
  'Seven Assoc. South Section 6': {
    slash_res: '보통', pierce_res: '내성', blunt_res: '취약',
    release_date: '2023-02-27', acquisition: '추출(상시) / 파편 150 교환(상시)',
  },
  'Blade Lineage Salsu': {
    slash_res: '내성', pierce_res: '취약', blunt_res: '보통',
    release_date: '2023-02-27', acquisition: '사전 예약 보상 / 추출 / 파편 400 교환(상시)',
  },
  'Effloresced E.G.O Spicebush': {
    slash_res: '보통', pierce_res: '내성', blunt_res: '취약',
    release_date: '2023-06-15', acquisition: '추출 / 파편 400 교환(시즌 2 / 시즌 4 이후)',
  },
  'Molar Office Fixer': {
    slash_res: '내성', pierce_res: '취약', blunt_res: '보통',
    release_date: '2023-09-14', acquisition: '시즌 2 출석 이벤트 누적 14일 보상 / 자아 파편 150 교환(시즌 4 이후)',
  },
  'W Corp. L3 Cleanup Agent': {
    slash_res: '보통', pierce_res: '내성', blunt_res: '취약',
    release_date: '2023-11-09', acquisition: '추출(상시) / 자아 파편 400 교환(상시)',
  },
  'The Pequod First Mate': {
    slash_res: '취약', pierce_res: '내성', blunt_res: '보통',
    release_date: '2023-12-07', acquisition: '추출(시즌 3 이후) / 자아 파편 150 교환(시즌 3, 시즌 5 이후)',
  },
  'Dieci Assoc. South Section 4': {
    slash_res: '보통', pierce_res: '취약', blunt_res: '내성',
    release_date: '2024-01-25', acquisition: '추출(상시) / 자아 파편 150 교환(상시)',
  },
  'The Ring Pointillist Student': {
    slash_res: '보통', pierce_res: '내성', blunt_res: '취약',
    release_date: '2024-05-16', acquisition: '추출(상시) / 자아 파편 400 교환(상시)',
  },
  'Lobotomy E.G.O Solemn Lament': {
    slash_res: '보통', pierce_res: '내성', blunt_res: '취약',
    release_date: '2024-09-05', acquisition: '발푸르기스의 밤 기간 내 추출 / 발푸르기스의 밤 기간 내 자아 파편 400 교환(5회차 이후)',
  },
  'LCE E.G.O Lantern': {
    slash_res: '취약', pierce_res: '보통', blunt_res: '내성',
    release_date: '2025-01-23', acquisition: '이벤트 재화 500개 교환 / 이상 특정 추출(시즌 6 이후) / 자아 파편 150 교환(시즌 7 이후)',
  },
  'Liu Assoc. South Section 3': {
    slash_res: '내성', pierce_res: '보통', blunt_res: '취약',
    release_date: '2025-02-20', acquisition: '추출(상시) / 자아 파편 400 교환(상시)',
  },
  'N Corp. E.G.O Fell Bullet': {
    slash_res: '내성', pierce_res: '보통', blunt_res: '취약',
    release_date: '2025-07-03', acquisition: '추출(시즌 6 이후) / 자아 파편 400 교환(시즌 6 (2025.07.10 이후), 시즌 8 이후)',
  },
  'Heishou Pack - Wu Branch Adept': {
    slash_res: '내성', pierce_res: '취약', blunt_res: '보통',
    release_date: '2025-08-28', acquisition: '추출(시즌 6) / 이상 특정 추출(시즌 7 이후) / 자아 파편 400 교환',
  },
  'The House of Spiders The Index Nursefather': {
    slash_res: null, pierce_res: null, blunt_res: null,
    release_date: '2026-02-19', acquisition: '추출(시즌 7 이후) / 자아 파편 400 교환',
  },
}

async function main() {
  let updated = 0
  for (const [name, meta] of Object.entries(identityMeta)) {
    const { error } = await sb
      .schema('limbus')
      .from('identities')
      .update(meta)
      .eq('name', name)

    if (error) {
      console.error(`✗ ${name}: ${error.message}`)
    } else {
      console.log(`✓ ${name}`)
      updated++
    }
  }
  console.log(`\n${updated}/${Object.keys(identityMeta).length} identities updated`)
}

main()

import { createClient } from '@supabase/supabase-js'

const sb = createClient(
  'https://lpgqcleszdlldneiwgep.supabase.co',
  'REMOVED'
)

// keyword-descriptions.ts에서 파싱한 최대 스택 데이터
// migration-affiliation.sql 실행 후 이 스크립트를 실행하세요
const keywordMeta = {
  '충전': { desc: '소모 시 특정 스킬의 위력이 상승함. 최대 20까지 얻을 수 있음. 턴 종료 시 1 감소', maxStack: 20 },
  '취약': { desc: '한 턴 동안 스킬로 받는 피해가 수치에 비례하여 증가/감소 (최대 10)', maxStack: 10 },
  '보호': { desc: '한 턴 동안 스킬로 받는 피해가 수치에 비례하여 증가/감소 (최대 10)', maxStack: 10 },
  '피해량 증가': { desc: '한 턴 동안 스킬로 가하는 피해가 수치에 비례하여 증가 (최대 10)', maxStack: 10 },
  '피해량 감소': { desc: '한 턴 동안 스킬로 가하는 피해가 수치에 비례하여 감소 (최대 10)', maxStack: 10 },
  '부적': { desc: '최댓값 : 6...', maxStack: 6 },
  '흑염': { desc: '특수 화상 -최대값: 7...', maxStack: 7 },
  '마탄': { desc: '최대값: 7...', maxStack: 7 },
  '홍매화': { desc: '특수 출혈- 최대값: 10...', maxStack: 10 },
  '찢어진 추억': { desc: '...', maxStack: 7 },
  '흉탄': { desc: '...', maxStack: 3 },
  '대행 [헤르메스]': { desc: '...', maxStack: 8 },
  '각력 [오]': { desc: '...', maxStack: 6 },
  '카르마': { desc: '...', maxStack: 100 },
  // ... 전체 데이터는 keyword-descriptions.ts에 포함됨
}

async function main() {
  // keyword_meta 테이블이 있는지 확인
  const { error: testErr } = await sb
    .schema('limbus')
    .from('keyword_meta')
    .select('name')
    .limit(1)

  if (testErr) {
    console.error('keyword_meta 테이블이 없습니다. migration-affiliation.sql을 먼저 실행해주세요.')
    console.error(testErr.message)
    return
  }

  let inserted = 0
  for (const [name, { desc, maxStack }] of Object.entries(keywordMeta)) {
    const { error } = await sb
      .schema('limbus')
      .from('keyword_meta')
      .upsert({ name, description: desc, max_stack: maxStack })

    if (error) {
      console.error(`x ${name}: ${error.message}`)
    } else {
      console.log(`+ ${name} (max: ${maxStack})`)
      inserted++
    }
  }
  console.log(`\n${inserted}/${Object.keys(keywordMeta).length} keywords inserted`)
}

main()

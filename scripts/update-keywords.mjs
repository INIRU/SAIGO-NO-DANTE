import { createClient } from '@supabase/supabase-js'

const sb = createClient(
  'https://lpgqcleszdlldneiwgep.supabase.co',
  'REMOVED'
)

// 단빵숲 API 키워드 데이터 (영문 DB명 → 키워드 배열)
const identityKeywords = {
  // ── 이상 ──
  'LCB Sinner': ['침잠', '침잠 횟수', '취약', '피해량 증가', '정신력 회복'],
  'Seven Assoc. South Section 6': ['파열', '파열 횟수', '마비', '취약', '관통 취약'],
  'Blade Lineage Salsu': ['호흡', '호흡 횟수'],
  'Effloresced E.G.O Spicebush': ['침잠', '침잠 횟수', '침잠쇄도', '진동', '진동 횟수', '가중치 증가'],
  'Molar Office Fixer': ['진동', '진동 횟수', '진동 폭발', '방어 레벨 감소', '버림'],
  'W Corp. L3 Cleanup Agent': ['충전', '파열', '파열 횟수', '속박', '차원 균열', '충전 역장', '신속'],
  'The Pequod First Mate': ['호흡', '호흡 횟수', '출혈', '출혈 횟수', '코인 재사용/추가', '속박'],
  'Dieci Assoc. South Section 4': ['탐구한 지식', '버림', '도발치', '침잠 횟수', '침잠'],
  'The Ring Pointillist Student': ['무작위 디버프', '출혈', '코인 재사용/추가', '공격 레벨 증가'],
  'Lobotomy E.G.O Solemn Lament': ['산나비·죽은나비', '나비', '재장전 - 이상', '침잠', '침잠 횟수', '신속', '공명'],
  'LCE E.G.O Lantern': ['미끼 요정', '파괴 불가 코인', '도발치', '파열', '파열 횟수', '정신력 회복', '속박', '자원 변경'],
  'Liu Assoc. South Section 3': ['화상', '화상 횟수', '정신력 회복', '공명'],
  'N Corp. E.G.O Fell Bullet': ['흉탄', '찢어진 추억', '호흡', '호흡 횟수', '출혈', '출혈 횟수', '피아 식별 불가', '파괴 불가 코인', '가중치 증가', '정신력 회복'],
  'Heishou Pack - Wu Branch Adept': ['각력 [오]', '적진 주파', '호령', '뇌진탕', '파열', '파열 횟수', '진동', '진동 횟수', '속박', '파괴 불가 코인', '합 가능 가드'],
  'The House of Spiders The Index Nursefather': ['대행 [헤르메스]', '신(心) - 운명', '상처를 가린 가면', '이글거리는 상처', '지령 탐닉', '인정 욕구 충족', '손도끼로 갈비뼈를 찍어 내릴 때는…', '바스타드 소드로 어깨와 머리를 짓이길 때는…', '레이피어로 몸에 10개 이상의 구멍을 내야할 때는…', '망치로 뒤통수를 으깨야 할 때는…', '커다란 검으로 몸통을 갈라야 할 때는…', '랜스로 20인치의 구멍을 내야 할 때는…', '채찍으로 살점을 만 갈래 떼어내야 할 때는…', '낫으로… 누군가처럼 공간을 따라 베어내야 할 때는…', '지령', '지령[단말기] I', '지령[단말기] II', '지령[단말기] III - 검지 아비', '지령[단말기] IV', '해금', '해금-Ⅰ', '해금-Ⅱ', '해금-Ⅲ', '지령 표식', '지령 대상', '지령의 가호', '카르마', '호흡', '호흡 횟수', '침잠', '침잠 횟수'],
}

async function main() {
  let updated = 0
  for (const [name, keywords] of Object.entries(identityKeywords)) {
    const { error } = await sb
      .schema('limbus')
      .from('identities')
      .update({ keywords })
      .eq('name', name)

    if (error) {
      console.error(`✗ ${name}: ${error.message}`)
    } else {
      console.log(`✓ ${name} (${keywords.length} keywords)`)
      updated++
    }
  }
  console.log(`\n${updated}/${Object.keys(identityKeywords).length} identities updated`)
}

main()

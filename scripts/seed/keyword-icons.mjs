/**
 * scripts/seed/keyword-icons.mjs
 * keyword_meta 테이블에 icon_slug, sin_affinity 컬럼을 PATCH로 업데이트
 *
 * 실행: node --env-file=.env.local scripts/seed/keyword-icons.mjs
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SECRET_KEY

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ .env.local에서 NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SECRET_KEY를 설정해주세요.')
  process.exit(1)
}

const headers = {
  apikey:            SUPABASE_KEY,
  Authorization:     `Bearer ${SUPABASE_KEY}`,
  'Content-Type':    'application/json',
  'Accept-Profile':  'limbus',
  'Content-Profile': 'limbus',
  Prefer:            'resolution=merge-duplicates,return=minimal',
}

// ── 키워드 → 죄악 속성 매핑 ────────────────────────────────────────────────
const KEYWORD_SIN_MAP = {
  '출혈':          'wrath',
  '화상':          'lust',
  '침잠':          'gloom',
  '파열':          'gluttony',
  '호흡':          'pride',
  '충전':          'envy',
  '진동':          'sloth',
  '진동 폭발':     'sloth',
  '진동 - 과다출혈': 'sloth',
  '진동 - 반향':   'sloth',
  '진동 - 붕괴':   'sloth',
  '진동 - 사슬':   'sloth',
  '진동 - 작열':   'sloth',
  '진폭 변환':     'sloth',
  '진폭 얽힘':     'sloth',
  '과충전':        'envy',
}

// ── 키워드 → 아이콘 슬러그 매핑 ──────────────────────────────────────────────
const KEYWORD_ICON_MAP = {
  // 기본 공격 유형: keyword icon upload가 아니라 canonical stat icon resolver에서 처리
  '참격': 'stat:slash', '관통': 'stat:pierce', '타격': 'stat:blunt',
  // 상태이상
  '출혈': 'bleed', '화상': 'burn', '파열': 'rupture', '침잠': 'sinking',
  '진동': 'tremor', '충전': 'charge', '마비': 'paralysis', '속박': 'bind',
  '취약': 'fragile', '호흡': 'breath', '신속': 'haste',
  // 진동 파생
  '진동 폭발': 'tremor-burst', '진동 - 과다출혈': 'tremor-hemorrhage',
  '진동 - 반향': 'tremor-reverb', '진동 - 붕괴': 'tremor-collapse',
  '진동 - 사슬': 'tremor-chain', '진동 - 작열': 'tremor-scorch',
  '진폭 변환': 'amplitude-conversion', '진폭 얽힘': 'amplitude-entangle',
  '침잠쇄도': 'sinking-deluge', '충전 역장': 'charge-barrier', '과충전': 'overcharge',
  // 레벨/위력
  '공격 레벨 증가': 'atk-level-up', '공격 레벨 감소': 'atk-level-down',
  '공격 레벨+': 'offense-level-up',
  '방어 레벨 증가': 'def-level-up', '방어 레벨 감소': 'def-level-down',
  '공격 위력 증가': 'atk-power-up', '공격 위력 감소': 'atk-power-down',
  '수비 위력 증가': 'def-power-up', '수비 위력 감소': 'def-power-down',
  '합 위력 증가': 'clash-power-up',
  // 피해량
  '피해량 증가': 'dmg-up', '피해량 감소': 'dmg-down',
  '참격 위력 증가': 'slash-power-up', '관통 위력 증가': 'pierce-power-up',
  '타격 위력 증가': 'blunt-power-up', '참격 피해량 증가': 'slash-dmg-up',
  '관통 피해량 증가': 'pierce-dmg-up', '타격 피해량 증가': 'blunt-dmg-up',
  '분노 피해량 증가': 'wrath-dmg-up', '오만 위력 증가': 'pride-power-up',
  '질투 위력 증가': 'envy-power-up', '질투 피해량 증가': 'envy-dmg-up',
  '우울 피해량 증가': 'gloom-dmg-up', '탐식 피해량 증가': 'gluttony-dmg-up',
  '크리티컬 피해량 증가': 'crit-dmg-up',
  // 취약/보호
  '참격 취약': 'slash-fragile', '관통 취약': 'pierce-fragile',
  '타격 취약': 'blunt-fragile', '질투 취약': 'envy-fragile',
  '참격 보호': 'slash-protection', '파열 보호': 'rupture-protection', '보호': 'protection',
  // 코인
  '파괴 불가 코인': 'unbreakable-coin', '더하기 코인 강화': 'plus-coin-boost',
  '더하기 코인 약화': 'plus-coin-weaken',
  // 기본
  '도발치': 'aggro', '나비': 'butterfly', '뇌진탕': 'concussion', '버림': 'discard',
  '해금': 'unlock', '카르마': 'karmic-consequence', '광신': 'fanaticism', '못': 'nail',
  '탄환': 'ammo', '방어 태세': 'defense-stance', '합 가능 가드': 'clash-guard',
  '체력 회복 감소': 'hp-heal-down', '체력 회복': 'hp-heal-up',
  '정신력 회복': 'sp-heal-up',
  // 이상 전용
  '산나비·죽은나비': 'living-dead-butterfly', '재장전 - 이상': 'reload-yi-sang',
  '찢어진 추억': 'torn-memory', '흉탄': 'fell-bullet', '대행 [헤르메스]': 'proxy-hermes',
  '신(心) - 운명': 'heart-fate', '상처를 가린 가면': 'wound-hiding-mask',
  '이글거리는 상처': 'searing-wound', '인정 욕구 충족': 'recognition-fulfillment',
  '지령 탐닉': 'directive-indulgence', '미끼 요정': 'lure-fairy',
  '적진 주파': 'charge-enemy-lines', '각력 [오]': 'wrestling-wu',
  '탐구한 지식': 'studied-knowledge', '차원 균열': 'dimensional-rift', '호령': 'command',
  // 지령 계열
  '지령': 'directive', '지령 대상': 'directive-target', '지령 표식': 'directive-mark',
  '지령의 가호': 'directive-blessing', '지령[단말기]': 'directive-terminal',
  '지령[단말기] I': 'directive-terminal-1', '지령[단말기] II': 'directive-terminal-2',
  '지령[단말기] III': 'directive-terminal-3',
  '지령[단말기] III - 검지 아비': 'directive-terminal-3-index-father',
  '지령[단말기] IV': 'directive-terminal-4',
  '지령[쪽지] Ⅰ': 'directive-note-1', '지령[쪽지] Ⅱ': 'directive-note-2',
  '지령[쪽지] Ⅲ': 'directive-note-3', '지령[쪽지] Ⅳ': 'directive-note-4',
  '해금-Ⅰ': 'unlock-1', '해금-Ⅱ': 'unlock-2', '해금-Ⅲ': 'unlock-3',
  '신(心)-대행': 'heart-proxy',
  // 흑수 계열
  '각력 [묘]': 'wrestling-myo', '주살 [독]': 'execution-poison',
  '주살 [신속]': 'execution-haste', '주살 [파]': 'execution-wave',
  '붕괴 표식': 'collapse-mark', '사완': 'sawan', '혈염 [血炎]': 'blood-flame',
  '혈투본능': 'bloodfight-instinct', '흑수환염': 'heuksoo-flame',
  '흑운도': 'dark-cloud-blade', '임전': 'war-ready', '검은 구름': 'dark-cloud',
  '구름 장벽': 'cloud-barrier', '모든 흑수의 주인': 'master-of-heuksoo',
  '오혈': 'five-blood', '사중구활': 'four-death-nine-life', '존명': 'preserve-life',
  '몰아침': 'onslaught', '전장 퇴각': 'battlefield-retreat',
  '호위': 'escort', '호위태세': 'escort-stance',
  '발각[發角]': 'horn-strike', '파쇄흔': 'crush-mark',
  // 라만차 계열
  '라만차 퍼레이드': 'la-mancha-parade', '경혈': 'acupoint', '경혈 갑주': 'acupoint-armor',
  '혈찬': 'blood-meal', '누적 소모 혈찬': 'cumulative-blood-meal',
  '공용 누적 소모 혈찬': 'shared-cumulative-blood-meal',
  '일렁임[혈귀]': 'ripple-blood-ghost', '책임감': 'responsibility',
  '피어나는 가시': 'blooming-thorn', '축제의 열기': 'festival-heat',
  '닳아버린 마음': 'worn-out-heart', '피로 물든 손': 'blood-stained-hands',
  '재봉 대상': 'sewing-target', '핏빛 가위날': 'blood-scissors', '연기 집중': 'acting-focus',
  // 로보토미 계열
  '현혹': 'mesmerize', '램프': 'lamp', '숲의 파수꾼': 'forest-guardian',
  '마탄': 'magic-bullet', '흑염': 'black-flame', '적안': 'red-eye', '참회': 'repentance',
  '하얗게 태워버렸군': 'burned-white', '지키는 검': 'guarding-sword',
  '깊은 눈물': 'deep-tears', '눈물 벼리기': 'tear-forging', '꿰뚫는 검': 'piercing-sword',
  '가호': 'blessing', '절망': 'despair', '사랑 증오': 'love-hate',
  '마법소녀 등장!': 'magical-girl-entry', '매지컬 아르카나': 'magical-arcana',
  '악당 표식': 'villain-mark', '역변 - 리버스드': 'reverse-reversed', '히스테리': 'hysteria',
  // 마침표 계열
  '타겟 포착': 'target-lock', '재장전': 'reload',
  '탄환 - 로직 아틀리에': 'ammo-logic-atelier', '집중[저격]': 'focus-snipe',
  '근접 지원': 'close-support', '후방 지원 배치': 'rear-support-deploy',
  // T사 계열
  '시간 대여': 'time-lending', '시간 유예': 'time-grace', '강력 징수 집행': 'forced-collection',
  // W사/기타 협회
  '부하': 'subordinate', '화살 - 시': 'arrow-shi', '박힌 화살': 'lodged-arrow',
  '목표 조준': 'aim-target', '저격 자세': 'sniper-stance', '절명': 'fatal-strike',
  '호표탄': 'tiger-bullet', '맹호표탄': 'fierce-tiger-bullet',
  '강기 [剛氣]': 'strong-ki', '강기 - 신 [剛氣-心]': 'strong-ki-heart',
  '오버히트': 'overheat', '작열 추진탄': 'incendiary-propulsion',
  '약점 분석': 'weakness-analysis', '결투 선포': 'duel-declaration',
  '1대1 대결': 'one-on-one', '지식 단련': 'knowledge-training',
  // 검계
  '홍매화': 'red-plum-blossom', '본국검술': 'homeland-swordsmanship',
  '본국검 - 세법 전수': 'homeland-sword-technique-1',
  '본국검 - 자법 전수': 'homeland-sword-technique-2',
  // 에드가/워더링하이츠
  '버.표': 'butler-mark', '저택의 메아리': 'mansion-echo',
  // 기타
  '부적': 'talisman', '불안정한 격정': 'unstable-passion',
  '12구산 연료': '12th-district-fuel', '과열 연료': 'overheated-fuel',
  '갈증': 'thirst', '광역 난사': 'area-barrage', '광전': 'berserk',
  '부당 수익': 'illicit-profit', '복수 대상': 'revenge-target',
  '앙갚음 대상': 'retaliation-target', '앙갚음 장부 [싱클레어]': 'retaliation-ledger-sinclair',
  '광 [光]': 'light', '짝패 - 송학': 'pair-crane', '짝패 - 억새': 'pair-silvergrass',
  '짝패 - 청벚꽃': 'pair-blue-cherry', '점혈 - 돈키호테': 'pressure-point-don-quixote',
  '열선': 'heat-wire', '중지식 강화 문신': 'middle-finger-tattoo',
  '중지 - 원한': 'middle-finger-grudge', '월하청도': 'moonlight-blade',
  '집중 공격': 'focused-attack', '주시': 'watch', '다가오는 파탄': 'approaching-ruin',
  '관': 'coffin', '와일드헌트': 'wild-hunt', '듀라한': 'dullahan',
  '시선': 'gaze', '경멸': 'contempt', '경멸의 시선': 'contemptuous-gaze',
  '시선의 경멸': 'gaze-of-contempt', 'K사 앰플': 'k-corp-ampule',
  '딜리버리 캐리어 - 로쟈': 'delivery-carrier-rodion',
  '딜리버리 캐리어 - 싱클레어': 'delivery-carrier-sinclair',
  '전략적 휴식 복지 모드': 'strategic-rest-mode', '셰우트의 균열': 'sheut-fracture',
  '우제트의 눈 [선봉]': 'udjat-eye-vanguard', '푸른 모래': 'blue-sand',
  'LCA 균열탄': 'lca-fracture-ammo', '가열된 가스 작살': 'heated-gas-harpoon',
  '과열된 가스 작살': 'overheated-gas-harpoon', '원호 공격': 'assist-attack',
  '원호 방어': 'assist-defense', '시[始]': 'beginning', '대[待]': 'waiting',
  '원[援]': 'support', '천구성도': 'celestial-chart',
  '뜻에 따라, 베겠습니다.': 'by-your-will-i-shall-cut',
  '강렬한 색채': 'IntenseColorsRodion',
  '과감한 터치': 'BoldBrushstrokesRodion',
  '고전압 외피': 'high-voltage-exoskeleton',
  '구속 해제 - 창작 몰입': 'the-self-unbound-flow-state',
  '전하침': 'charged-sting',
  '진동 - 중첩': 'tremor-superposition',
  '집중【저격】': 'concentration-sniper',
  '천퇴성[天退星]': 'heavenly-retreat',
  '손도끼로 갈비뼈를 찍어 내릴 때는…': 'hatchet-ribs',
  '바스타드 소드로 어깨와 머리를 짓이길 때는…': 'bastard-sword-shoulders',
  '레이피어로 몸에 10개 이상의 구멍을 내야할 때는…': 'rapier-ten-holes',
  '망치로 뒤통수를 으깨야 할 때는…': 'hammer-skull',
  '커다란 검으로 몸통을 갈라야 할 때는…': 'greatsword-torso',
  '랜스로 20인치의 구멍을 내야 할 때는…': 'lance-twenty-inch',
  '채찍으로 살점을 만 갈래 떼어내야 할 때는…': 'whip-flesh',
  '낫으로… 누군가처럼 공간을 따라 베어내야 할 때는…': 'scythe-cut-space',
  '당연한 믿음': 'natural-faith',
  // 잔향 료슈 / 호넷 뫼르소 등
  '고독': 'solitude', '탄환-고독': 'ammo-solitude', '잔향': 'reverberation',
  '꽃잎': 'petal', '리듬': 'rhythm',
  '포자': 'spore', '포자탄[기본]': 'spore-ammo-basic', '포자탄[산탄]': 'spore-ammo-shotgun',
  '충성 페로몬': 'loyalty-pheromone', '재장전[포자보충]': 'reload-spore-resupply',
}

// 모든 고유 키워드 수집 (icon_slug 또는 sin_affinity가 있는 것)
const allKeywords = new Set([
  ...Object.keys(KEYWORD_ICON_MAP),
  ...Object.keys(KEYWORD_SIN_MAP),
])

async function patchKeyword(name, payload) {
  const encoded = encodeURIComponent(name)
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/keyword_meta?name=eq.${encoded}`,
    {
      method: 'PATCH',
      headers,
      body: JSON.stringify(payload),
    }
  )
  if (!res.ok) {
    const text = await res.text()
    console.error(`  ❌ PATCH 실패 [${name}]: ${res.status} ${text}`)
    return false
  }
  return true
}

async function main() {
  console.log(`총 ${allKeywords.size}개 키워드 처리 시작...`)

  let ok = 0
  let fail = 0

  for (const kw of allKeywords) {
    const payload = {}
    if (KEYWORD_ICON_MAP[kw]) payload.icon_slug = KEYWORD_ICON_MAP[kw]
    if (KEYWORD_SIN_MAP[kw]) payload.sin_affinity = KEYWORD_SIN_MAP[kw]

    const success = await patchKeyword(kw, payload)
    if (success) {
      ok++
      console.log(`  ✓ ${kw} → icon_slug: ${payload.icon_slug ?? '-'}, sin_affinity: ${payload.sin_affinity ?? '-'}`)
    } else {
      fail++
    }
  }

  console.log(`\n완료: ${ok}개 성공, ${fail}개 실패`)
}

main().catch(err => {
  console.error('❌ 오류:', err)
  process.exit(1)
})

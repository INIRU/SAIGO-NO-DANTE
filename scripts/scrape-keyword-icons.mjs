/**
 * scrape-keyword-icons.mjs
 *
 * 나무위키 수감자 인게임 정보 페이지에서 전용 키워드 아이콘을 추출하여
 * Supabase Storage에 업로드하고 keyword_meta.icon_slug를 업데이트한다.
 *
 * Usage:
 *   node --env-file=.env.local scripts/scrape-keyword-icons.mjs [--dry-run] [--sinner <slug>]
 */

import { chromium } from 'playwright'
import https from 'https'
import http from 'http'

const env = process.env
const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY = env.SUPABASE_SECRET_KEY

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE env vars')
  process.exit(1)
}

const headers = {
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${SUPABASE_KEY}`,
  'Content-Type': 'application/json',
  'Accept-Profile': 'limbus',
  'Content-Profile': 'limbus',
}

const args = process.argv.slice(2)
const DRY_RUN = args.includes('--dry-run')
const sinnerArgIdx = args.indexOf('--sinner')
const sinnerFilter = sinnerArgIdx !== -1 ? args[sinnerArgIdx + 1] : null
const STAT_ICON_KEYWORDS = new Map([
  ['참격', 'stat:slash'],
  ['관통', 'stat:pierce'],
  ['타격', 'stat:blunt'],
])

// ── 수감자별 나무위키 URL ──
const WIKI_URLS = {
  'yi-sang':     'https://namu.wiki/w/이상(Project%20Moon%20세계관)/인게임%20정보',
  'faust':       'https://namu.wiki/w/파우스트(Project%20Moon%20세계관)/인게임%20정보',
  'don-quixote': 'https://namu.wiki/w/돈키호테(Project%20Moon%20세계관)/인게임%20정보',
  'ryoshu':      'https://namu.wiki/w/료슈/인게임%20정보',
  'meursault':   'https://namu.wiki/w/뫼르소/인게임%20정보',
  'hong-lu':     'https://namu.wiki/w/홍루/인게임%20정보',
  'heathcliff':  'https://namu.wiki/w/히스클리프(Project%20Moon%20세계관)/인게임%20정보',
  'ishmael':     'https://namu.wiki/w/이스마엘(Project%20Moon%20세계관)/인게임%20정보',
  'rodion':      'https://namu.wiki/w/로쟈(Project%20Moon%20세계관)/인게임%20정보',
  'sinclair':    'https://namu.wiki/w/싱클레어(Project%20Moon%20세계관)/인게임%20정보',
  'outis':       'https://namu.wiki/w/오티스(Project%20Moon%20세계관)/인게임%20정보',
  'gregor':      'https://namu.wiki/w/그레고르(Project%20Moon%20세계관)/인게임%20정보',
}

// ── 기존 upload-keyword-icons.mjs의 KEYWORD_EN_MAP 통합 ──
// 한글 키워드 → 영문 slug 매핑
// 새 키워드가 발견되면 자동으로 slug 생성
const KNOWN_SLUGS = {
  '출혈': 'bleed', '화상': 'burn', '파열': 'rupture', '침잠': 'sinking',
  '진동': 'tremor', '충전': 'charge', '마비': 'paralysis', '속박': 'bind',
  '취약': 'fragile', '호흡': 'breath', '신속': 'haste',
  '진동 폭발': 'tremor-burst', '진동 - 과다출혈': 'tremor-hemorrhage',
  '진동 - 반향': 'tremor-reverb', '진동 - 붕괴': 'tremor-collapse',
  '진동 - 사슬': 'tremor-chain', '진동 - 작열': 'tremor-scorch',
  '진동 - 균열': 'tremor-crack', '진동 - 영속': 'tremor-persist',
  '진동 - 태엽감기': 'tremor-windup',
  '진폭 변환': 'amplitude-conversion', '진폭 얽힘': 'amplitude-entangle',
  '침잠쇄도': 'sinking-deluge', '충전 역장': 'charge-barrier', '과충전': 'overcharge',
  '공격 레벨 증가': 'atk-level-up', '공격 레벨 감소': 'atk-level-down',
  '공격 레벨+': 'offense-level-up',
  '방어 레벨 증가': 'def-level-up', '방어 레벨 감소': 'def-level-down',
  '공격 위력 증가': 'atk-power-up', '공격 위력 감소': 'atk-power-down',
  '수비 위력 증가': 'def-power-up', '수비 위력 감소': 'def-power-down',
  '합 위력 증가': 'clash-power-up', '합 위력 감소': 'clash-power-down',
  '피해량 증가': 'dmg-up', '피해량 감소': 'dmg-down',
  '위력 증가': 'power-up', '위력 감소': 'power-down',
  '참격 위력 증가': 'slash-power-up', '관통 위력 증가': 'pierce-power-up',
  '타격 위력 증가': 'blunt-power-up',
  '참격 위력 감소': 'slash-power-down', '관통 위력 감소': 'pierce-power-down',
  '타격 위력 감소': 'blunt-power-down',
  '참격 피해량 증가': 'slash-dmg-up', '관통 피해량 증가': 'pierce-dmg-up',
  '타격 피해량 증가': 'blunt-dmg-up',
  '참격 피해량 감소': 'slash-dmg-down', '관통 피해량 감소': 'pierce-dmg-down',
  '타격 피해량 감소': 'blunt-dmg-down',
  '분노 피해량 증가': 'wrath-dmg-up', '오만 위력 증가': 'pride-power-up',
  '질투 위력 증가': 'envy-power-up', '질투 피해량 증가': 'envy-dmg-up',
  '우울 피해량 증가': 'gloom-dmg-up', '탐식 피해량 증가': 'gluttony-dmg-up',
  '크리티컬 피해량 증가': 'crit-dmg-up',
  '참격 취약': 'slash-fragile', '관통 취약': 'pierce-fragile',
  '타격 취약': 'blunt-fragile', '질투 취약': 'envy-fragile',
  '참격 보호': 'slash-protection', '관통 보호': 'pierce-protection',
  '타격 보호': 'blunt-protection', '파열 보호': 'rupture-protection',
  '보호': 'protection',
  '파괴 불가 코인': 'unbreakable-coin',
  '더하기 코인 강화': 'plus-coin-boost', '더하기 코인 약화': 'plus-coin-weaken',
  '도발치': 'aggro', '나비': 'butterfly', '뇌진탕': 'concussion',
  '버림': 'discard', '해금': 'unlock', '카르마': 'karmic-consequence',
  '광신': 'fanaticism', '못': 'nail', '탄환': 'ammo', '방어 태세': 'defense-stance',
  '합 가능 가드': 'clash-guard', '체력 회복 감소': 'hp-heal-down',
  '체력 회복 증가': 'hp-heal-up', '체력 회복': 'hp-heal-up',
  '정신력 회복': 'sp-heal-up',
  '산나비·죽은나비': 'living-dead-butterfly',
  '재장전 - 이상': 'reload-yi-sang', '찢어진 추억': 'torn-memory',
  '흉탄': 'fell-bullet', '대행 [헤르메스]': 'proxy-hermes',
  '신(心) - 운명': 'heart-fate', '상처를 가린 가면': 'wound-hiding-mask',
  '이글거리는 상처': 'searing-wound', '인정 욕구 충족': 'recognition-fulfillment',
  '지령 탐닉': 'directive-indulgence', '미끼 요정': 'lure-fairy',
  '적진 주파': 'charge-enemy-lines',
  '각력 [오]': 'wrestling-wu', '각력【오】': 'wrestling-wu',
  '탐구한 지식': 'studied-knowledge', '차원 균열': 'dimensional-rift',
  '호령': 'command',
  '지령': 'directive', '지령 대상': 'directive-target',
  '지령 표식': 'directive-mark', '지령의 가호': 'directive-blessing',
  '지령[단말기]': 'directive-terminal',
  '지령[단말기] I': 'directive-terminal-1', '지령[단말기] II': 'directive-terminal-2',
  '지령[단말기] III': 'directive-terminal-3',
  '지령[단말기] III - 검지 아비': 'directive-terminal-3-index-father',
  '지령[단말기] IV': 'directive-terminal-4',
  '지령[쪽지] Ⅰ': 'directive-note-1', '지령[쪽지] Ⅱ': 'directive-note-2',
  '지령[쪽지] Ⅲ': 'directive-note-3', '지령[쪽지] Ⅳ': 'directive-note-4',
  '지령[쪽지] I': 'directive-note-1', '지령[쪽지] II': 'directive-note-2',
  '지령[쪽지] III': 'directive-note-3', '지령[쪽지] IV': 'directive-note-4',
  '해금-Ⅰ': 'unlock-1', '해금-Ⅱ': 'unlock-2', '해금-Ⅲ': 'unlock-3',
  '해금 -Ⅰ': 'unlock-1', '해금 -Ⅱ': 'unlock-2', '해금 - Ⅲ': 'unlock-3',
  '해금 - Ⅰ': 'unlock-1', '해금 - Ⅱ': 'unlock-2',
  '신(心)-대행': 'heart-proxy', '신(心) - 대행': 'heart-proxy',
  '각력 [묘]': 'wrestling-myo', '각력【묘】': 'wrestling-myo',
  '주살 [독]': 'execution-poison', '주살【독】': 'execution-poison',
  '주살 [신속]': 'execution-haste', '주살【신속】': 'execution-haste',
  '주살 [파]': 'execution-wave', '주살【파】': 'execution-wave',
  '붕괴 표식': 'collapse-mark', '사완': 'sawan',
  '혈염 [血炎]': 'blood-flame', '혈투본능': 'bloodfight-instinct',
  '흑수환염': 'heuksoo-flame', '흑수환염[黑獸丸染]': 'heuksoo-flame',
  '흑운도': 'dark-cloud-blade', '임전': 'war-ready',
  '검은 구름': 'dark-cloud', '구름 장벽': 'cloud-barrier',
  '모든 흑수의 주인': 'master-of-heuksoo',
  '오혈': 'five-blood', '사중구활': 'four-death-nine-life',
  '사중구활[死中求活]': 'four-death-nine-life',
  '존명': 'preserve-life', '몰아침': 'onslaught',
  '전장 퇴각': 'battlefield-retreat', '호위': 'escort',
  '호위태세': 'escort-stance', '발각[發角]': 'horn-strike', '파쇄흔': 'crush-mark',
  '라만차 퍼레이드': 'la-mancha-parade',
  '경혈': 'acupoint', '경혈 갑주': 'acupoint-armor',
  '혈찬': 'blood-meal', '누적 소모 혈찬': 'cumulative-blood-meal',
  '공용 누적 소모 혈찬': 'shared-cumulative-blood-meal',
  '일렁임[혈귀]': 'ripple-blood-ghost', '일렁임 [혈귀]': 'ripple-blood-ghost',
  '책임감': 'responsibility', '피어나는 가시': 'blooming-thorn',
  '축제의 열기': 'festival-heat', '닳아버린 마음': 'worn-out-heart',
  '피로 물든 손': 'blood-stained-hands', '재봉 대상': 'sewing-target',
  '핏빛 가위날': 'blood-scissors', '연기 집중': 'acting-focus',
  '현혹': 'mesmerize', '램프': 'lamp', '숲의 파수꾼': 'forest-guardian',
  '마탄': 'magic-bullet', '흑염': 'black-flame', '적안': 'red-eye',
  '참회': 'repentance', '하얗게 태워버렸군': 'burned-white',
  '지키는 검': 'guarding-sword', '깊은 눈물': 'deep-tears',
  '눈물 벼리기': 'tear-forging', '꿰뚫는 검': 'piercing-sword',
  '가호': 'blessing', '절망': 'despair',
  '사랑 증오': 'love-hate', '사랑/증오': 'love-hate',
  '마법소녀 등장!': 'magical-girl-entry', '매지컬 아르카나': 'magical-arcana',
  '악당 표식': 'villain-mark',
  '역변 - 리버스드': 'reverse-reversed', '역변-리버스드': 'reverse-reversed',
  '히스테리': 'hysteria',
  '타겟 포착': 'target-lock', '재장전': 'reload',
  '탄환 - 로직 아틀리에': 'ammo-logic-atelier',
  '집중[저격]': 'focus-snipe', '근접 지원': 'close-support',
  '후방 지원 배치': 'rear-support-deploy',
  '시간 대여': 'time-lending', '시간 유예': 'time-grace',
  '강력 징수 집행': 'forced-collection',
  '부하': 'subordinate',
  '화살 - 시': 'arrow-shi', '박힌 화살': 'lodged-arrow',
  '목표 조준': 'aim-target', '저격 자세': 'sniper-stance',
  '절명': 'fatal-strike', '호표탄': 'tiger-bullet',
  '맹호표탄': 'fierce-tiger-bullet',
  '강기 [剛氣]': 'strong-ki', '강기 - 신 [剛氣-心]': 'strong-ki-heart',
  '오버히트': 'overheat', '작열 추진탄': 'incendiary-propulsion',
  '약점 분석': 'weakness-analysis', '결투 선포': 'duel-declaration',
  '1대1 대결': 'one-on-one', '지식 단련': 'knowledge-training',
  '홍매화': 'red-plum-blossom', '본국검술': 'homeland-swordsmanship',
  '본국검 - 세법 전수': 'homeland-sword-technique-1',
  '본국검 - 자법 전수': 'homeland-sword-technique-2',
  '버.표': 'butler-mark', '저택의 메아리': 'mansion-echo',
  '부적': 'talisman', '불안정한 격정': 'unstable-passion',
  '12구산 연료': '12th-district-fuel', '과열 연료': 'overheated-fuel',
  '갈증': 'thirst', '광역 난사': 'area-barrage', '광전': 'berserk',
  '부당 수익': 'illicit-profit', '복수 대상': 'revenge-target',
  '앙갚음 대상': 'retaliation-target',
  '앙갚음 장부 [싱클레어]': 'retaliation-ledger-sinclair',
  '광 [光]': 'light', '광【光】': 'light',
  '짝패 - 송학': 'pair-crane', '짝패 - 억새': 'pair-silvergrass',
  '짝패 - 청벚꽃': 'pair-blue-cherry',
  '점혈 - 돈키호테': 'pressure-point-don-quixote',
  '열선': 'heat-wire', '중지식 강화 문신': 'middle-finger-tattoo',
  '중지 - 원한': 'middle-finger-grudge', '월하청도': 'moonlight-blade',
  '집중 공격': 'focused-attack', '주시': 'watch',
  '다가오는 파탄': 'approaching-ruin', '관': 'coffin',
  '와일드헌트': 'wild-hunt', '듀라한': 'dullahan',
  '시선': 'gaze', '경멸': 'contempt',
  '경멸의 시선': 'contemptuous-gaze', '시선의 경멸': 'gaze-of-contempt',
  'K사 앰플': 'k-corp-ampule',
  '딜리버리 캐리어 - 로쟈': 'delivery-carrier-rodion',
  '딜리버리 캐리어 - 싱클레어': 'delivery-carrier-sinclair',
  '전략적 휴식 복지 모드': 'strategic-rest-mode',
  '셰우트의 균열': 'sheut-fracture',
  '우제트의 눈 [선봉]': 'udjat-eye-vanguard',
  '푸른 모래': 'blue-sand', 'LCA 균열탄': 'lca-fracture-ammo',
  '가열된 가스 작살': 'heated-gas-harpoon',
  '과열된 가스 작살': 'overheated-gas-harpoon',
  '가열된 가스 작살[21]': 'heated-gas-harpoon',
  '과열된 가스 작살[22]': 'overheated-gas-harpoon',
  '원호 공격': 'assist-attack', '원호 방어': 'assist-defense',
  '시[始]': 'beginning', '대[待]': 'waiting', '원[援]': 'support',
  '천구성도': 'celestial-chart',
  '뜻에 따라, 베겠습니다.': 'by-your-will-i-shall-cut',
  '강렬한 색채': 'IntenseColorsRodion',
  '과감한 터치': 'BoldBrushstrokesRodion',
  '고전압 외피': 'high-voltage-exoskeleton',
  '구속 해제 - 창작 몰입': 'the-self-unbound-flow-state',
  '전하침': 'charged-sting',
  '진동 - 중첩': 'tremor-superposition',
  '집중【저격】': 'concentration-sniper',
  '당연한 믿음': 'natural-faith', '상처': 'wound',
  '깊은 상처': 'deep-wound', '치명적인 상처': 'fatal-wound',
  '손도끼로 갈비뼈를 찍어 내릴 때는…': 'hatchet-ribs',
  '바스타드 소드로 어깨와 머리를 짓이길 때는…': 'bastard-sword-shoulders',
  '레이피어로 몸에 10개 이상의 구멍을 내야할 때는…': 'rapier-ten-holes',
  '망치로 뒤통수를 으깨야 할 때는…': 'hammer-skull',
  '커다란 검으로 몸통을 갈라야 할 때는…': 'greatsword-torso',
  '랜스로 20인치의 구멍을 내야 할 때는…': 'lance-twenty-inch',
  '채찍으로 살점을 만 갈래 떼어내야 할 때는…': 'whip-flesh',
  '낫으로… 누군가처럼 공간을 따라 베어내야 할 때는…': 'scythe-cut-space',
  '피아 식별 불가': 'indiscriminate',
  // 죄악별 보호/취약/위력/피해량 (패턴으로 처리)
  '분노 보호': 'wrath-protection', '분노 위력 증가': 'wrath-power-up',
  '분노 위력 감소': 'wrath-power-down', '분노 취약': 'wrath-fragile',
  '분노 피해량 감소': 'wrath-dmg-down',
  '색욕 보호': 'lust-protection', '색욕 위력 증가': 'lust-power-up',
  '색욕 위력 감소': 'lust-power-down', '색욕 취약': 'lust-fragile',
  '색욕 피해량 증가': 'lust-dmg-up', '색욕 피해량 감소': 'lust-dmg-down',
  '나태 보호': 'sloth-protection', '나태 위력 증가': 'sloth-power-up',
  '나태 위력 감소': 'sloth-power-down', '나태 취약': 'sloth-fragile',
  '나태 피해량 증가': 'sloth-dmg-up', '나태 피해량 감소': 'sloth-dmg-down',
  '오만 보호': 'pride-protection', '오만 위력 감소': 'pride-power-down',
  '오만 취약': 'pride-fragile',
  '오만 피해량 증가': 'pride-dmg-up', '오만 피해량 감소': 'pride-dmg-down',
  '우울 보호': 'gloom-protection', '우울 위력 증가': 'gloom-power-up',
  '우울 위력 감소': 'gloom-power-down', '우울 취약': 'gloom-fragile',
  '우울 피해량 감소': 'gloom-dmg-down',
  '질투 보호': 'envy-protection', '질투 위력 감소': 'envy-power-down',
  '질투 피해량 감소': 'envy-dmg-down',
  '탐식 보호': 'gluttony-protection', '탐식 위력 증가': 'gluttony-power-up',
  '탐식 위력 감소': 'gluttony-power-down', '탐식 취약': 'gluttony-fragile',
  '탐식 피해량 감소': 'gluttony-dmg-down',
  // 신규 키워드
  '깨어진 세계': 'broken-world',
  '가쁜 날숨': 'quick-exhale', '깊은 들숨': 'deep-inhale',
  '경화막': 'hardened-membrane', '구더기': 'maggot',
  '나생[羅生]': 'nasei', '네번째 마탄': 'magic-bullet-4',
  '네뷸라이저 α': 'nebulizer-alpha', '네뷸라이저 β': 'nebulizer-beta',
  '다섯번째 마탄': 'magic-bullet-5', '달궈진 새장': 'heated-cage',
  '두번째 마탄': 'magic-bullet-2', '마법소녀의 영창': 'magical-girl-chant',
  '마지막 개조': 'final-modification',
  '매화첨[埋花櫼]': 'plum-blossom-wedge', '매화침[埋花針]': 'plum-blossom-needle',
  '목마른 장미': 'thirsty-rose', '묶인 왕의 앞으로': 'before-bound-king',
  '바늘': 'needle', '방출 전류': 'discharge-current',
  '분홍 리본': 'pink-ribbon', '불허[不許]': 'denied',
  '상급 시엔징': 'advanced-sienching', '시술': 'treatment',
  '시엔징': 'sienching',
  '신(心) - 천퇴성 [天退星]': 'heart-heavenly-retreat',
  '천퇴성 [天退星]': 'heavenly-retreat', '천퇴성[天退星]': 'heavenly-retreat',
  '얽혀버린 저주 부적': 'tangled-curse-talisman',
  '올가미': 'lasso', '왕의 앞으로': 'before-the-king',
  '울음 방울': 'crying-bell',
  '잃어버린 저주 부적': 'lost-curse-talisman',
  '장미 쐐기': 'rose-wedge', '저주': 'curse',
  '적안 - 경계': 'red-eye-alert', '적안 - 포식': 'red-eye-predation',
  '정신력 회복 효율 감소': 'sp-heal-down', '정신력 회복 효율 증가': 'sp-heal-up',
  '주민등록 마이크로칩': 'id-microchip',
  '지네 독': 'centipede-poison',
  '집중 공격 - 뫼르소': 'focused-attack-meursault',
  '참회 - 경계': 'repentance-alert', '참회 - 고해': 'repentance-confession',
  '첫번째 마탄': 'magic-bullet-1', '초청받지 않은 자': 'uninvited',
  '추모': 'memorial', '축적된 과거': 'accumulated-past',
  '불허[不許]': 'denied', '칼집 속 사람': 'person-in-sheath', '탄환 - 고독': 'ammo-solitude',
  '형제자매의 앙갚음 대상': 'sibling-retaliation-target',
  '호넷[라이플]': 'hornet-rifle', '호넷[샷건]': 'hornet-shotgun',
  '세번째 마탄': 'magic-bullet-3', '여섯번째 마탄': 'magic-bullet-6',
  '일곱번째 마탄': 'magic-bullet-7',
  'E.G.O 자원 획득량 +': 'ego-resource-up', 'E.G.O 자원 획득량+': 'ego-resource-up',
  '스틸레토로 허파를 꿰뚫을 때는…': 'stiletto-lungs',
  '결투 선포 - 돈키호테': 'duel-declaration-don-quixote',
  '결투 선포 - 싱클레어': 'duel-declaration-sinclair',
  '결투 선포 - 오티스': 'duel-declaration-outis',
}

function makeSlug(koreanName) {
  // 알려진 slug가 있으면 사용
  if (KNOWN_SLUGS[koreanName]) return KNOWN_SLUGS[koreanName]

  // 자동 slug 생성 (한글 → romanized approximation은 어려우므로 단순 해시)
  const cleaned = koreanName
    .replace(/[【】\[\]]/g, '-')
    .replace(/[^가-힣a-zA-Z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase()
  return `kw-${cleaned || 'unknown-' + Date.now()}`
}

function fetchBuffer(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http
    client.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        return fetchBuffer(res.headers.location).then(resolve, reject)
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`HTTP ${res.statusCode} for ${url}`))
      }
      const chunks = []
      res.on('data', c => chunks.push(c))
      res.on('end', () => resolve(Buffer.concat(chunks)))
      res.on('error', reject)
    }).on('error', reject)
  })
}

async function supaGet(table, params = '') {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${params}`, { headers })
  return res.json()
}

async function supaUpsert(table, data) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: {
      ...headers,
      Prefer: 'resolution=merge-duplicates,return=minimal',
    },
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Upsert ${table} failed: ${res.status} ${text}`)
  }
}

async function uploadToStorage(path, buffer) {
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/limbus-assets/${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'image/webp',
      'x-upsert': 'true',
    },
    body: buffer,
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Storage upload failed: ${res.status} ${text}`)
  }
}

async function scrapeKeywordsFromPage(page, url, sinnerId) {
  console.log(`\n[${sinnerId}] ${url}`)
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 })
  await page.waitForTimeout(2000)

  // Expand all details
  await page.evaluate(() => {
    document.querySelectorAll('details').forEach(d => { d.open = true })
  })
  await page.waitForTimeout(1000)

  // Extract keywords with images
  const keywords = await page.evaluate(() => {
    const results = []
    const seen = new Set()

    // Find "전용 키워드" header cells
    const allCells = document.querySelectorAll('th, td')
    for (const cell of allCells) {
      const text = cell.textContent.trim()
      if (!text.includes('전용 키워드')) continue

      // Find the containing table/tbody
      const table = cell.closest('table')
      if (!table) continue

      const rows = table.querySelectorAll('tr')
      for (const row of rows) {
        const tds = row.querySelectorAll('td')
        if (tds.length < 2) continue

        const firstTd = tds[0]
        // Get text without noscript/img content
        const nameClone = firstTd.cloneNode(true)
        nameClone.querySelectorAll('noscript, style, script').forEach(e => e.remove())

        // Find real image URL from img src attribute in innerHTML
        const imgs = firstTd.querySelectorAll('img')
        let imgUrl = null
        for (const img of imgs) {
          // Try getting src from the HTML attribute directly
          const src = img.getAttribute('src') || ''
          if (src.includes('i.namu.wiki') || src.includes('namu.la')) {
            imgUrl = src.startsWith('//') ? 'https:' + src : src
            break
          }
        }

        // If still no URL, try parsing from noscript
        if (!imgUrl) {
          const noscript = firstTd.querySelector('noscript')
          if (noscript) {
            const match = noscript.innerHTML.match(/src="([^"]*(?:namu\.wiki|namu\.la)[^"]*)"/)
            if (match) {
              imgUrl = match[1].startsWith('//') ? 'https:' + match[1] : match[1]
            }
          }
        }

        // If still no URL, parse from outerHTML of img
        if (!imgUrl) {
          const imgHtml = firstTd.innerHTML
          const srcMatch = imgHtml.match(/src='([^']*i\.namu\.wiki[^']*)'/)
            || imgHtml.match(/src="([^"]*i\.namu\.wiki[^"]*)"/)
          if (srcMatch) {
            imgUrl = srcMatch[1].startsWith('//') ? 'https:' + srcMatch[1] : srcMatch[1]
          }
        }

        // Clean name: remove all img tags' text and get pure text
        // Remove img elements from clone to get pure text
        nameClone.querySelectorAll('img').forEach(e => e.remove())
        let nameText = nameClone.textContent.trim().replace(/\s+/g, ' ')
        if (!nameText || nameText === '전용 키워드') continue

        // Skip overly long names (likely nested table content captured by mistake)
        if (nameText.length > 100) continue

        // Clean up common artifacts
        nameText = nameText.replace(/^\[ 펼치기 · 접기 \]/, '').trim()

        if (!nameText) continue

        // Skip concatenated keyword names (e.g. "적안적안 - 경계적안 - 포식")
        // These happen when multiple sub-keywords are in one cell without proper row separation
        if (nameText.length > 60) continue

        // Skip duplicates
        if (seen.has(nameText)) continue
        seen.add(nameText)

        results.push({ name: nameText, imgUrl })
      }
    }
    return results
  })

  console.log(`  Found ${keywords.length} keywords`)
  return keywords
}

async function main() {
  // 1. Get existing keyword_meta with icon_slug
  const existing = await supaGet('keyword_meta', 'select=name,icon_slug')
  const existingMap = new Map(existing.map(k => [k.name, k.icon_slug]))
  const missingIcon = [...existingMap.entries()]
    .filter(([name, slug]) => !slug && !STAT_ICON_KEYWORDS.has(name))
    .map(([name]) => name)
  console.log(`DB keywords: ${existing.length}, missing icons: ${missingIcon.length}`)

  // 2. Scrape all sinner pages
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  })
  const page = await context.newPage()

  const allKeywords = new Map() // name → imgUrl

  const sinners = sinnerFilter
    ? [sinnerFilter]
    : Object.keys(WIKI_URLS)

  for (const sinnerId of sinners) {
    const url = WIKI_URLS[sinnerId]
    if (!url) { console.warn(`  ${sinnerId}: URL 없음`); continue }

    try {
      const keywords = await scrapeKeywordsFromPage(page, url, sinnerId)
      for (const kw of keywords) {
        if (kw.imgUrl && !allKeywords.has(kw.name)) {
          allKeywords.set(kw.name, kw.imgUrl)
        }
      }
    } catch (e) {
      console.error(`  ${sinnerId} error:`, e.message)
    }

    // Rate limit: 2초 대기
    if (sinners.indexOf(sinnerId) < sinners.length - 1) {
      await page.waitForTimeout(2000)
    }
  }

  await browser.close()

  console.log(`\n=== Total unique keywords with images: ${allKeywords.size} ===`)

  // 3. Filter to only keywords that need icons
  const toProcess = []
  for (const [name, imgUrl] of allKeywords) {
    const currentSlug = existingMap.get(name)
    if (STAT_ICON_KEYWORDS.has(name)) continue
    if (!currentSlug) {
      // This keyword needs an icon (either new or missing)
      toProcess.push({ name, imgUrl, slug: makeSlug(name) })
    }
  }

  console.log(`\nKeywords to process (missing icon): ${toProcess.length}`)

  if (DRY_RUN) {
    console.log('\n[DRY RUN] Would process:')
    for (const kw of toProcess) {
      console.log(`  ${kw.name} → ${kw.slug} (${kw.imgUrl?.substring(0, 60)}...)`)
    }

    // Also show keywords missing icon but NOT found on wiki
    const notOnWiki = missingIcon.filter(name => !allKeywords.has(name))
    if (notOnWiki.length > 0) {
      console.log(`\nKeywords missing icon AND not found on wiki (${notOnWiki.length}):`)
      for (const name of notOnWiki) {
        console.log(`  - ${name}`)
      }
    }
    return
  }

  // 4. Download, upload, and update DB
  let uploaded = 0, failed = 0

  for (let i = 0; i < toProcess.length; i += 5) {
    const batch = toProcess.slice(i, i + 5)
    const results = await Promise.allSettled(
      batch.map(async ({ name, imgUrl, slug }) => {
        try {
          // Download from Namuwiki
          const buf = await fetchBuffer(imgUrl)
          if (buf.length < 100) throw new Error('Too small, likely not an image')

          // Upload to Supabase Storage
          const destPath = `icons/keywords/${slug}.webp`
          await uploadToStorage(destPath, buf)

          // Update keyword_meta.icon_slug
          await supaUpsert('keyword_meta', { name, icon_slug: slug })

          uploaded++
          return `✓ ${name} → ${slug}`
        } catch (e) {
          failed++
          return `✗ ${name}: ${e.message}`
        }
      })
    )
    results.forEach(r => console.log(r.status === 'fulfilled' ? r.value : `✗ ${r.reason}`))
  }

  // 5. Handle variant keywords (reuse existing icon_slug)
  console.log('\n=== Fixing variant keyword icon_slugs ===')
  const VARIANT_MAP = {
    '각력【묘】': '각력 [묘]', '각력【오】': '각력 [오]',
    '주살【독】': '주살 [독]', '주살【신속】': '주살 [신속]', '주살【파】': '주살 [파]',
    '광【光】': '광 [光]', '사랑/증오': '사랑 증오',
    '역변-리버스드': '역변 - 리버스드', '일렁임 [혈귀]': '일렁임[혈귀]',
    '해금 -Ⅰ': '해금-Ⅰ', '해금 -Ⅱ': '해금-Ⅱ', '해금 - Ⅲ': '해금-Ⅲ',
    '사중구활[死中求活]': '사중구활', '흑수환염[黑獸丸染]': '흑수환염',
    '신(心) - 대행': '신(心)-대행',
    '가열된 가스 작살[21]': '가열된 가스 작살',
    '과열된 가스 작살[22]': '과열된 가스 작살',
    '지령[쪽지] I': '지령[쪽지] Ⅰ', '지령[쪽지] II': '지령[쪽지] Ⅱ',
    '지령[쪽지] III': '지령[쪽지] Ⅲ', '지령[쪽지] IV': '지령[쪽지] Ⅳ',
  }

  let variantFixed = 0
  for (const [variant, canonical] of Object.entries(VARIANT_MAP)) {
    const variantSlug = existingMap.get(variant)
    const canonSlug = existingMap.get(canonical)
    if (!variantSlug && canonSlug) {
      try {
        await supaUpsert('keyword_meta', { name: variant, icon_slug: canonSlug })
        console.log(`  ✓ ${variant} → ${canonSlug} (from ${canonical})`)
        variantFixed++
      } catch (e) {
        console.log(`  ✗ ${variant}: ${e.message}`)
      }
    }
  }

  console.log(`\nDone: ${uploaded} uploaded, ${variantFixed} variants fixed, ${failed} failed`)
}

main().catch(e => { console.error(e); process.exit(1) })

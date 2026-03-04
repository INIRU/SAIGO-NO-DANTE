import { createClient } from '@supabase/supabase-js'

// ── 타입 정의 ──────────────────────────────────────────────────────────────
export type Sinner = {
  id: string
  name: string
  name_kr: string
  order_num: number
  description: string
  literary_source: string
}

export type Identity = {
  id: string
  sinner_id: string
  name: string
  name_kr: string
  tier: number
  hp: number
  speed_min: number
  speed_max: number
  def_level: number
  keywords: string[]
  rarity: string
  affiliation?: string
  quote?: string
  slash_res?: string
  pierce_res?: string
  blunt_res?: string
  release_date?: string
  acquisition?: string
  game_id?: string | null
  folder_name?: string | null
  panic_type?: string
  panic_description?: string
  sanity_increase?: string
  sanity_decrease?: string
  acquisition_info?: {
    type: 'default' | 'standard' | 'event' | 'walpurgis' | 'attendance'
    release_season: number
    fragment_cost: number | null
    gacha: 'always' | 'seasonal' | 'walpurgis' | 'none'
    gacha_from_season?: number
    target_sinner?: string
    exchange_from_season?: number
    walpurgis_edition?: number
    event_name?: string
    event_currency?: string
    event_cost?: number
  } | null
}

export type Skill = {
  id: string
  identity_id: string
  name: string
  skill_type: string
  sin_affinity: SinType
  coins: number
  base_power: number
  coin_power: number
  description: string
  skill_order: number
  atk_weight?: number
  offense_level?: number
  quantity?: number
  uptie_level?: number
  variant_order?: number
}

export type Passive = {
  id: string
  identity_id: string
  passive_type: string   // 'battle' | 'support'
  name: string
  sin_affinity: string | null
  sin_count: number | null
  active_cond: string | null
  description: string
  passive_order: number
  uptie_level?: number
}

export type EGOSkill = {
  name: string
  power: string
  mentalConsume: number
  atkType: string
  resource: string
  skillPower: number
  coinPower: number
  coinNum: number
  atkWeight: number
  construeLevel: number
  normalEffect: string
  coin1Effect: string
  coin2Effect: string
  coin3Effect: string
  coin4Effect: string
  coin5Effect: string
}

export type EGO = {
  id: string
  sinner_id: string
  name: string
  name_kr: string | null
  grade: string
  sin_affinity: SinType | null
  description: string | null
  corrosion_risk: string | null
  folder_name: string | null
  image_url: string | null
  passive_name: string | null
  passive_content: string | null
  ego_skills: EGOSkill[] | null
  ego_cor_skills: EGOSkill[] | null
  resistance: string[] | null
  cost: number[] | null
  keywords: string[] | null
  obtaining_method: string | null
  cor_image_url: string | null
  game_id: string | null
}

export type SinType = 'wrath' | 'lust' | 'sloth' | 'gluttony' | 'gloom' | 'pride' | 'envy'

// ── Supabase Storage 이미지 URL ────────────────────────────────────────────
export const STORAGE_BASE = 'https://lpgqcleszdlldneiwgep.supabase.co/storage/v1/object/public/limbus-assets'

// ── 상수 ───────────────────────────────────────────────────────────────────
export const SIN_COLORS: Record<SinType, string> = {
  wrath:    '#c83030',
  lust:     '#d06030',
  sloth:    '#d4b830',
  gluttony: '#88b028',
  gloom:    '#4898b0',
  pride:    '#3870b0',
  envy:     '#8058a8',
}

export const SIN_LABELS_KR: Record<SinType, string> = {
  wrath:    '분노',
  lust:     '색욕',
  sloth:    '나태',
  gluttony: '탐식',
  gloom:    '우울',
  pride:    '오만',
  envy:     '질투',
}

// ── EGO 등급 색상 ───────────────────────────────────────────────────────────
export const GRADE_COLORS: Record<string, string> = {
  ZAYIN: '#667788', TETH: '#4898b0', HE: '#88a830', WAW: '#c8900a', ALEPH: '#c83040',
}

// ── 등급 아이콘/프레임/색상 ─────────────────────────────────────────────────
export const RARITY_ICON_MAP: Record<string, string> = {
  '1성': `${STORAGE_BASE}/icons/Rarity/1star.webp`,
  '2성': `${STORAGE_BASE}/icons/Rarity/2star.webp`,
  '3성': `${STORAGE_BASE}/icons/Rarity/3star.webp`,
}

export const RARITY_FRAME_MAP: Record<string, string> = {
  '1성': `${STORAGE_BASE}/icons/Rarity/0_frame.webp`,
  '2성': `${STORAGE_BASE}/icons/Rarity/00_frame.webp`,
  '3성': `${STORAGE_BASE}/icons/Rarity/000_frame.webp`,
}

export const RARITY_COLORS: Record<string, { border: string; glow: string }> = {
  '1성': { border: '#556677', glow: 'rgba(85,102,119,0.3)' },
  '2성': { border: '#5588bb', glow: 'rgba(85,136,187,0.3)' },
  '3성': { border: '#c8900a', glow: 'rgba(200,144,10,0.4)' },
}

// ── 한국어 ↔ 영문 죄악 매핑 ─────────────────────────────────────────────────
export const SIN_KR_TO_EN: Record<string, SinType> = {
  '분노': 'wrath', '색욕': 'lust', '나태': 'sloth', '탐식': 'gluttony',
  '폭식': 'gluttony', '우울': 'gloom', '오만': 'pride', '질투': 'envy',
}

// ── 죄악 아이콘 URL ─────────────────────────────────────────────────────────
export const SIN_ICON_MAP: Record<SinType, string> = {
  wrath:    `${STORAGE_BASE}/icons/Sins/transparent/Wrath.webp`,
  lust:     `${STORAGE_BASE}/icons/Sins/transparent/Lust.webp`,
  sloth:    `${STORAGE_BASE}/icons/Sins/transparent/Sloth.webp`,
  gluttony: `${STORAGE_BASE}/icons/Sins/transparent/Gluttony.webp`,
  gloom:    `${STORAGE_BASE}/icons/Sins/transparent/Gloom.webp`,
  pride:    `${STORAGE_BASE}/icons/Sins/transparent/Pride.webp`,
  envy:     `${STORAGE_BASE}/icons/Sins/transparent/Envy.webp`,
}

export function getSinIconUrl(sin: SinType): string {
  return SIN_ICON_MAP[sin]
}

// ── 공격 타입 아이콘/라벨 ───────────────────────────────────────────────────
export const ATK_TYPE_ICON_MAP: Record<string, string> = {
  slash:  `${STORAGE_BASE}/icons/stats/slash.webp`,
  pierce: `${STORAGE_BASE}/icons/stats/pierce.webp`,
  blunt:  `${STORAGE_BASE}/icons/stats/blunt.webp`,
  '참격': `${STORAGE_BASE}/icons/stats/slash.webp`,
  '관통': `${STORAGE_BASE}/icons/stats/pierce.webp`,
  '타격': `${STORAGE_BASE}/icons/stats/blunt.webp`,
}

export const SKILL_TYPE_LABELS: Record<string, string> = {
  slash: '참격', pierce: '관통', blunt: '타격',
  defense: '방어', counter: '반격', evade: '회피',
}

// ── 죄악 속성 정규화 (한글이든 영문이든 → SinType) ──────────────────────────
export function normalizeSin(sin: string | null): SinType | null {
  if (!sin) return null
  if (sin in SIN_COLORS) return sin as SinType
  return SIN_KR_TO_EN[sin] ?? null
}

// ── 키워드 → 죄악 속성 매핑 (메인 키워드 기반 카드 색상) ─────────────────────
export const KEYWORD_SIN_MAP: Record<string, SinType> = {
  // 상태이상 키워드 → 대응 죄악
  '출혈': 'wrath',
  '화상': 'lust',
  '침잠': 'gloom',
  '파열': 'gluttony',
  '호흡': 'pride',
  '충전': 'envy',
  '진동': 'sloth',
  // 파생 키워드도 같은 죄악
  '진동 폭발': 'sloth',
  '진동 - 과다출혈': 'sloth',
  '진동 - 반향': 'sloth',
  '진동 - 붕괴': 'sloth',
  '진동 - 사슬': 'sloth',
  '진동 - 작열': 'sloth',
  '진폭 변환': 'sloth',
  '진폭 얽힘': 'sloth',
  '과충전': 'envy',
}

/**
 * 인격의 키워드 목록에서 메인 죄악 속성을 추론.
 * KEYWORD_SIN_MAP에 매칭되는 첫 번째 키워드의 죄악을 반환.
 * 매칭 없으면 null.
 */
export function getIdentityMainSin(keywords?: string[] | null): SinType | null {
  if (!keywords || keywords.length === 0) return null
  for (const kw of keywords) {
    const sin = KEYWORD_SIN_MAP[kw]
    if (sin) return sin
  }
  return null
}

/**
 * 인격의 표시용 죄악 색상을 결정 (키워드 기반).
 */
export function getIdentitySinColor(identity: Identity): string {
  const sin = getIdentityMainSin(identity.keywords)
  return sin ? SIN_COLORS[sin] : '#888888'
}

/**
 * 인격의 표시용 SinType을 결정 (키워드 기반).
 */
export function getIdentitySinType(identity: Identity): SinType | null {
  return getIdentityMainSin(identity.keywords)
}

// ── 키워드 아이콘 매핑 (한국어 → 영어 슬러그) ──────────────────────────────
export const KEYWORD_ICON_MAP: Record<string, string> = {
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
  '해금': 'unlock', '카르마': 'karma', '광신': 'fanaticism', '못': 'nail',
  '탄환': 'ammo', '방어 태세': 'defense-stance', '합 가능 가드': 'clash-guard',
  '체력 회복 감소': 'hp-heal-down',
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
  '과열된 가스 작살': 'overheated-gas-harpoon', '원호 공격': 'support-attack',
  '원호 방어': 'support-defense', '시[始]': 'beginning', '대[待]': 'waiting',
  '원[援]': 'support', '천구성도': 'celestial-chart',
  '뜻에 따라, 베겠습니다.': 'by-your-will-i-shall-cut',
  '손도끼로 갈비뼈를 찍어 내릴 때는…': 'hatchet-ribs',
  '바스타드 소드로 어깨와 머리를 짓이길 때는…': 'bastard-sword-shoulders',
  '레이피어로 몸에 10개 이상의 구멍을 내야할 때는…': 'rapier-ten-holes',
  '망치로 뒤통수를 으깨야 할 때는…': 'hammer-skull',
  '커다란 검으로 몸통을 갈라야 할 때는…': 'greatsword-torso',
  '랜스로 20인치의 구멍을 내야 할 때는…': 'lance-twenty-inch',
  '채찍으로 살점을 만 갈래 떼어내야 할 때는…': 'whip-flesh',
  '낫으로… 누군가처럼 공간을 따라 베어내야 할 때는…': 'scythe-cut-space',
  '당연한 믿음': 'natural-faith',
}

export function getKeywordIconUrl(keyword: string): string | null {
  const slug = KEYWORD_ICON_MAP[keyword]
  if (!slug) return null
  return `${STORAGE_BASE}/icons/keywords/${slug}.webp`
}

const LCB_IDS: Record<string, string> = {
  'yi-sang':     '10101',
  'faust':       '10201',
  'don-quixote': '10301',
  'ryoshu':      '10401',
  'meursault':   '10501',
  'hong-lu':     '10601',
  'heathcliff':  '10701',
  'ishmael':     '10801',
  'rodion':      '10901',
  'sinclair':    '11001',
  'outis':       '11101',
  'gregor':      '11201',
}

export function getSinnerLogoUrl(sinnerId: string): string {
  return `${STORAGE_BASE}/icons/Sinners/${sinnerId}.webp`
}

export function getSinnerProfileUrl(sinnerId: string): string {
  const id = LCB_IDS[sinnerId]
  if (!id) return ''
  return `${STORAGE_BASE}/sinners/${sinnerId}/identities/LCB%20Sinner/${id}_normal.webp`
}

export function getIdentityImageUrl(sinnerId: string, identityFolderName: string, filename: string): string {
  const folder = encodeURIComponent(identityFolderName)
  return `${STORAGE_BASE}/sinners/${sinnerId}/identities/${folder}/${filename}.webp`
}

// ── Identity 기반 이미지 URL 함수 (DB의 game_id, folder_name 사용) ──────────

export function getIdentityProfileUrl(identity: Identity, gacksung = false): string {
  if (!identity.game_id || !identity.folder_name) return ''
  const prefix = gacksung ? 'gacksung' : 'normal'
  const file = `${identity.game_id}_${prefix}`
  return getIdentityImageUrl(identity.sinner_id, identity.folder_name, file)
}

export function getIdentityInfoUrl(identity: Identity, gacksung = false): string {
  if (!identity.game_id || !identity.folder_name) return ''
  const prefix = gacksung ? 'gacksung' : 'normal'
  const file = `${identity.game_id}_${prefix}_info`
  return getIdentityImageUrl(identity.sinner_id, identity.folder_name, file)
}

export function getSkillIconUrl(identity: Identity, imageIndex: number): string {
  if (!identity.game_id) return ''
  return `${STORAGE_BASE}/icons/skills/${identity.game_id}${String(imageIndex).padStart(2, '0')}.webp`
}

/** 스킬 목록(skill_order, id 순 정렬)에서 이미지 인덱스 계산.
 *  S1→01, S2→02, S3→03, 수비→04, 변형→05, 06 ...
 *  skill_order >= 5 는 S3 변형(구 데이터), 같은 skill_order 중복은 변형 스킬 */
export function computeSkillImageIndices(skills: { id: string; skill_order: number }[]): Record<string, number> {
  const seenOrder = new Set<number>()
  const result: Record<string, number> = {}
  const variants: { id: string }[] = []
  for (const s of skills) {
    const base = s.skill_order >= 5 ? 3 : s.skill_order
    if (!seenOrder.has(base)) {
      seenOrder.add(base)
      result[s.id] = base
    } else {
      variants.push(s)
    }
  }
  variants.forEach((s, i) => { result[s.id] = 5 + i })
  return result
}

export function getEGOImageUrl(sinnerId: string, egoFolderName: string): string {
  const folder = encodeURIComponent(egoFolderName)
  return `${STORAGE_BASE}/sinners/${sinnerId}/ego/${folder}/`
}

// ── Supabase 클라이언트 (browser/server 공용 anon key) ─────────────────────
function supabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

// ── DB 조회 함수 ───────────────────────────────────────────────────────────
export async function getSinners(): Promise<Sinner[]> {
  const { data, error } = await supabase()
    .schema('limbus')
    .from('sinners')
    .select('*')
    .order('order_num')
  if (error) throw error
  return data ?? []
}

export async function getSinnerById(id: string): Promise<Sinner | null> {
  const { data, error } = await supabase()
    .schema('limbus')
    .from('sinners')
    .select('*')
    .eq('id', id)
    .single()
  if (error) return null
  return data
}

export async function getIdentities(sinnerId?: string): Promise<Identity[]> {
  let q = supabase().schema('limbus').from('identities').select('*')
  if (sinnerId) q = q.eq('sinner_id', sinnerId)
  const { data, error } = await q.order('rarity').order('name')
  if (error) throw error
  return data ?? []
}

export type IdentityWithSinner = Identity & { sinner: Sinner }

export async function getLatestIdentities(limit = 6): Promise<IdentityWithSinner[]> {
  const { data, error } = await supabase()
    .schema('limbus')
    .from('identities')
    .select('*, sinner:sinners(*)')
    .not('release_date', 'is', null)
    .order('release_date', { ascending: false })
    .limit(limit)
  if (error) throw error
  return (data ?? []) as IdentityWithSinner[]
}

export async function getIdentityById(id: string): Promise<Identity | null> {
  const { data, error } = await supabase()
    .schema('limbus')
    .from('identities')
    .select('*')
    .eq('id', id)
    .single()
  if (error) return null
  return data
}

export async function getAllSkills(): Promise<Skill[]> {
  const { data, error } = await supabase()
    .schema('limbus')
    .from('skills')
    .select('*')
    .order('skill_order')
    .order('variant_order')
    .order('id')
    .limit(3000)
  if (error) return []
  return data ?? []
}

export async function getSkills(identityId: string): Promise<Skill[]> {
  const { data, error } = await supabase()
    .schema('limbus')
    .from('skills')
    .select('*')
    .eq('identity_id', identityId)
    .order('skill_order')
    .order('uptie_level')
    .order('variant_order')
    .order('id')
  if (error) return []
  return data ?? []
}

export async function getAllPassives(): Promise<Passive[]> {
  const { data, error } = await supabase()
    .schema('limbus')
    .from('passives')
    .select('*')
    .order('passive_order')
    .limit(2000)
  if (error) return []
  return data ?? []
}

export async function getPassives(identityId: string): Promise<Passive[]> {
  const { data, error } = await supabase()
    .schema('limbus')
    .from('passives')
    .select('*')
    .eq('identity_id', identityId)
    .order('passive_order')
    .order('uptie_level')
  if (error) return []
  return data ?? []
}

export async function getEGOs(sinnerId?: string): Promise<EGO[]> {
  let q = supabase().schema('limbus').from('ego').select('*')
  if (sinnerId) q = q.eq('sinner_id', sinnerId)
  const { data, error } = await q.order('grade').order('name')
  if (error) throw error
  return data ?? []
}

export async function getEGOById(id: string): Promise<EGO | null> {
  const { data, error } = await supabase().schema('limbus').from('ego').select('*').eq('id', id).maybeSingle()
  if (error) throw error
  return data
}

export type ActivationCondition = {
  type: 'keyword' | 'multi_keyword' | 'affiliation' | 'skill'
  keyword?: string
  keywords?: string[]
  affiliation?: string
  affiliations?: string[]
  skill_condition?: string
  count: number
}

export type EgoGiftNote = {
  name: string
  keyword: string
  grade: string
  image_url: string | null
  effect_base: string | null
  activation_condition: ActivationCondition | null
}

export async function getEgoGiftsForNotes(): Promise<EgoGiftNote[]> {
  const { data, error } = await supabase()
    .schema('limbus')
    .from('ego_gifts')
    .select('name, keyword, grade, image_url, effect_base, activation_condition')
  if (error) throw error
  return data ?? []
}

// 12인 수감자 ID 목록 (generateStaticParams용 — DB 불필요)
export const SINNER_SLUGS = [
  'yi-sang', 'faust', 'don-quixote', 'ryoshu', 'meursault',
  'hong-lu', 'heathcliff', 'ishmael', 'rodion', 'sinclair', 'outis', 'gregor',
]

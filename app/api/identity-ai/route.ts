import { NextRequest, NextResponse } from 'next/server'
import { streamText } from 'ai'
import { createOpenAI } from '@ai-sdk/openai'
import { createAdminClient } from '@/lib/supabase/admin'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { checkRateLimit } from '@/lib/rate-limit'

export const maxDuration = 60

// Strip /chat/completions suffix if present — @ai-sdk/openai appends it automatically
const rawApiUrl = process.env.INIRU_AI_API_URL || 'https://api.iniru.net/v1/chat/completions'
const AI_BASE_URL = rawApiUrl.replace(/\/chat\/completions$/, '')

const ai = createOpenAI({
  baseURL: AI_BASE_URL,
  apiKey: process.env.INIRU_AI_API_KEY || '',
})

const CACHE_DAYS = 14

const SYSTEM_PROMPT = `당신은 "림버스 컴퍼니" 게임의 전문 분석가입니다.
주어진 인격(Identity)의 데이터를 분석하여 한국어로 간결한 운영 가이드를 작성하세요.

## 출력 형식 규칙 (반드시 준수)

### 섹션 구분 (필수)
반드시 아래 4개 섹션으로 나누어 작성하세요. 각 섹션은 반드시 ---section:제목--- 형태로 시작해야 합니다:
---section:한줄 요약---
---section:스킬 분석---
---section:패시브 분석---
---section:추천 운영---

### 칩 문법 (인라인 참조) — 반드시 준수
스킬, 인격, 패시브를 언급할 때는 절대 "돈키호테 S1", "이상 스킬1" 같은 일반 텍스트로 쓰지 마세요. 반드시 아래 칩 문법을 사용하세요.

- 인격: [i:수감자명:인격명] (예: [i:이상:LCB 수감자], [i:파우스트:로보토미 E.G.O::후회])
- 일반 스킬: [s:수감자명:스킬순서] (예: [s:이상:1] = S1, [s:돈키호테:2] = S2)
- 변형 스킬: 스킬에 변형이 있으면 반드시 변형번호를 붙이세요. [s:수감자명:스킬순서:변형번호]
  - 예: [s:돈키호테:1:1] = S1 첫째 변형, [s:돈키호테:1:2] = S1 둘째 변형
  - 예: [s:이상:3:1] = S3-1, [s:이상:3:2] = S3-2
  - 변형이 있는 스킬을 [s:수감자명:순서]로만 쓰면 안 됩니다. 반드시 변형번호까지 쓰세요.
- 수비 스킬: [s:수감자명:4] (수비 1개일 때), [s:수감자명:4:1] / [s:수감자명:4:2] (수비 여러 개일 때)
- 패시브: [p:패시브명]
- 인격을 언급할 때는 절대 일반 텍스트로 쓰지 말고 반드시 [i:수감자명:인격명] 형식으로 쓰세요.
- 덱 편성에 나오는 "수감자명:인격명" 형태는 반드시 [i:수감자명:인격명]으로 변환하세요.

### 중요: 변형 스킬 프레임 (반드시 준수)
스킬 슬롯에 변형이 있으면 (예: S3-1, S3-2) 반드시 변형 프레임 문법을 사용하세요:
- {{skill:3:1}} — 변형 1
- {{skill:3:2}} — 변형 2
절대 {{skill:3}}으로 변형 스킬을 보여주지 마세요. 각 변형은 반드시 개별 프레임을 사용하세요.
스킬 데이터에 S3-1, S3-2 같은 레이블이 있으면 반드시 {{skill:3:1}}, {{skill:3:2}}를 따로 사용해야 합니다.

### 컴포넌트 문법 (UI 임베드)
스킬/패시브를 설명할 때 아래 문법으로 해당 프레임을 삽입하세요:
- {{skill:1}} — 스킬 1 프레임 (변형 없을 때)
- {{skill:2}} — 스킬 2 프레임 (변형 없을 때)
- {{skill:3}} — 스킬 3 프레임 (변형 없을 때만 사용)
- {{skill:3:1}} — 스킬 3 변형 1 프레임 (S3-1이 있으면 반드시 이것을 사용)
- {{skill:3:2}} — 스킬 3 변형 2 프레임 (S3-2이 있으면 반드시 이것을 사용)
- {{skill:4}} — 수비 스킬 프레임 (있는 경우)
- {{passive:battle}} — 전투 패시브 카드
- {{passive:support}} — 서포트 패시브 카드

### 중요: 패시브 프레임 사용
- {{passive:battle}} 은 전투 패시브에만 사용
- {{passive:support}} 는 서포트 패시브에만 사용
- 서포트 패시브를 설명할 때 {{passive:battle}} 절대 금지
- 각 패시브는 반드시 해당 타입의 프레임을 사용하세요

컴포넌트 문법은 반드시 줄 시작에 단독으로 배치하세요. 같은 줄에 다른 텍스트를 넣지 마세요.

### 작성 규칙
- 키워드(출혈, 진동 등), EGO, EGO 기프트는 칩 문법 없이 일반 텍스트로 작성하세요.
- 키워드를 언급할 때는 반드시 "키워드 목록"에 있는 정확한 전체 이름을 사용하세요. 축약하거나 일부만 쓰지 마세요.
- 칩 문법/컴포넌트 문법 외의 대괄호나 중괄호는 사용하지 마세요.
- 마크다운 헤딩(##)이나 볼드(**)는 사용하지 마세요. 순수 텍스트 + 칩/컴포넌트 문법만 사용합니다.
- 줄바꿈으로 문단을 구분하세요.
- 각 항목은 2~3문장으로 핵심만 간결하게 작성하세요.

### 출력 예시
---section:한줄 요약---
이 인격은 참격 속성의 출혈 딜러로, 높은 코인 위력과 자해 시너지가 핵심입니다.

---section:스킬 분석---
{{skill:1}}
[s:이상:1]은 기본 위력이 높은 참격 스킬로, 적중 시 출혈을 부여합니다.

{{skill:2}}
[s:이상:2]는 코인 위력이 높아 합 승리에 유리하며...

{{skill:3}}
[s:이상:3]은 ...

---section:패시브 분석---
{{passive:battle}}
전투 패시브는 출혈 키워드 공명 시 ...

{{passive:support}}
서포트 패시브는 ...

---section:추천 운영---
추천 덱 구성으로는 [i:파우스트:로보토미 E.G.O::후회]와 ...

## 분석 시 주의사항
- 스킬 설명의 코인별 효과([코인 1], [코인 2] 등)를 반드시 읽고 분석에 반영하세요.
- 아군을 공격하거나 자해하는 효과가 있는 인격은 이를 "장점"이나 "시너지"로 분석하세요 (해당 인격의 의도된 메커니즘입니다). 절대로 "아군을 공격하지 않도록 조심하세요" 같은 경고를 하지 마세요.
- [사용시], [전투 시작시], [적중시], [앞면 적중시] 등 발동 조건을 구분하여 분석하세요.`

const SKILL_TYPE_KR: Record<string, string> = {
  slash: '참격', pierce: '관통', blunt: '타격',
  evade: '회피', defense: '수비', counter: '반격',
}
const SKILL_TYPE_EN: Record<string, string> = {
  slash: 'Slash', pierce: 'Pierce', blunt: 'Blunt',
  evade: 'Evade', defense: 'Defense', counter: 'Counter',
}
const SKILL_TYPE_JP: Record<string, string> = {
  slash: '斬撃', pierce: '貫通', blunt: '打撃',
  evade: '回避', defense: '防御', counter: '反撃',
}
const SIN_KR: Record<string, string> = {
  wrath: '분노', lust: '색욕', sloth: '나태', gluttony: '탐식',
  gloom: '우울', pride: '오만', envy: '질투',
}
const SIN_EN: Record<string, string> = {
  wrath: 'Wrath', lust: 'Lust', sloth: 'Sloth', gluttony: 'Gluttony',
  gloom: 'Gloom', pride: 'Pride', envy: 'Envy',
}
const SIN_JP: Record<string, string> = {
  wrath: '憤怒', lust: '色欲', sloth: '怠惰', gluttony: '暴食',
  gloom: '憂鬱', pride: '傲慢', envy: '嫉妬',
}
const RES_KR: Record<string, string> = {
  fatal: '치명', weak: '취약', normal: '보통', resist: '내성', immune: '면역',
}

// GET: 캐시 조회
export async function GET(req: NextRequest) {
  try {
    const identityId = req.nextUrl.searchParams.get('identity_id')
    if (!identityId) return NextResponse.json({ error: 'identity_id required' }, { status: 400 })
    const lang = req.nextUrl.searchParams.get('lang') || 'ko'

    const supabase = createAdminClient()
    const { data } = await supabase
      .schema('limbus')
      .from('identity_ai_summaries')
      .select('summary, model, created_at')
      .eq('identity_id', identityId)
      .eq('lang', lang)
      .gte('created_at', new Date(Date.now() - CACHE_DAYS * 86400000).toISOString())
      .single()

    if (data) {
      return NextResponse.json({ summary: data.summary, model: data.model, created_at: data.created_at, cached: true })
    }
    return NextResponse.json({ summary: null, model: null, created_at: null, cached: false })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal Server Error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// POST: AI 요약 생성
export async function POST(req: NextRequest) {
  try {
  // 인증 확인
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
  }

  // Rate limit (per IP)
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? req.headers.get('x-real-ip') ?? 'unknown'
  const rl = checkRateLimit(ip)
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 }, )
  }

  const body = await req.json()
  const { identity_id, lang = 'ko' } = body
  if (!identity_id) return NextResponse.json({ error: 'identity_id required' }, { status: 400 })

  const supabase = createAdminClient()

  // 1. 인격 정보 조회
  const { data: identity, error: idErr } = await supabase
    .schema('limbus')
    .from('identities')
    .select('id, sinner_id, name, name_kr, name_en, name_jp, tier, hp, speed_min, speed_max, def_level, keywords, rarity, slash_res, pierce_res, blunt_res')
    .eq('id', identity_id)
    .single()

  if (idErr || !identity) return NextResponse.json({ error: 'Identity not found' }, { status: 404 })

  // 2. 수감자 이름
  const { data: sinner } = await supabase
    .schema('limbus')
    .from('sinners')
    .select('name, name_kr, name_jp')
    .eq('id', identity.sinner_id)
    .single()
  const sinnerName = lang === 'en' ? (sinner?.name || sinner?.name_kr || identity.sinner_id)
    : lang === 'jp' ? (sinner?.name_jp || sinner?.name_kr || identity.sinner_id)
    : (sinner?.name_kr || identity.sinner_id)

  // 2-b. 키워드 로컬라이즈 + 설명문 내 [한국어키워드] 치환 함수
  const keywordNames = (identity.keywords || []) as string[]
  let localizedKeywords = keywordNames
  let kwReplaceFn = (text: string) => text  // no-op for ko

  if (lang !== 'ko') {
    const { data: allKw, error: kwErr } = await supabase
      .schema('limbus')
      .from('keyword_meta')
      .select('name, name_en, name_jp')

    if (kwErr) {
      console.error('keyword_meta fetch error:', kwErr)
    } else if (allKw && allKw.length > 0) {
      const kwMap = new Map(allKw.map((k: { name: string; name_en: string | null; name_jp: string | null }) => [k.name, k]))

      // Localize identity keyword list
      localizedKeywords = keywordNames.map((kr: string) => {
        const kw = kwMap.get(kr)
        if (!kw) return kr
        if (lang === 'en') return kw.name_en || kr
        if (lang === 'jp') return kw.name_jp || kr
        return kr
      })

      // Build replacement function: [한국어키워드] → [LocalizedKeyword] in description text
      // Also replaces plain-text Korean keyword names (longest first to avoid partial matches)
      kwReplaceFn = (text: string) => {
        if (!text) return text
        // First pass: bracket keywords [한국어] → [English]
        let result = text.replace(/\[([^\]]+)\]/g, (match, kwName) => {
          const kw = kwMap.get(kwName)
          if (!kw) return match
          const localized = lang === 'en' ? kw.name_en : lang === 'jp' ? kw.name_jp : null
          return localized ? `[${localized}]` : match
        })
        // Second pass: plain text keywords (longest first to avoid partial matches)
        const sortedKr = [...kwMap.keys()].sort((a, b) => b.length - a.length)
        for (const kr of sortedKr) {
          const kw = kwMap.get(kr)!
          const localized = lang === 'en' ? kw.name_en : lang === 'jp' ? kw.name_jp : null
          if (localized && kr !== localized) {
            result = result.split(kr).join(localized)
          }
        }
        return result
      }
    }
  }

  // 3. 스킬 (4동기화)
  const { data: skillsRaw } = await supabase
    .schema('limbus')
    .from('skills')
    .select('name, name_en, name_jp, skill_type, sin_affinity, coins, base_power, coin_power, description, description_en, description_jp, skill_order, offense_level, atk_weight, uptie_level, variant_order')
    .eq('identity_id', identity_id)
    .eq('uptie_level', 4)
    .order('skill_order')
  const skills = skillsRaw ?? []

  // 4. 패시브 (4동기화)
  const { data: passivesRaw } = await supabase
    .schema('limbus')
    .from('passives')
    .select('name, name_en, name_jp, passive_type, sin_affinity, sin_count, active_cond, description, description_en, description_jp, uptie_level')
    .eq('identity_id', identity_id)
    .eq('uptie_level', 4)
  const passives = passivesRaw ?? []

  // 5. 이 인격이 포함된 덱 (추천순 최대 10개)
  const { data: deckLinks } = await supabase
    .schema('limbus')
    .from('deck_identities')
    .select('deck_id, slot_order')
    .eq('identity_id', identity_id)
    .limit(30)

  let deckContextStr = ''
  if (deckLinks && deckLinks.length > 0) {
    const deckIds = [...new Set(deckLinks.map(d => d.deck_id))]
    const { data: decks } = await supabase
      .schema('limbus')
      .from('decks')
      .select('id, title, description, tags, vote_count')
      .in('id', deckIds)
      .order('vote_count', { ascending: false })
      .limit(10)

    if (decks && decks.length > 0) {
      // 각 덱의 편성 조회
      for (const deck of decks) {
        const { data: slots } = await supabase
          .schema('limbus')
          .from('deck_identities')
          .select('slot_order, identities(name_kr, name_en, name_jp, sinner_id)')
          .eq('deck_id', deck.id)
          .order('slot_order')

        // 수감자명 매핑을 위해 sinner_ids 수집
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const sinnerIds = [...new Set((slots || []).filter((s: any) => s.identities).map((s: any) => (s.identities as { sinner_id: string }).sinner_id))]
        const { data: sinners } = await supabase
          .schema('limbus')
          .from('sinners')
          .select('id, name, name_kr, name_jp')
          .in('id', sinnerIds)
        const sinnerMap: Record<string, string> = {}
        for (const s of sinners || []) {
          sinnerMap[s.id] = lang === 'en' ? (s.name || s.name_kr) : lang === 'jp' ? (s.name_jp || s.name_kr) : s.name_kr
        }

        const composition = (slots || [])
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .filter((s: any) => s.identities)
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .map((s: any) => {
            const ident = s.identities as { name_kr: string; name_en?: string; name_jp?: string; sinner_id: string }
            const identName = lang === 'en' ? (ident.name_en || ident.name_kr) : lang === 'jp' ? (ident.name_jp || ident.name_kr) : ident.name_kr
            return `${sinnerMap[ident.sinner_id] || ident.sinner_id}:${identName}`
          })
          .join(', ')

        const deckLabel = lang === 'en' ? 'votes' : lang === 'jp' ? '推薦' : '추천'
        const compLabel = lang === 'en' ? 'Composition' : lang === 'jp' ? '編成' : '편성'
        const descLabel = lang === 'en' ? 'Description' : lang === 'jp' ? '説明' : '설명'
        deckContextStr += `\n"${deck.title}" (${deckLabel} ${deck.vote_count})\n${compLabel}: ${composition}\n`
        if (deck.description) deckContextStr += `${descLabel}: ${deck.description.slice(0, 200)}\n`
      }
    }
  }

  // 6. 프롬프트 조립 (변형 스킬 감지)
  const variantGroups = new Map<number, typeof skills>()
  for (const s of skills) {
    const base = s.skill_order >= 5 ? 3 : s.skill_order
    if (!variantGroups.has(base)) variantGroups.set(base, [])
    variantGroups.get(base)!.push(s)
  }

  // i18n maps
  const sinMap = lang === 'en' ? SIN_EN : lang === 'jp' ? SIN_JP : SIN_KR
  const typeMap = lang === 'en' ? SKILL_TYPE_EN : lang === 'jp' ? SKILL_TYPE_JP : SKILL_TYPE_KR
  const id_ = identity as any
  const identityName = lang === 'en' ? (id_.name_en || identity.name_kr)
    : lang === 'jp' ? (id_.name_jp || identity.name_kr)
    : (identity.name_kr || identity.name)
  const noneLabel = lang === 'en' ? 'none' : lang === 'jp' ? 'なし' : '없음'
  const defLabel = lang === 'en' ? 'Defense' : lang === 'jp' ? '防御' : '수비'

  const skillsText = skills.map(s => {
    const base = s.skill_order >= 5 ? 3 : s.skill_order
    const group = variantGroups.get(base) || [s]
    const idx = group.indexOf(s) + 1
    const hasVariants = group.length > 1
    const orderLabel = base === 4
      ? (hasVariants ? `${defLabel}-${idx}` : defLabel)
      : (hasVariants ? `S${base}-${idx}` : `S${base}`)
    const chipToken = hasVariants ? `[s:${sinnerName}:${base}:${idx}]` : `[s:${sinnerName}:${base}]`
    const skillName = lang === 'en' ? (s.name_en || s.name) : lang === 'jp' ? (s.name_jp || s.name) : s.name
    const skillDesc = kwReplaceFn(lang === 'en' ? (s.description_en || s.description) : lang === 'jp' ? (s.description_jp || s.description) : s.description)
    const typeLabel = typeMap[s.skill_type] || s.skill_type
    const sinLabel = sinMap[s.sin_affinity] || s.sin_affinity
    const coinSign = s.coin_power >= 0 ? `+${s.coin_power}` : `${s.coin_power}`
    const chipLabel = lang === 'en' ? 'chip' : lang === 'jp' ? 'チップ' : '칩'
    const typeHeader = lang === 'en' ? 'Type' : lang === 'jp' ? 'タイプ' : '타입'
    const sinHeader = lang === 'en' ? 'Sin' : lang === 'jp' ? '罪悪' : '죄악'
    const powerHeader = lang === 'en' ? 'Power' : lang === 'jp' ? '威力' : '위력'
    const coinsHeader = lang === 'en' ? 'Coins' : lang === 'jp' ? 'コイン' : '코인'
    const offHeader = lang === 'en' ? 'Offense Level' : lang === 'jp' ? '攻撃レベル' : '공격레벨'
    const descHeader = lang === 'en' ? 'Desc' : lang === 'jp' ? '説明' : '설명'
    const coinsUnit = lang === 'en' ? '' : lang === 'jp' ? '枚' : '개'
    return `[${orderLabel}] ${skillName} (${chipLabel}: ${chipToken})\n${typeHeader}: ${typeLabel} / ${sinHeader}: ${sinLabel} / ${powerHeader}: ${s.base_power} / ${coinsHeader}: ${s.coins}${coinsUnit} (${coinSign}) / ${offHeader}: ${s.offense_level || '-'}\n${descHeader}: ${skillDesc || noneLabel}`
  }).join('\n\n')

  const passivesText = passives.map(p => {
    const passiveName = lang === 'en' ? (p.name_en || p.name) : lang === 'jp' ? (p.name_jp || p.name) : p.name
    const passiveDesc = kwReplaceFn(lang === 'en' ? (p.description_en || p.description) : lang === 'jp' ? (p.description_jp || p.description) : p.description)
    const pTypeLabel = p.passive_type === 'battle'
      ? (lang === 'en' ? 'Battle' : lang === 'jp' ? 'バトル' : '전투')
      : (lang === 'en' ? 'Support' : lang === 'jp' ? 'サポート' : '서포트')
    const pSinLabel = sinMap[p.sin_affinity] || p.sin_affinity || noneLabel
    const condHeader = lang === 'en' ? 'Condition' : lang === 'jp' ? '条件' : '조건'
    const descHeader = lang === 'en' ? 'Desc' : lang === 'jp' ? '説明' : '설명'
    return `[${pTypeLabel}] ${passiveName}\n${condHeader}: ${pSinLabel} x${p.sin_count || 0}\n${descHeader}: ${passiveDesc || noneLabel}`
  }).join('\n\n')

  const resSlash = RES_KR[identity.slash_res] || identity.slash_res || '-'
  const resPierce = RES_KR[identity.pierce_res] || identity.pierce_res || '-'
  const resBlunt = RES_KR[identity.blunt_res] || identity.blunt_res || '-'

  // Localized resistance type labels
  const resSlashLabel = typeMap['slash'] || 'Slash'
  const resPierceLabel = typeMap['pierce'] || 'Pierce'
  const resBluntLabel = typeMap['blunt'] || 'Blunt'

  // Build userPrompt based on lang
  const userPrompt = lang === 'en' ? `# Analysis Target
Sinner: ${sinnerName}
Identity: ${identityName} (${identity.rarity}★, Tier ${identity.tier})
Keywords: ${localizedKeywords.join(', ')}
Resistance: ${resSlashLabel} ${resSlash} / ${resPierceLabel} ${resPierce} / ${resBluntLabel} ${resBlunt}

# Keyword List (always use exact names from this list when mentioning keywords)
${localizedKeywords.map((kw: string) => `- ${kw}`).join('\n')}
HP: ${identity.hp} / Speed: ${identity.speed_min}~${identity.speed_max} / Defense Level: ${identity.def_level}

# Skills (Uptie 4)
${skillsText}

# Passives (Uptie 4)
${passivesText}

# Popular Decks Containing This Identity (up to 10)
${deckContextStr || '(No decks contain this identity)'}

Based on the data above, write an operation guide for this identity.
Actively use chip syntax ([i:], [s:], [p:]). Never write plain text like "Don Quixote S1" — always use [s:${sinnerName}:1] format.
If variant skills exist, always include the variant number: [s:${sinnerName}:order:variant].
Use "${sinnerName}" for the sinner name.`
  : lang === 'jp' ? `# 分析対象
囚人: ${sinnerName}
人格: ${identityName} (${identity.rarity}星, ティア ${identity.tier})
キーワード: ${localizedKeywords.join(', ')}
耐性: ${resSlashLabel} ${resSlash} / ${resPierceLabel} ${resPierce} / ${resBluntLabel} ${resBlunt}

# キーワード一覧 (キーワードに言及する際は必ずこのリストの正確な名前を使用してください)
${localizedKeywords.map((kw: string) => `- ${kw}`).join('\n')}
HP: ${identity.hp} / 速度: ${identity.speed_min}~${identity.speed_max} / 防御レベル: ${identity.def_level}

# スキル (4同期化)
${skillsText}

# パッシブ (4同期化)
${passivesText}

# この人格が含まれる人気デッキ (最大10個)
${deckContextStr || '(この人格が含まれるデッキはありません)'}

上記データに基づいて、この人格の運用ガイドを作成してください。
チップ構文([i:], [s:], [p:])を積極的に活用してください。「ドンキホーテ S1」のような一般テキストは絶対禁止、必ず[s:${sinnerName}:1]形式で書いてください。
変形スキルがある場合は必ず変形番号まで[s:${sinnerName}:順序:変形番号]形式で書いてください。
囚人名は「${sinnerName}」を使用してください。`
  : `# 분석 대상
수감자: ${sinnerName}
인격: ${identityName} (${identity.rarity}성, 등급 ${identity.tier})
보유 키워드: ${(identity.keywords || []).join(', ')}
내성: 참격 ${resSlash} / 관통 ${resPierce} / 타격 ${resBlunt}

# 키워드 목록 (키워드 언급 시 반드시 이 목록의 정확한 이름을 사용하세요)
${((identity.keywords || []) as string[]).map((kw: string) => `- ${kw}`).join('\n')}
HP: ${identity.hp} / 속도: ${identity.speed_min}~${identity.speed_max} / 방어레벨: ${identity.def_level}

# 스킬 (4동기화)
${skillsText}

# 패시브 (4동기화)
${passivesText}

# 이 인격이 포함된 인기 덱 (최대 10개)
${deckContextStr || '(이 인격이 포함된 덱이 없습니다)'}

위 데이터를 기반으로 이 인격의 운영 가이드를 작성해주세요.
칩 문법([i:], [s:], [p:])을 적극 활용해주세요. "돈키호테 S1" 같은 일반 텍스트 절대 금지, 반드시 [s:${sinnerName}:1] 형태로 쓰세요.
변형 스킬이 있으면 반드시 변형번호까지 [s:${sinnerName}:순서:변형번호] 형태로 쓰세요.
수감자명은 "${sinnerName}"을 사용하세요.`

  // 7. AI 스트리밍 호출
  const modelId = process.env.INIRU_AI_MODEL || 'gpt-5.4-mini'

  const SYSTEM_PROMPT_EN = `You are a "Limbus Company" game expert.
Analyze the given Identity data and provide a strategic summary.

## Output Format Rules

### Section Structure (Required)
Divide into exactly 4 sections. Each section must start with the format:
---section:Section Title---

---section:Overview---
---section:Skill Analysis---
---section:Passive Analysis---
---section:Recommendations---

### Chip Syntax (Inline References) — Mandatory
When mentioning skills, identities, or passives, you MUST use chip syntax. Never write plain text like "Don Quixote S1".

- Identity: [i:SinnerName:IdentityName] (e.g., [i:Yi Sang:LCB Sinner])
- Normal Skill: [s:SinnerName:SkillOrder] (e.g., [s:Yi Sang:1] = S1)
- Variant Skill: [s:SinnerName:SkillOrder:VariantNumber] (e.g., [s:Don Quixote:1:1] = S1 first variant)
- Defense Skill: [s:SinnerName:4] (single defense), [s:SinnerName:4:1] / [s:SinnerName:4:2] (multiple)
- Passive: [p:PassiveName]

### CRITICAL: Variant Skill Frames
If a skill slot has multiple variants (e.g., S3-1 and S3-2), you MUST use variant frame syntax:
- {{skill:3:1}} for the first variant
- {{skill:3:2}} for the second variant
NEVER use {{skill:3}} to show a variant skill. Each variant MUST have its own frame.
When analyzing variant skills, always use the specific variant frame, not the generic slot frame.
If the skill data labels a skill as S3-1 or S3-2, you MUST use {{skill:3:1}} or {{skill:3:2}} respectively.

### Component Syntax (UI Embeds)
When explaining skills/passives, insert frames using:
- {{skill:1}} — Skill 1 frame (no variants)
- {{skill:2}} — Skill 2 frame (no variants)
- {{skill:3}} — Skill 3 frame (only when NO variants exist)
- {{skill:3:1}} — Skill 3 variant 1 frame (use this when S3-1 exists)
- {{skill:3:2}} — Skill 3 variant 2 frame (use this when S3-2 exists)
- {{skill:4}} — Defense skill frame
- {{passive:battle}} — Battle passive card
- {{passive:support}} — Support passive card

### CRITICAL: Passive Frame Usage
- Use {{passive:battle}} ONCE for the battle passive
- Use {{passive:support}} ONCE for the support passive
- NEVER use {{passive:battle}} when discussing the support passive
- Each passive type must use its own frame syntax

Component syntax must be on its own line.

### Writing Rules
- Keywords (Bleed, Tremor, etc.) should be plain text, no chip syntax
- When mentioning keywords, use the exact full name from the "Keyword List"
- IMPORTANT: Skill descriptions may contain Korean keyword names. Always translate them to the English names from the Keyword List. Never output Korean keyword names in your analysis.
- No markdown formatting, no brackets except chip/component syntax
- Keep analysis concise and practical
- Write in English`

  const SYSTEM_PROMPT_JA = `あなたは「リンバスカンパニー」の専門家です。
与えられた人格（Identity）のデータを分析し、戦略的な要約を提供してください。

## 出力形式ルール

### セクション構成（必須）
必ず以下の4つのセクションに分けて記述してください。各セクションは必ず以下の形式で始めてください：
---section:セクションタイトル---

---section:概要---
---section:スキル分析---
---section:パッシブ分析---
---section:おすすめ運用---

### チップ構文（インライン参照）— 必須
スキル、人格、パッシブに言及する際は、必ず以下のチップ構文を使用してください。「ドンキホーテ S1」のような通常テキストは禁止です。

- 人格: [i:囚人名:人格名]（例: [i:イサン:LCB囚人]）
- 通常スキル: [s:囚人名:スキル順序]（例: [s:イサン:1] = S1）
- 変形スキル: [s:囚人名:スキル順序:変形番号]（例: [s:ドンキホーテ:1:1] = S1第1変形）
- 防御スキル: [s:囚人名:4]（1つの場合）、[s:囚人名:4:1] / [s:囚人名:4:2]（複数の場合）
- パッシブ: [p:パッシブ名]

### 重要：変形スキルフレーム（必ず遵守）
スキルスロットに変形がある場合（例：S3-1、S3-2）、必ず変形フレーム構文を使用してください：
- {{skill:3:1}} — 変形1
- {{skill:3:2}} — 変形2
{{skill:3}}で変形スキルを表示しないでください。各変形は必ず個別のフレームを使用してください。
スキルデータにS3-1、S3-2のようなラベルがある場合、必ず{{skill:3:1}}、{{skill:3:2}}をそれぞれ使用してください。

### コンポーネント構文（UIエンベッド）
スキル/パッシブを説明する際、以下の構文でフレームを挿入してください：
- {{skill:1}} — スキル1フレーム（変形なし）
- {{skill:2}} — スキル2フレーム（変形なし）
- {{skill:3}} — スキル3フレーム（変形がない場合のみ使用）
- {{skill:3:1}} — スキル3変形1フレーム（S3-1がある場合はこれを使用）
- {{skill:3:2}} — スキル3変形2フレーム（S3-2がある場合はこれを使用）
- {{skill:4}} — 防御スキルフレーム
- {{passive:battle}} — バトルパッシブカード
- {{passive:support}} — サポートパッシブカード

### 重要：パッシブフレームの使用
- {{passive:battle}} はバトルパッシブにのみ使用
- {{passive:support}} はサポートパッシブにのみ使用
- サポートパッシブの説明に {{passive:battle}} を使用しないでください
- 各パッシブは必ず該当タイプのフレームを使用してください

コンポーネント構文は必ず単独行で記述してください。

### 記述ルール
- キーワード（出血、振動など）はチップ構文なしの通常テキスト
- キーワードに言及する際は、「キーワード一覧」の正確な名前を使用
- 重要：スキル説明に韓国語のキーワード名が含まれている場合があります。必ずキーワードリストの日本語名に翻訳してください。韓国語のキーワード名を出力しないでください。
- マークダウン形式禁止、チップ/コンポーネント構文以外の括弧禁止
- 分析は簡潔かつ実用的に
- 日本語で記述`

  const systemPrompt = lang === 'en' ? SYSTEM_PROMPT_EN : lang === 'ja' ? SYSTEM_PROMPT_JA : SYSTEM_PROMPT

  const result = streamText({
    model: ai.chat(modelId),
    system: systemPrompt,
    prompt: userPrompt,
    maxOutputTokens: 1500,
    onFinish: async ({ text }) => {
      if (!text) return
      const { error: upsertErr } = await supabase
        .schema('limbus')
        .from('identity_ai_summaries')
        .upsert({
          identity_id,
          summary: text,
          model: modelId,
          lang,
          created_at: new Date().toISOString(),
        }, { onConflict: 'identity_id,lang' })
      if (upsertErr) {
        console.error('AI summary upsert error:', upsertErr)
      }
    },
  })

  return result.toTextStreamResponse()
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal Server Error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

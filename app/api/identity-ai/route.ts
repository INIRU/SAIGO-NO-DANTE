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

### 컴포넌트 문법 (UI 임베드)
스킬/패시브를 설명할 때 아래 문법으로 해당 프레임을 삽입하세요:
- {{skill:1}} — 스킬 1 프레임
- {{skill:2}} — 스킬 2 프레임
- {{skill:3}} — 스킬 3 프레임
- {{skill:4}} — 수비 스킬 프레임 (있는 경우)
- {{passive:battle}} — 전투 패시브 카드
- {{passive:support}} — 서포트 패시브 카드
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
const SIN_KR: Record<string, string> = {
  wrath: '분노', lust: '색욕', sloth: '나태', gluttony: '탐식',
  gloom: '우울', pride: '오만', envy: '질투',
}
const RES_KR: Record<string, string> = {
  fatal: '치명', weak: '취약', normal: '보통', resist: '내성', immune: '면역',
}

// GET: 캐시 조회
export async function GET(req: NextRequest) {
  try {
    const identityId = req.nextUrl.searchParams.get('identity_id')
    if (!identityId) return NextResponse.json({ error: 'identity_id required' }, { status: 400 })

    const supabase = createAdminClient()
    const { data } = await supabase
      .schema('limbus')
      .from('identity_ai_summaries')
      .select('summary, model, created_at')
      .eq('identity_id', identityId)
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
  const { identity_id } = body
  if (!identity_id) return NextResponse.json({ error: 'identity_id required' }, { status: 400 })

  const supabase = createAdminClient()

  // 1. 인격 정보 조회
  const { data: identity, error: idErr } = await supabase
    .schema('limbus')
    .from('identities')
    .select('id, sinner_id, name, name_kr, tier, hp, speed_min, speed_max, def_level, keywords, rarity, slash_res, pierce_res, blunt_res')
    .eq('id', identity_id)
    .single()

  if (idErr || !identity) return NextResponse.json({ error: 'Identity not found' }, { status: 404 })

  // 2. 수감자 이름
  const { data: sinner } = await supabase
    .schema('limbus')
    .from('sinners')
    .select('name_kr')
    .eq('id', identity.sinner_id)
    .single()
  const sinnerName = sinner?.name_kr || identity.sinner_id

  // 3. 스킬 (4동기화)
  const { data: skillsRaw } = await supabase
    .schema('limbus')
    .from('skills')
    .select('name, skill_type, sin_affinity, coins, base_power, coin_power, description, skill_order, offense_level, atk_weight, uptie_level, variant_order')
    .eq('identity_id', identity_id)
    .eq('uptie_level', 4)
    .order('skill_order')
  const skills = skillsRaw ?? []

  // 4. 패시브 (4동기화)
  const { data: passivesRaw } = await supabase
    .schema('limbus')
    .from('passives')
    .select('name, passive_type, sin_affinity, sin_count, active_cond, description, uptie_level')
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
          .select('slot_order, identities(name_kr, sinner_id)')
          .eq('deck_id', deck.id)
          .order('slot_order')

        // 수감자명 매핑을 위해 sinner_ids 수집
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const sinnerIds = [...new Set((slots || []).filter((s: any) => s.identities).map((s: any) => (s.identities as { sinner_id: string }).sinner_id))]
        const { data: sinners } = await supabase
          .schema('limbus')
          .from('sinners')
          .select('id, name_kr')
          .in('id', sinnerIds)
        const sinnerMap: Record<string, string> = {}
        for (const s of sinners || []) sinnerMap[s.id] = s.name_kr

        const composition = (slots || [])
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .filter((s: any) => s.identities)
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .map((s: any) => {
            const ident = s.identities as { name_kr: string; sinner_id: string }
            return `${sinnerMap[ident.sinner_id] || ident.sinner_id}:${ident.name_kr}`
          })
          .join(', ')

        deckContextStr += `\n"${deck.title}" (추천 ${deck.vote_count})\n편성: ${composition}\n`
        if (deck.description) deckContextStr += `설명: ${deck.description.slice(0, 200)}\n`
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

  const skillsText = skills.map(s => {
    const base = s.skill_order >= 5 ? 3 : s.skill_order
    const group = variantGroups.get(base) || [s]
    const idx = group.indexOf(s) + 1
    const hasVariants = group.length > 1
    const orderLabel = base === 4
      ? (hasVariants ? `수비-${idx}` : '수비')
      : (hasVariants ? `S${base}-${idx}` : `S${base}`)
    const chipToken = hasVariants ? `[s:${sinnerName}:${base}:${idx}]` : `[s:${sinnerName}:${base}]`
    const typeKr = SKILL_TYPE_KR[s.skill_type] || s.skill_type
    const sinKr = SIN_KR[s.sin_affinity] || s.sin_affinity
    const coinSign = s.coin_power >= 0 ? `+${s.coin_power}` : `${s.coin_power}`
    return `[${orderLabel}] ${s.name} (칩: ${chipToken})\n타입: ${typeKr} / 죄악: ${sinKr} / 위력: ${s.base_power} / 코인: ${s.coins}개 (${coinSign}) / 공격레벨: ${s.offense_level || '-'}\n설명: ${s.description || '없음'}`
  }).join('\n\n')

  const passivesText = passives.map(p => {
    const typeKr = p.passive_type === 'battle' ? '전투' : '서포트'
    const sinKr = SIN_KR[p.sin_affinity] || p.sin_affinity || '없음'
    return `[${typeKr}] ${p.name}\n조건: ${sinKr} x${p.sin_count || 0}\n설명: ${p.description || '없음'}`
  }).join('\n\n')

  const resSlash = RES_KR[identity.slash_res] || identity.slash_res || '-'
  const resPierce = RES_KR[identity.pierce_res] || identity.pierce_res || '-'
  const resBlunt = RES_KR[identity.blunt_res] || identity.blunt_res || '-'

  const userPrompt = `# 분석 대상
수감자: ${sinnerName}
인격: ${identity.name_kr || identity.name} (${identity.rarity}성, 등급 ${identity.tier})
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

  const result = streamText({
    model: ai.chat(modelId),
    system: SYSTEM_PROMPT,
    prompt: userPrompt,
    temperature: 0.7,
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
          created_at: new Date().toISOString(),
        }, { onConflict: 'identity_id' })
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

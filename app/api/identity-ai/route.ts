import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

const AI_API_URL = process.env.INIRU_AI_API_URL || 'https://api.iniru.net/v1/chat/completions'
const AI_API_KEY = process.env.INIRU_AI_API_KEY || ''
const AI_MODEL = 'gpt-5.4'
const CACHE_DAYS = 14

const SYSTEM_PROMPT = `당신은 "림버스 컴퍼니" 게임의 전문 분석가입니다.
주어진 인격(Identity)의 데이터를 분석하여 한국어로 간결한 운영 가이드를 작성하세요.

## 응답 형식 규칙 (반드시 준수)
- 아래 3종류만 칩 문법을 사용하세요:
  - 인격: [i:수감자명:인격명] (예: [i:이상:LCB 수감자], [i:파우스트:로보토미 E.G.O::후회], [i:뫼르소:동부 엄지 카포 IIII])
  - 스킬: [s:수감자명:스킬순서] (예: [s:이상:1] = S1)
  - 변형 스킬: [s:수감자명:스킬순서:변형번호] (예: [s:이상:3:1] = S3-1, [s:이상:3:2] = S3-2)
  - 패시브: [p:패시브명]
- 인격을 언급할 때는 절대 일반 텍스트로 쓰지 말고 반드시 [i:수감자명:인격명] 형식으로 쓰세요.
  - 예: "로보토미 E.G.O::후회 파우스트와 잘 맞습니다" (X 잘못됨)
  - 예: "[i:파우스트:로보토미 E.G.O::후회]와 잘 맞습니다" (O 올바름)
- 덱 편성에 나오는 "수감자명:인격명" 형태는 반드시 [i:수감자명:인격명]으로 변환하세요.
- 키워드(출혈, 진동 등), EGO, EGO 기프트는 칩 문법 없이 일반 텍스트로 작성하세요.
- 칩 문법 외의 대괄호는 사용하지 마세요.
- 마크다운 헤딩(##)이나 볼드(**)는 사용하지 마세요. 순수 텍스트 + 칩 문법만 사용합니다.
- 줄바꿈으로 문단을 구분하세요.
- 각 항목은 2~3문장으로 핵심만 간결하게 작성하세요. 전체 응답은 800자 이내로 작성하세요.

## 응답 구조
1. 한줄 요약 (이 인격의 핵심 역할)
2. 스킬 분석 (핵심 스킬 위주로 간결하게)
3. 패시브 분석 (전투/서포트 활용 핵심)
4. 추천 운영 및 편성 (덱 데이터 기반, 자주 함께 쓰이는 인격 언급)`

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

  // 3. 스킬 (4동기화 우선, 없으면 3)
  const { data: allSkills } = await supabase
    .schema('limbus')
    .from('skills')
    .select('name, skill_type, sin_affinity, coins, base_power, coin_power, description, skill_order, offense_level, atk_weight, uptie_level')
    .eq('identity_id', identity_id)
    .order('skill_order')

  const skills4 = allSkills?.filter(s => (s.uptie_level ?? 3) === 4) || []
  const skills3 = allSkills?.filter(s => (s.uptie_level ?? 3) === 3) || []
  const skills = skills4.length > 0 ? skills4 : skills3

  // 4. 패시브 (4동기화 우선)
  const { data: allPassives } = await supabase
    .schema('limbus')
    .from('passives')
    .select('name, passive_type, sin_affinity, sin_count, active_cond, description, uptie_level')
    .eq('identity_id', identity_id)

  const pass4 = allPassives?.filter(p => (p.uptie_level ?? 3) === 4) || []
  const pass3 = allPassives?.filter(p => (p.uptie_level ?? 3) === 3) || []
  const passives = pass4.length > 0 ? pass4 : pass3

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
    const chipToken = base === 4
      ? '수비'
      : (hasVariants ? `[s:${sinnerName}:${base}:${idx}]` : `[s:${sinnerName}:${base}]`)
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
키워드: ${(identity.keywords || []).join(', ')}
내성: 참격 ${resSlash} / 관통 ${resPierce} / 타격 ${resBlunt}
HP: ${identity.hp} / 속도: ${identity.speed_min}~${identity.speed_max} / 방어레벨: ${identity.def_level}

# 스킬 (4동기화)
${skillsText}

# 패시브 (4동기화)
${passivesText}

# 이 인격이 포함된 인기 덱 (최대 10개)
${deckContextStr || '(이 인격이 포함된 덱이 없습니다)'}

위 데이터를 기반으로 이 인격의 운영 가이드를 작성해주세요.
칩 문법([i:], [s:], [k:] 등)을 적극 활용해주세요.
수감자명은 "${sinnerName}"을 사용하세요.`

  // 7. AI API 호출
  try {
    const aiRes = await fetch(AI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${AI_API_KEY}`,
      },
      body: JSON.stringify({
        model: AI_MODEL,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.7,
        max_tokens: 1200,
      }),
    })

    if (!aiRes.ok) {
      const errText = await aiRes.text()
      return NextResponse.json({ error: `AI API error: ${aiRes.status}`, detail: errText }, { status: 502 })
    }

    const aiData = await aiRes.json()
    const summary = aiData.choices?.[0]?.message?.content?.trim() || ''

    if (!summary) {
      return NextResponse.json({ error: 'AI returned empty response' }, { status: 502 })
    }

    // 8. DB UPSERT
    const { error: upsertErr } = await supabase
      .schema('limbus')
      .from('identity_ai_summaries')
      .upsert({
        identity_id,
        summary,
        model: AI_MODEL,
        created_at: new Date().toISOString(),
      }, { onConflict: 'identity_id' })

    if (upsertErr) {
      console.error('AI summary upsert error:', upsertErr)
    }

    return NextResponse.json({ summary, model: AI_MODEL, created_at: new Date().toISOString() })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: 'AI API request failed', detail: message }, { status: 502 })
  }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal Server Error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

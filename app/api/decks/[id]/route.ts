import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { findOrCreateSupabaseUser } from '@/lib/supabase/findOrCreateUser'

export const dynamic = 'force-dynamic'

// ── 덱 코드 인코딩 (DeckBuilderClient와 동일 로직) ─────────────────────────
const BIT_POS = { identity: 4, formation: 8, ZAYIN: 15, TETH: 22, HE: 29, WAW: 36 } as const

function writeBits(arr: string[], start: number, len: number, val: number) {
  const s = val.toString(2).padStart(len, '0')
  for (let i = 0; i < len; i++) arr[start + i] = s[i]
}

async function buildDeckCode(
  sinnerOrder: string[],
  slotMap: Record<string, { gameId: string; formOrder: number }>,
  sinnerGameIds: Record<string, string[]>,
  egoMap: Record<string, Record<string, string>>,   // sinnerId → grade → ego_id
  sinnerEgoIds: Record<string, string[]>,           // sinnerId → ego_id[] (grade,name순)
): Promise<string> {
  const arr = Array(560).fill('0')

  for (let si = 0; si < 12; si++) {
    const sinnerId = sinnerOrder[si]
    if (!sinnerId) continue
    const off = si * 46

    // 인격 + 편성 순서
    const slot = slotMap[sinnerId]
    if (slot) {
      const sortedIds = sinnerGameIds[sinnerId] ?? []
      const identityIdx = sortedIds.indexOf(slot.gameId) + 1
      if (identityIdx > 0) {
        writeBits(arr, off + BIT_POS.identity, 4, identityIdx)
        if (slot.formOrder > 0) writeBits(arr, off + BIT_POS.formation, 4, slot.formOrder)
      }
    }

    // 에고 (ZAYIN/TETH/HE/WAW)
    const allEgos = sinnerEgoIds[sinnerId] ?? []
    const gradeEgos = egoMap[sinnerId] ?? {}
    const gradeBits: Record<string, number> = {
      ZAYIN: BIT_POS.ZAYIN, TETH: BIT_POS.TETH, HE: BIT_POS.HE, WAW: BIT_POS.WAW,
    }
    for (const [grade, bitPos] of Object.entries(gradeBits)) {
      const egoId = gradeEgos[grade]
      if (!egoId) continue
      const idx = allEgos.indexOf(egoId) + 1
      if (idx > 0) writeBits(arr, off + bitPos, 4, idx)
    }
  }

  const bytes = new Uint8Array(70)
  for (let i = 0; i < 70; i++) {
    bytes[i] = parseInt(arr.slice(i * 8, i * 8 + 8).join(''), 2)
  }
  const b64 = btoa(String.fromCharCode(...bytes))

  const cs = new CompressionStream('gzip')
  const cw = cs.writable.getWriter()
  cw.write(new TextEncoder().encode(b64))
  cw.close()
  const buf = await new Response(cs.readable).arrayBuffer()
  return btoa(String.fromCharCode(...new Uint8Array(buf)))
}

// ── GET ────────────────────────────────────────────────────────────────────
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const supabase = await createClient()

  const [deckRes, sinnersRes] = await Promise.all([
    supabase
      .schema('limbus')
      .from('decks')
      .select(`
        id, user_id, title, description, tags, vote_count, view_count, created_at,
        profiles!decks_user_id_fkey(username),
        deck_identities(
          slot_order, gacksung, s1_count, s2_count, s3_count,
          identities(
            sinner_id, folder_name, game_id, keywords, name_kr, tier, rarity,
            hp, speed_min, speed_max, def_level, slash_res, pierce_res, blunt_res,
            skills(id, name, skill_type, sin_affinity, coins, base_power, coin_power, skill_order, atk_weight, offense_level, description),
            passives(name, passive_type, sin_affinity, sin_count, active_cond, description, passive_order)
          )
        ),
        deck_egos(
          grade,
          ego:ego_id(id, name_kr, grade, sin_affinity, sinner_id, folder_name, image_url)
        )
      `)
      .eq('id', id)
      .single(),
    supabase.schema('limbus').from('sinners').select('id, order_num').order('order_num'),
  ])

  if (deckRes.error) {
    return NextResponse.json({ error: deckRes.error.message }, { status: 404 })
  }
  const deck = deckRes.data
  const sinnerOrder = (sinnersRes.data ?? []).map(s => s.id)

  type SlotIdentity = { sinner_id: string; game_id: string | null } | null

  // ── 덱 코드 계산을 위한 데이터 수집 ─────────────────────────────────────

  // 인격: 각 수감자의 전체 인격 game_id 목록 (정렬용)
  const sinnerIds = [
    ...new Set(
      deck.deck_identities
        .map(di => (di.identities as unknown as SlotIdentity)?.sinner_id)
        .filter((x): x is string => Boolean(x))
    ),
  ]

  // 에고: 각 수감자의 전체 에고 목록 (grade, name 정렬 → index용)
  type DeckEgoRow = { grade: string; ego: { id: string; sinner_id: string; grade: string; name_kr: string | null; sin_affinity: string | null; folder_name: string | null; image_url: string | null } | null }
  const deckEgoRows = (deck.deck_egos ?? []) as unknown as DeckEgoRow[]
  const egoSinnerIds = [
    ...new Set(deckEgoRows.map(r => r.ego?.sinner_id).filter((x): x is string => Boolean(x))),
  ]
  const allSinnerIds = [...new Set([...sinnerIds, ...egoSinnerIds])]

  const [identityRes, egoRes] = await Promise.all([
    sinnerIds.length > 0
      ? supabase.schema('limbus').from('identities').select('sinner_id, game_id').in('sinner_id', sinnerIds)
      : Promise.resolve({ data: [] }),
    allSinnerIds.length > 0
      ? supabase.schema('limbus').from('ego').select('id, sinner_id, grade, name_kr, sin_affinity, image_url').in('sinner_id', allSinnerIds).order('grade').order('name_kr')
      : Promise.resolve({ data: [] }),
  ])

  // sinnerId → game_id[] sorted asc
  const sinnerGameIds: Record<string, string[]> = {}
  for (const row of identityRes.data ?? []) {
    if (!row.game_id) continue
    ;(sinnerGameIds[row.sinner_id] ??= []).push(row.game_id)
  }
  for (const sid of Object.keys(sinnerGameIds)) {
    sinnerGameIds[sid].sort((a, b) => parseInt(a) - parseInt(b))
  }

  // sinnerId → ego_id[] (grade,name_kr 정렬 순)
  const sinnerEgoIds: Record<string, string[]> = {}
  for (const ego of egoRes.data ?? []) {
    ;(sinnerEgoIds[ego.sinner_id] ??= []).push(ego.id)
  }

  // 인격 슬롯 맵
  const slotMap: Record<string, { gameId: string; formOrder: number }> = {}
  for (const di of deck.deck_identities) {
    const id_ = di.identities as unknown as SlotIdentity
    if (!id_?.game_id) continue
    slotMap[id_.sinner_id] = {
      gameId: id_.game_id,
      formOrder: di.slot_order !== 99 ? di.slot_order + 1 : 0,
    }
  }

  // 에고 슬롯 맵: sinnerId → grade → ego_id
  const egoMap: Record<string, Record<string, string>> = {}
  for (const row of deckEgoRows) {
    const sinnerId = row.ego?.sinner_id
    const egoId = row.ego?.id
    if (!sinnerId || !egoId) continue
    ;(egoMap[sinnerId] ??= {})[row.grade] = egoId
  }

  const deckCode = await buildDeckCode(sinnerOrder, slotMap, sinnerGameIds, egoMap, sinnerEgoIds)

  // 소유권 + 관리자 확인 (로그인한 경우만)
  let isOwner = false
  let isAdmin = false
  try {
    const session = await getServerSession(authOptions)
    if (session?.user?.email) {
      const adminClient = createAdminClient()
      const { data: { user: deckOwner } } = await adminClient.auth.admin.getUserById(deck.user_id)
      isOwner = deckOwner?.email === session.user.email
      isAdmin = session.user.isAdmin === true
    }
  } catch { /* not authenticated */ }

  // 조회수 증가 (atomic increment, fire-and-forget)
  supabase.schema('limbus').rpc('increment_view', { deck_id: id }).then(() => {})

  // 노트 렌더링용: 덱 내 수감자의 전체 에고 목록
  const allSinnerEgos = (egoRes.data ?? []).map(e => ({
    sinner_id: e.sinner_id, name_kr: e.name_kr, grade: e.grade,
    sin_affinity: (e as Record<string, unknown>).sin_affinity as string | null,
    image_url: (e as Record<string, unknown>).image_url as string | null,
  }))

  return NextResponse.json({ ...deck, deck_code: deckCode, is_owner: isOwner, is_admin: isAdmin, all_sinner_egos: allSinnerEgos })
}

// ── DELETE ──────────────────────────────────────────────────────────────────
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
  }

  const admin = createAdminClient()
  const userId = await findOrCreateSupabaseUser(
    admin,
    session.user.email,
    session.user.name,
    session.user.image,
  )
  if (!userId) {
    return NextResponse.json({ error: '사용자를 찾을 수 없습니다.' }, { status: 500 })
  }

  // 소유권 확인
  const { data: deck } = await admin
    .schema('limbus')
    .from('decks')
    .select('user_id')
    .eq('id', id)
    .single()

  if (!deck) {
    return NextResponse.json({ error: '덱을 찾을 수 없습니다.' }, { status: 404 })
  }
  if (deck.user_id !== userId) {
    return NextResponse.json({ error: '삭제 권한이 없습니다.' }, { status: 403 })
  }

  // CASCADE로 deck_identities, deck_votes 자동 삭제
  const { error } = await admin
    .schema('limbus')
    .from('decks')
    .delete()
    .eq('id', id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

// ── PATCH ─────────────────────────────────────────────────────────────────
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
  }

  const body = await request.json()
  const { title, description, tags, identitySlots, egoSlots } = body

  if (!title?.trim()) {
    return NextResponse.json({ error: '제목을 입력해주세요.' }, { status: 400 })
  }

  const admin = createAdminClient()
  const userId = await findOrCreateSupabaseUser(
    admin,
    session.user.email,
    session.user.name,
    session.user.image,
  )
  if (!userId) {
    return NextResponse.json({ error: '사용자를 찾을 수 없습니다.' }, { status: 500 })
  }

  // 소유권 확인 (관리자는 소유자가 아니어도 수정 가능, 단 소유자 변경 불가)
  const { data: deck } = await admin
    .schema('limbus')
    .from('decks')
    .select('user_id')
    .eq('id', id)
    .single()

  if (!deck) {
    return NextResponse.json({ error: '덱을 찾을 수 없습니다.' }, { status: 404 })
  }
  const isOwner = deck.user_id === userId
  const isAdmin = session.user?.isAdmin === true
  if (!isOwner && !isAdmin) {
    return NextResponse.json({ error: '수정 권한이 없습니다.' }, { status: 403 })
  }

  // decks 테이블 UPDATE (소유자는 변경하지 않음)
  const { error: updateError } = await admin
    .schema('limbus')
    .from('decks')
    .update({ title, description, tags: tags || [] })
    .eq('id', id)

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  // deck_identities: 기존 삭제 → 새로 삽입
  await admin.schema('limbus').from('deck_identities').delete().eq('deck_id', id)
  if (identitySlots?.length > 0) {
    const rows = identitySlots.map((slot: { identity_id: string; gacksung: boolean; slot_order: number; s1_count?: number; s2_count?: number; s3_count?: number }) => ({
      deck_id: id,
      identity_id: slot.identity_id,
      slot_order: slot.slot_order,
      gacksung: slot.gacksung ?? false,
      s1_count: slot.s1_count ?? 3,
      s2_count: slot.s2_count ?? 2,
      s3_count: slot.s3_count ?? 1,
    }))
    await admin.schema('limbus').from('deck_identities').insert(rows)
  }

  // deck_egos: 기존 삭제 → 새로 삽입
  await admin.schema('limbus').from('deck_egos').delete().eq('deck_id', id)
  if (egoSlots?.length > 0) {
    const rows = egoSlots.map((slot: { ego_id: string; grade: string }) => ({
      deck_id: id,
      ego_id: slot.ego_id,
      grade: slot.grade,
    }))
    await admin.schema('limbus').from('deck_egos').insert(rows)
  }

  return NextResponse.json({ ok: true })
}

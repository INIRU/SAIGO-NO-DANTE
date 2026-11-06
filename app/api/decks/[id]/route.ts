import { NextRequest, NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import { revalidatePostSeries, saveSeriesChoice } from '@/lib/series/server'
import { ownsPost, resolveAuthor } from '@/features/account/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { withPostAuthors } from '@/lib/community/post-authors'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { writeAuditLog } from '@/lib/audit'
import { CACHE_TAGS } from '@/lib/constants/cache-tags'
import { parseDeckMainKeywordsInput } from '@/lib/decks/keyword-rules'
import { encodeTeamCode } from '@/lib/decks/team-code'
import { insertDeckIdentities, normalizeUptie } from '@/lib/decks/deck-identity-uptie'


type EgoAttackSkill = {
  skill_type: string | null
  category: string | null
  construe_level: number | null
  skill_order: number | null
}

// The detail page already has the deck from its first view: `?part=viewer` sends only what that lacks (REQ-DECKS-051).
const VIEWER_COLUMNS = `
  id, user_id, vote_count, view_count,
  deck_identities(slot_order, identities(id, sinner_id, game_id)),
  deck_egos(grade, ego:ego_id(id, sinner_id, grade, game_id))
`

// ── GET ────────────────────────────────────────────────────────────────────
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
  const { id } = await params
  const viewerOnly = request.nextUrl.searchParams.get('part') === 'viewer'
  const supabase = await createClient()

  const [deckRes, sinnersRes] = await Promise.all([
    viewerOnly
      ? supabase.schema('limbus').from('decks').select(VIEWER_COLUMNS).eq('id', id).single()
      : supabase
        .schema('limbus')
        .from('decks')
        .select(`
          id, user_id, title, description, tags, main_keywords, content_type, vote_count, view_count, comment_count, created_at,
          guest_tag, profiles!decks_user_id_fkey(username),
          deck_identities(
            slot_order, gacksung, uptie, s1_count, s2_count, s3_count,
            identities(
              id, sinner_id, folder_name, game_id, keywords, name_kr, tier, rarity,
              hp, speed_min, speed_max, def_level, slash_res, pierce_res, blunt_res,
              skills(id, name, skill_type, atk_type, sin_affinity, coins, base_power, coin_power, coin_list, skill_order, image_id, variant_order, atk_weight, offense_level, description, uptie_level),
              passives(name, passive_type, sin_affinity, sin_count, sin_requirements, active_cond, description, passive_order, uptie_level)
            )
          ),
          deck_egos(
            grade,
            ego:ego_id(id, name_kr, grade, sin_affinity, sinner_id, folder_name, image_url, cost, game_id)
          )
        `)
        .eq('id', id)
        .single(),
    supabase.schema('limbus').from('sinners').select('id, order_num').order('order_num'),
  ])

  if (deckRes.error) {
    return NextResponse.json({ error: deckRes.error.message }, { status: 404 })
  }
  const [deck] = viewerOnly ? [deckRes.data] : await withPostAuthors([deckRes.data])
  const sinners = sinnersRes.data ?? []

  type SlotIdentity = { id: string; sinner_id: string; game_id: string | null } | null

  // ── 덱 코드 계산을 위한 데이터 수집 ─────────────────────────────────────

  const sinnerIds = [
    ...new Set(
      deck.deck_identities
        .map(di => (di.identities as unknown as SlotIdentity)?.sinner_id)
        .filter((x): x is string => Boolean(x))
    ),
  ]

  type DeckEgoRow = { grade: string; ego: { id: string; sinner_id: string; grade: string; name_kr: string | null; sin_affinity: string | null; folder_name: string | null; image_url: string | null; cost: number[] | null; game_id: string | null; ego_skills?: EgoAttackSkill[] | null } | null }
  const deckEgoRows = (deck.deck_egos ?? []) as unknown as DeckEgoRow[]
  const egoSinnerIds = [
    ...new Set(deckEgoRows.map(r => r.ego?.sinner_id).filter((x): x is string => Boolean(x))),
  ]
  const allSinnerIds = [...new Set([...sinnerIds, ...egoSinnerIds])]
  const selectedEgoIds = [
    ...new Set(deckEgoRows.map(r => r.ego?.id).filter((x): x is string => Boolean(x))),
  ]

  const [egoRes, egoSkillsRes] = await Promise.all([
    allSinnerIds.length > 0
      ? supabase.schema('limbus').from('ego').select('id, sinner_id, grade, name_kr, sin_affinity, image_url, game_id').in('sinner_id', allSinnerIds).order('game_id')
      : Promise.resolve({ data: [] }),
    !viewerOnly && selectedEgoIds.length > 0
      ? supabase.schema('limbus').from('ego_skills').select('ego_id, skill_type, category, construe_level, skill_order').in('ego_id', selectedEgoIds)
      : Promise.resolve({ data: [], error: null }),
  ])

  if (egoSkillsRes.error) {
    return NextResponse.json({ error: egoSkillsRes.error.message }, { status: 500 })
  }
  const egoSkillsByEgoId = new Map<string, EgoAttackSkill[]>()
  for (const row of egoSkillsRes.data ?? []) {
    if (typeof row.ego_id !== 'string') continue
    const skills = egoSkillsByEgoId.get(row.ego_id) ?? []
    skills.push({
      skill_type: row.skill_type ?? null,
      category: row.category ?? null,
      construe_level: row.construe_level ?? null,
      skill_order: row.skill_order ?? null,
    })
    egoSkillsByEgoId.set(row.ego_id, skills)
  }

  // 인격 슬롯 맵
  const deckSlots: Record<string, { id: string; sinner_id: string; game_id: string | null } | undefined> = {}
  const formationEntries: { sinnerId: string; order: number }[] = []
  for (const di of deck.deck_identities) {
    const id_ = di.identities as unknown as SlotIdentity
    if (!id_?.sinner_id) continue
    deckSlots[id_.sinner_id] = id_
    if (di.slot_order !== 99) formationEntries.push({ sinnerId: id_.sinner_id, order: di.slot_order + 1 })
  }
  formationEntries.sort((a, b) => a.order - b.order)

  // 에고 슬롯 맵: sinnerId → grade → EGO game_id
  const egoSlots: Record<string, Record<string, { id: string; sinner_id: string; grade: string; game_id: string | null }>> = {}
  for (const row of deckEgoRows) {
    const ego = row.ego
    if (!ego?.sinner_id) continue
    ;(egoSlots[ego.sinner_id] ??= {})[row.grade] = {
      id: ego.id,
      sinner_id: ego.sinner_id,
      grade: row.grade,
      game_id: ego.game_id,
    }
  }

  const deckCode = encodeTeamCode({
    sinners,
    deckSlots,
    egoSlots,
    formationOrder: formationEntries.map(entry => entry.sinnerId),
  })

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

  // 노트 렌더링용: 덱 내 수감자의 전체 에고 목록
  const allSinnerEgos = (egoRes.data ?? []).map(e => ({
    sinner_id: e.sinner_id, name_kr: e.name_kr, grade: e.grade,
    sin_affinity: (e as Record<string, unknown>).sin_affinity as string | null,
    image_url: (e as Record<string, unknown>).image_url as string | null,
  }))

  if (viewerOnly) {
    return NextResponse.json({ deck_code: deckCode, is_owner: isOwner, is_admin: isAdmin, all_sinner_egos: allSinnerEgos, vote_count: deck.vote_count, view_count: deck.view_count })
  }

  const deckEgosWithSkills = deckEgoRows.map(row => ({
    ...row,
    ego: row.ego ? { ...row.ego, ego_skills: egoSkillsByEgoId.get(row.ego.id) ?? [] } : null,
  }))

  return NextResponse.json({ ...deck, deck_egos: deckEgosWithSkills, deck_code: deckCode, is_owner: isOwner, is_admin: isAdmin, all_sinner_egos: allSinnerEgos })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal Server Error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// ── DELETE ──────────────────────────────────────────────────────────────────
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const admin = createAdminClient()
    const resolved = await resolveAuthor(request, admin)
    if ('response' in resolved) return resolved.response
    const { author } = resolved
    const userId = author.kind === 'user' ? author.userId : null

    // 소유권 확인
    const { data: deck } = await admin
      .schema('limbus')
      .from('decks')
      .select('id, user_id')
      .eq('id', id)
      .single()

    if (!deck) {
      return NextResponse.json({ error: '덱을 찾을 수 없습니다.' }, { status: 404 })
    }
    if (!(await ownsPost(admin, author, 'deck', deck))) {
      return NextResponse.json({ error: '삭제 권한이 없습니다.' }, { status: 403 })
    }

    await revalidatePostSeries(admin, 'deck', id)
    // CASCADE로 deck_identities, deck_votes 자동 삭제
    const { error } = await admin
      .schema('limbus')
      .from('decks')
      .delete()
      .eq('id', id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    await writeAuditLog({ actorId: userId, action: 'deck_delete', targetType: 'deck', targetId: id })

    revalidateTag(CACHE_TAGS.deck(id), 'max')
    revalidateTag(CACHE_TAGS.decksList, 'max')
    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal Server Error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// ── PATCH ─────────────────────────────────────────────────────────────────
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { title, description, tags, identitySlots, egoSlots, content_type } = body

    if (!title?.trim()) {
      return NextResponse.json({ error: '제목을 입력해주세요.' }, { status: 400 })
    }

    const admin = createAdminClient()
    const resolved = await resolveAuthor(request, admin)
    if ('response' in resolved) return resolved.response
    const { author } = resolved
    const userId = author.kind === 'user' ? author.userId : null

    // 소유권 확인 (관리자는 소유자가 아니어도 수정 가능, 단 소유자 변경 불가)
    const { data: deck } = await admin
      .schema('limbus')
      .from('decks')
      .select('id, user_id, title, description, tags, main_keywords, content_type, content_edited_at')
      .eq('id', id)
      .single()

    if (!deck) {
      return NextResponse.json({ error: '덱을 찾을 수 없습니다.' }, { status: 404 })
    }
    const isOwner = await ownsPost(admin, author, 'deck', deck)
    const isAdmin = author.kind === 'user' && author.isAdmin
    if (!isOwner && !isAdmin) {
      return NextResponse.json({ error: '수정 권한이 없습니다.' }, { status: 403 })
    }

    const mainKeywordsResult = parseDeckMainKeywordsInput(
      Object.prototype.hasOwnProperty.call(body, 'main_keywords')
        ? body.main_keywords
        : deck.main_keywords
    )
    if ('error' in mainKeywordsResult) {
      return NextResponse.json({ error: mainKeywordsResult.error }, { status: 400 })
    }

    // 롤백용 원본 값 저장
    const originalValues = {
      title: deck.title,
      description: deck.description,
      tags: deck.tags,
      main_keywords: deck.main_keywords,
      content_type: deck.content_type,
      content_edited_at: deck.content_edited_at,
    }

    // 자식 롤백을 위해 기존 children 미리 저장
    const [{ data: origIdents }, { data: origEgos }] = await Promise.all([
      admin.schema('limbus').from('deck_identities').select('*').eq('deck_id', id),
      admin.schema('limbus').from('deck_egos').select('*').eq('deck_id', id),
    ])

    // decks 테이블 UPDATE (소유자는 변경하지 않음)
    const { error: updateError } = await admin
      .schema('limbus')
      .from('decks')
      .update({
        title,
        description,
        tags: tags || [],
        main_keywords: mainKeywordsResult.value,
        content_type: content_type || '없음',
        content_edited_at: new Date().toISOString(),
      })
      .eq('id', id)

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    // deck_identities: 기존 삭제 → 새로 삽입
    const { error: delIdentitiesError } = await admin.schema('limbus').from('deck_identities').delete().eq('deck_id', id)
    if (delIdentitiesError) {
      await admin.schema('limbus').from('decks').update(originalValues).eq('id', id)
      if (origIdents?.length) await admin.schema('limbus').from('deck_identities').insert(origIdents)
      if (origEgos?.length) await admin.schema('limbus').from('deck_egos').insert(origEgos)
      return NextResponse.json({ error: delIdentitiesError.message }, { status: 500 })
    }
    if (identitySlots?.length > 0) {
      const rows = identitySlots.map((slot: { identity_id: string; gacksung: boolean; slot_order: number; s1_count?: number; s2_count?: number; s3_count?: number; uptie?: number }) => ({
        deck_id: id,
        identity_id: slot.identity_id,
        slot_order: slot.slot_order,
        gacksung: normalizeUptie(slot.uptie) >= 3,
        s1_count: slot.s1_count ?? 3,
        s2_count: slot.s2_count ?? 2,
        s3_count: slot.s3_count ?? 1,
        uptie: normalizeUptie(slot.uptie),
      }))
      const { error: insIdentitiesError } = await insertDeckIdentities(next => admin.schema('limbus').from('deck_identities').insert(next), rows)
      if (insIdentitiesError) {
        await admin.schema('limbus').from('decks').update(originalValues).eq('id', id)
        if (origIdents?.length) await admin.schema('limbus').from('deck_identities').insert(origIdents)
        if (origEgos?.length) await admin.schema('limbus').from('deck_egos').insert(origEgos)
        return NextResponse.json({ error: insIdentitiesError.message }, { status: 500 })
      }
    }

    // deck_egos: 기존 삭제 → 새로 삽입
    const { error: delEgosError } = await admin.schema('limbus').from('deck_egos').delete().eq('deck_id', id)
    if (delEgosError) {
      await admin.schema('limbus').from('decks').update(originalValues).eq('id', id)
      if (origIdents?.length) await admin.schema('limbus').from('deck_identities').insert(origIdents)
      if (origEgos?.length) await admin.schema('limbus').from('deck_egos').insert(origEgos)
      return NextResponse.json({ error: delEgosError.message }, { status: 500 })
    }
    if (egoSlots?.length > 0) {
      const rows = egoSlots.map((slot: { ego_id: string; grade: string }) => ({
        deck_id: id,
        ego_id: slot.ego_id,
        grade: slot.grade,
      }))
      const { error: insEgosError } = await admin.schema('limbus').from('deck_egos').insert(rows)
      if (insEgosError) {
        await admin.schema('limbus').from('decks').update(originalValues).eq('id', id)
        if (origIdents?.length) await admin.schema('limbus').from('deck_identities').insert(origIdents)
        if (origEgos?.length) await admin.schema('limbus').from('deck_egos').insert(origEgos)
        return NextResponse.json({ error: insEgosError.message }, { status: 500 })
      }
    }

    const seriesError = await saveSeriesChoice(admin, { kind: 'deck', postId: id, userId: isOwner ? userId : null, body })
    if (seriesError) return seriesError

    await writeAuditLog({
      actorId: userId,
      action: 'deck_update',
      targetType: 'deck',
      targetId: id,
      details: {
        contentType: content_type || '없음',
        tagCount: Array.isArray(tags) ? tags.length : 0,
        mainKeywordCount: mainKeywordsResult.value.length,
        identityCount: Array.isArray(identitySlots) ? identitySlots.length : 0,
        egoCount: Array.isArray(egoSlots) ? egoSlots.length : 0,
        isAdmin: !isOwner && isAdmin,
      },
    })

    revalidateTag(CACHE_TAGS.deck(id), 'max')
    revalidateTag(CACHE_TAGS.decksList, 'max')
    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal Server Error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

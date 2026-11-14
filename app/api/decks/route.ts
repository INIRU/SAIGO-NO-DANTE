
import { notePreviewText } from '@/lib/notes/blocks'
import { authorColumns, authorRateKey, guestPinOf, recordGuestAuthorship, resolveAuthor } from '@/features/account/server'
import { NextRequest, NextResponse, after } from 'next/server'
import { pushForPost } from '@/lib/push/send'
import { revalidatePath, revalidateTag } from 'next/cache'
import { saveSeriesChoice, withPostAuthors } from '@/features/community/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { insertDeckIdentities, normalizeUptie } from '@/features/decks'
import { CACHE_TAGS } from '@/lib/constants/cache-tags'
import { isUuid } from '@/lib/utils/uuid'
import { checkRequestRateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { writeAuditLog } from '@/lib/audit'
import { parseDeckMainKeywordsInput } from '@/lib/decks/keyword-rules'
import {
  DECK_LIST_FILTER_BASE_SELECT,
  DEFAULT_PAGE_SIZE,
  ADVANCED_FILTER_CANDIDATE_LIMIT,
  DECK_LIST_FILTER_SELECT_WITH_SKILL_KEYWORDS,
  DECK_LIST_FILTER_SELECT_LEGACY,
  DECK_LIST_SELECT_WITH_SKILL_KEYWORDS,
  DECK_LIST_SELECT_LEGACY,
  type DeckListRow,
  parseDeckLangFilter,
  parseDeckMutationLang,
  parseAdvancedDeckFilters,
  parsePositiveIntegerParam,
  parseOffsetParam,
  isMissingDeckKeywordColumnError,
  needsDeckFilterIndex,
  deckMatchesAdvancedFilters,
} from '@/features/decks/server'

// Cards show the description as one line: send that line, not the whole note document (up to ~23KB a deck).
function listResponse(request: NextRequest, decks: DeckListRow[]) {
  const body = decks.map(deck => deck.description ? { ...deck, description: notePreviewText(deck.description) } : deck)
  const signedIn = request.cookies.getAll().some(cookie => cookie.name.includes('session-token'))
  return NextResponse.json(body, signedIn ? undefined : { headers: { 'Cache-Control': 'public, max-age=0, s-maxage=30, stale-while-revalidate=120' } })
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    const sort = searchParams.get('sort') || 'latest'
    const identityId = searchParams.get('identity_id')
    const langResult = parseDeckLangFilter(searchParams.get('lang'))
    if ('error' in langResult) {
      return NextResponse.json({ error: langResult.error }, { status: 400 })
    }

    const limitResult = parsePositiveIntegerParam(searchParams.get('limit'), DEFAULT_PAGE_SIZE, 'limit')
    if ('error' in limitResult) {
      return NextResponse.json({ error: limitResult.error }, { status: 400 })
    }

    const offsetResult = parseOffsetParam(searchParams.get('offset'))
    if ('error' in offsetResult) {
      return NextResponse.json({ error: offsetResult.error }, { status: 400 })
    }

    const advancedFiltersResult = parseAdvancedDeckFilters(searchParams)
    if ('error' in advancedFiltersResult) {
      return NextResponse.json({ error: advancedFiltersResult.error }, { status: 400 })
    }

    const { value: lang } = langResult
    const { value: limit } = limitResult
    const { value: offset } = offsetResult
    const { value: advancedFilters, hasAdvancedFilters } = advancedFiltersResult

    let deckIds: string[] | null = null
    if (identityId) {
      if (!isUuid(identityId)) return NextResponse.json({ error: 'identity_id가 올바르지 않습니다.' }, { status: 400 })
      const { data: matches, error: matchesError } = await supabase
        .schema('limbus')
        .from('deck_identities')
        .select('deck_id')
        .eq('identity_id', identityId)

      if (matchesError) {
        console.error('[decks] database error', matchesError)
        return NextResponse.json({ error: '요청을 처리하지 못했습니다. 다시 시도해주세요.' }, { status: 500 })
      }

      if (!matches || matches.length === 0) {
        return listResponse(request, [])
      }

      deckIds = [...new Set(matches.map(m => m.deck_id))]
    }

    const buildQuery = (select: string, rangeStart?: number, rangeEnd?: number) => {
      let query = supabase
        .schema('limbus')
        .from('decks')
        .select(select)

      query = sort === 'popular'
        ? query
          .order('vote_count', { ascending: false })
          .order('created_at', { ascending: false })
          .order('id', { ascending: false })
        : query
          .order('created_at', { ascending: false })
          .order('id', { ascending: false })

      if (deckIds) query = query.in('id', deckIds)
      if (lang !== 'all') query = query.eq('lang', lang)
      return typeof rangeStart === 'number' && typeof rangeEnd === 'number'
        ? query.range(rangeStart, rangeEnd)
        : query
    }

    const rangeStart = hasAdvancedFilters ? 0 : offset
    const rangeEnd = hasAdvancedFilters ? ADVANCED_FILTER_CANDIDATE_LIMIT - 1 : offset + limit - 1
    const needsIndex = hasAdvancedFilters && needsDeckFilterIndex(advancedFilters)
    const candidateSelect = needsIndex
      ? DECK_LIST_FILTER_SELECT_WITH_SKILL_KEYWORDS
      : hasAdvancedFilters
        ? DECK_LIST_FILTER_BASE_SELECT
        : DECK_LIST_SELECT_WITH_SKILL_KEYWORDS
    let { data, error } = await buildQuery(candidateSelect, rangeStart, rangeEnd)
    if (isMissingDeckKeywordColumnError(error)) {
      const legacySelect = needsIndex
        ? DECK_LIST_FILTER_SELECT_LEGACY
        : DECK_LIST_SELECT_LEGACY
      const legacyResult = await buildQuery(legacySelect, rangeStart, rangeEnd)
      data = legacyResult.data
      error = legacyResult.error
    }

    if (error) {
      console.error('[decks] database error', error)
      return NextResponse.json({ error: '요청을 처리하지 못했습니다. 다시 시도해주세요.' }, { status: 500 })
    }

    // Authors are looked up once: for the candidates when the name search needs them, else only for the page that is returned.
    const searchesAuthors = hasAdvancedFilters && advancedFilters.searchTermsLower.length > 0
    const candidates = (data ?? []) as unknown as DeckListRow[]
    const rows = !hasAdvancedFilters || searchesAuthors ? await withPostAuthors(candidates) : candidates
    if (!hasAdvancedFilters) {
      return listResponse(request, rows)
    }

    const pageIds = rows
      .filter(deck => deckMatchesAdvancedFilters(deck, advancedFilters))
      .slice(offset, offset + limit)
      .map(deck => deck.id)

    if (pageIds.length === 0) {
      return listResponse(request, [])
    }

    let fullResult = await buildQuery(DECK_LIST_SELECT_WITH_SKILL_KEYWORDS)
      .in('id', pageIds)
    if (isMissingDeckKeywordColumnError(fullResult.error)) {
      fullResult = await buildQuery(DECK_LIST_SELECT_LEGACY).in('id', pageIds)
    }

    if (fullResult.error) {
      console.error('[decks] database error', fullResult.error)
      return NextResponse.json({ error: '요청을 처리하지 못했습니다. 다시 시도해주세요.' }, { status: 500 })
    }

    const fullData = (fullResult.data ?? []) as unknown as DeckListRow[]
    const authorsById = new Map(rows.map(deck => [deck.id, deck.profiles]))
    const fullRows = searchesAuthors ? fullData.map(deck => ({ ...deck, profiles: authorsById.get(deck.id) ?? deck.profiles })) : await withPostAuthors(fullData)
    const fullRowsById = new Map(fullRows.map(deck => [deck.id, deck]))
    return listResponse(request, pageIds.map(id => fullRowsById.get(id)).filter((deck): deck is DeckListRow => Boolean(deck)))
  } catch (err: unknown) {
    console.error('[decks] unexpected failure', err)
    return NextResponse.json({ error: '요청을 처리하지 못했습니다. 다시 시도해주세요.' }, { status: 500 })
  }
}

/** Undoes a deck whose later writes failed; the answer stays the caller's, a failed undo is only logged (the deck is left half-written). */
async function rollbackDeck(admin: ReturnType<typeof createAdminClient>, deckId: string) {
  const { error } = await admin.schema('limbus').from('decks').delete().eq('id', deckId)
  if (error) console.error('[decks] rollback failed', deckId, error)
}

export async function POST(request: NextRequest) {
  try {
    const admin = createAdminClient()
    const resolved = await resolveAuthor(request, admin)
    if ('response' in resolved) return resolved.response
    const { author } = resolved
    const userId = author.kind === 'user' ? author.userId : null

    const rateLimit = checkRequestRateLimit(request, {
      bucket: 'create',
      scope: author.kind === 'guest' ? 'decks:create:guest' : 'decks:create',
      authenticatedKey: authorRateKey(author),
    })
    if (!rateLimit.allowed) return rateLimitResponse(rateLimit)

    const body = await request.json().catch(() => null)
    if (body === null) return NextResponse.json({ error: '요청 형식이 올바르지 않습니다.' }, { status: 400 })
    const { title, description, tags, identitySlots, egoSlots, content_type } = body
    // A guest's password for the deck; screens from before it existed send none.
    const pin = author.kind === 'guest' ? guestPinOf(body?.pin) : null
    if (pin === false) return NextResponse.json({ error: '비밀번호는 숫자 4~6자리입니다.' }, { status: 400 })
    const mainKeywordsResult = parseDeckMainKeywordsInput(body?.main_keywords)
    if ('error' in mainKeywordsResult) {
      return NextResponse.json({ error: mainKeywordsResult.error }, { status: 400 })
    }
    const lang = parseDeckMutationLang(body?.lang, body?.locale)
    // identitySlots: [{ identity_id, gacksung, slot_order }]
    // egoSlots: [{ ego_id, grade }]

    if (!title?.trim()) {
      return NextResponse.json({ error: '제목을 입력해주세요.' }, { status: 400 })
    }

    const { data: deck, error: deckError } = await admin
      .schema('limbus')
      .from('decks')
      .insert({
        ...authorColumns(author),
        title,
        description,
        tags: tags || [],
        main_keywords: mainKeywordsResult.value,
        content_type: content_type || '없음',
        lang,
      })
      .select()
      .single()

    if (deckError) {
      console.error('[decks] database error', deckError)
      return NextResponse.json({ error: '요청을 처리하지 못했습니다. 다시 시도해주세요.' }, { status: 500 })
    }

    if (identitySlots?.length > 0) {
      const rows = identitySlots.map((slot: { identity_id: string; gacksung: boolean; slot_order: number; s1_count?: number; s2_count?: number; s3_count?: number; uptie?: number }) => ({
        deck_id: deck.id,
        identity_id: slot.identity_id,
        slot_order: slot.slot_order,
        gacksung: normalizeUptie(slot.uptie) >= 3,
        s1_count: slot.s1_count ?? 3,
        s2_count: slot.s2_count ?? 2,
        s3_count: slot.s3_count ?? 1,
        uptie: normalizeUptie(slot.uptie),
      }))
      const { error: identityInsertError } = await insertDeckIdentities<(typeof rows)[number]>(next => admin.schema('limbus').from('deck_identities').insert(next), rows)
      if (identityInsertError) {
        // Rollback: delete the parent deck
        await rollbackDeck(admin, deck.id)
        console.error('[decks] database error', identityInsertError)
        return NextResponse.json({ error: '요청을 처리하지 못했습니다. 다시 시도해주세요.' }, { status: 500 })
      }
    }

    if (egoSlots?.length > 0) {
      const rows = egoSlots.map((slot: { ego_id: string; grade: string }) => ({
        deck_id: deck.id,
        ego_id: slot.ego_id,
        grade: slot.grade,
      }))
      const { error: egoInsertError } = await admin.schema('limbus').from('deck_egos').insert(rows)
      if (egoInsertError) {
        // Rollback: delete the parent deck (cascades to deck_identities)
        await rollbackDeck(admin, deck.id)
        console.error('[decks] database error', egoInsertError)
        return NextResponse.json({ error: '요청을 처리하지 못했습니다. 다시 시도해주세요.' }, { status: 500 })
      }
    }

    // Guests earn no activity points; their key is recorded instead (points follow when the deck moves to an account).
    const { error: activityError } = userId
      ? await admin.schema('limbus').rpc('community_record_deck', { p_deck_id: deck.id, p_user_id: userId })
      : { error: await recordGuestAuthorship(admin, author, 'deck', deck.id, pin) }
    if (activityError) {
      await rollbackDeck(admin, deck.id)
      return NextResponse.json({ error: '덱을 저장하지 못했습니다. 다시 시도해주세요.' }, { status: 500 })
    }

    const seriesError = await saveSeriesChoice(admin, { kind: 'deck', postId: deck.id, userId, body })
    if (seriesError) return seriesError

    await writeAuditLog({
      actorId: userId,
      action: 'deck_create',
      targetType: 'deck',
      targetId: deck.id,
      details: {
        contentType: deck.content_type,
        tagCount: Array.isArray(deck.tags) ? deck.tags.length : 0,
        mainKeywordCount: mainKeywordsResult.value.length,
        identityCount: Array.isArray(identitySlots) ? identitySlots.length : 0,
        egoCount: Array.isArray(egoSlots) ? egoSlots.length : 0,
      },
    })

    // The board pages hold no list (the client loads it), so only the new deck's own page is revalidated here.
    for (const locale of ['ko', 'en', 'ja'] as const) revalidatePath(`/${locale}/decks/${deck.id}`)
    revalidateTag(CACHE_TAGS.deck(deck.id), 'max')
    revalidateTag(CACHE_TAGS.decksList, 'max')
    if (userId) after(() => pushForPost('deck', deck.id))
    return NextResponse.json(deck, { status: 201 })
  } catch (err: unknown) {
    console.error('[decks] unexpected failure', err)
    return NextResponse.json({ error: '요청을 처리하지 못했습니다. 다시 시도해주세요.' }, { status: 500 })
  }
}

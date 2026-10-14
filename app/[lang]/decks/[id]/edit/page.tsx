import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { findOrCreateSupabaseUser } from '@/lib/supabase/findOrCreateUser'
import { fetchDeckBuilderData } from '@/lib/decks/builder-data'
import type { SupportedLang } from '@/lib/i18n/types'
import EditWrapper from './EditWrapper'
import { normalizeUptie } from '@/lib/decks/deck-identity-uptie'

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params
  const t = await getTranslations({ locale: lang, namespace: 'decks.builder.metadata' })
  return { title: t('title'), robots: { index: false, follow: false } }
}

export default async function EditDeckPage({ params }: { params: Promise<{ lang: string; id: string }> }) {
  const { lang: rawLang, id } = await params
  const lang: SupportedLang = rawLang === 'en' || rawLang === 'ja' ? rawLang : 'ko'

  // 인증 확인. 익명 덱은 로그인 없이 열고, 저장할 때 브라우저의 익명 키로 소유를 확인한다.
  const session = await getServerSession(authOptions)

  const admin = createAdminClient()
  const userId = session?.user?.email
    ? await findOrCreateSupabaseUser(admin, session.user.email, session.user.name, session.user.image)
    : null

  const deckSelectWithMainKeywords = `
    id, user_id, title, description, tags, main_keywords, content_type,
    deck_identities(*),
    deck_egos(ego_id, grade)
  `
  const deckSelectLegacy = `
    id, user_id, title, description, tags, content_type,
    deck_identities(*),
    deck_egos(ego_id, grade)
  `
  const loadDeck = async () => {
    const result = await admin
      .schema('limbus')
      .from('decks')
      .select(deckSelectWithMainKeywords)
      .eq('id', id)
      .single()

    if (result.error && result.error.message.includes('main_keywords')) {
      return admin
        .schema('limbus')
        .from('decks')
        .select(deckSelectLegacy)
        .eq('id', id)
        .single()
    }

    return result
  }

  // 덱 데이터 + 게임 데이터 병렬 fetch (게임 데이터는 덱 빌더와 같은 캐시)
  const [deckRes, { sinners, identities, egos, skills, passives, egoGifts }] = await Promise.all([
    loadDeck(),
    fetchDeckBuilderData(lang),
  ])

  const deck = deckRes.data
  if (!deck) {
    redirect(`/decks/${id}`)
  }

  // 소유자 또는 관리자만 수정 가능
  if (!userId && deck.user_id !== null) {
    redirect('/login')
  }
  const isOwner = userId ? deck.user_id === userId : deck.user_id === null
  const isAdmin = session?.user?.isAdmin === true
  if (!isOwner && !isAdmin) {
    redirect(`/decks/${id}`)
  }

  // editMode 데이터 구성
  const identitySlotIds: Record<string, string> = {}
  const gacksungSlots: Record<string, boolean> = {}
  const upties: Record<string, number> = {}
  const slotOrders: Record<string, number> = {}

  const skillDistribution: Record<string, [number, number, number]> = {}

  for (const di of deck.deck_identities) {
    const identity = identities.find(i => i.id === di.identity_id)
    if (!identity) continue
    identitySlotIds[identity.sinner_id] = identity.id
    if (di.gacksung) gacksungSlots[identity.sinner_id] = true
    upties[identity.sinner_id] = normalizeUptie(di.uptie)
    slotOrders[identity.sinner_id] = di.slot_order
    const s1 = di.s1_count ?? 3
    const s2 = di.s2_count ?? 2
    const s3 = di.s3_count ?? 1
    if (s1 !== 3 || s2 !== 2 || s3 !== 1) {
      skillDistribution[identity.sinner_id] = [s1, s2, s3]
    }
  }

  // formationOrder: slot_order !== 99인 것만 순서대로
  const formationOrder = Object.entries(slotOrders)
    .filter(([, order]) => order !== 99)
    .sort(([, a], [, b]) => a - b)
    .map(([sinnerId]) => sinnerId)

  // egoSlotIds: sinnerId → grade → egoId
  const egoSlotIds: Record<string, Record<string, string>> = {}
  for (const de of deck.deck_egos) {
    const ego = egos.find(e => e.id === de.ego_id)
    if (!ego) continue
    if (!egoSlotIds[ego.sinner_id]) egoSlotIds[ego.sinner_id] = {}
    egoSlotIds[ego.sinner_id][de.grade] = ego.id
  }

  return (
    <EditWrapper
      sinners={sinners}
      identities={identities}
      egos={egos}
      skills={skills}
      passives={passives}
      egoGifts={egoGifts}
      editMode={{
        deckId: id,
        title: deck.title ?? '',
        description: deck.description ?? '',
        tags: deck.tags ?? [],
        mainKeywords: Array.isArray((deck as Record<string, unknown>).main_keywords)
          ? ((deck as Record<string, unknown>).main_keywords as string[])
          : [],
        content_type: (deck as Record<string, unknown>).content_type as string ?? '없음',
        identitySlotIds,
        gacksungSlots,
        upties,
        skillDistribution,
        formationOrder,
        egoSlotIds,
      }}
    />
  )
}

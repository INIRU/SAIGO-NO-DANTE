import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { findOrCreateSupabaseUser } from '@/lib/supabase/findOrCreateUser'
import { fetchDeckBuilderData } from '@/features/decks/server'
import type { SupportedLang } from '@/lib/i18n/types'
import EditWrapper from './EditWrapper'
import { buildEditMode } from '@/features/decks'

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params
  const t = await getTranslations({ locale: lang, namespace: 'decks.builder.metadata' })
  return { title: t('title'), robots: { index: false, follow: false } }
}

export default async function EditDeckPage({ params }: { params: Promise<{ lang: string; id: string }> }) {
  const { lang: rawLang, id } = await params
  const lang: SupportedLang = rawLang === 'en' || rawLang === 'ja' ? rawLang : 'ko'

  const admin = createAdminClient()
  // 인증 확인. 익명 덱은 로그인 없이 열고, 저장할 때 브라우저의 익명 키로 소유를 확인한다.
  const checkSignIn = async () => {
    const session = await getServerSession(authOptions)
    const userId = session?.user?.email
      ? await findOrCreateSupabaseUser(admin, session.user.email, session.user.name, session.user.image)
      : null
    return { session, userId }
  }

  const deckSelectWithMainKeywords = `
    id, user_id, title, description, tags, main_keywords, content_type, updated_at,
    deck_identities(*),
    deck_egos(ego_id, grade)
  `
  const deckSelectLegacy = `
    id, user_id, title, description, tags, content_type, updated_at,
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

  // 로그인 확인, 덱, 게임 데이터(덱 빌더와 같은 캐시)를 함께 읽는다: 덱은 사용자 정보가 필요 없다
  const [{ session, userId }, deckRes, { sinners, identities, egos, skills, passives, egoGifts }] = await Promise.all([
    checkSignIn(),
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

  const { identitySlotIds, gacksungSlots, upties, skillDistribution, formationOrder, egoSlotIds } = buildEditMode({
    deckIdentities: deck.deck_identities, deckEgos: deck.deck_egos, identities, egos,
  })

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
        updatedAt: (deck as Record<string, unknown>).updated_at as string | null ?? null,
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

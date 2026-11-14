import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { pageMetadata } from '@/lib/seo/metadata'
import { fetchDeckBuilderData } from '@/features/decks/server'
import { createAdminClient } from '@/lib/supabase/admin'
import DeckBuilderWrapper from './DeckBuilderWrapper'
import { buildEditMode } from '@/features/decks'
import type { SupportedLang } from '@/lib/i18n/types'
import { isNoRow } from '@/lib/supabase/no-row'

export async function generateMetadata({ params }: { params: Promise<{ lang: SupportedLang }> }): Promise<Metadata> {
  const { lang } = await params
  const builderT = await getTranslations({ locale: lang, namespace: 'decks.builder.metadata' })

  // The canonical has no query, so /decks/new?fork=… counts as this page.
  return pageMetadata({ lang, path: '/decks/new', title: builderT('title'), description: builderT('description') })
}

export default async function NewDeckPage({ params, searchParams }: { params: Promise<{ lang: string }>; searchParams: Promise<{ fork?: string }> }) {
  const [{ lang: rawLang }, { fork: forkId }] = await Promise.all([params, searchParams])
  const lang: SupportedLang = rawLang === 'en' || rawLang === 'ja' ? rawLang : 'ko'
  const { sinners, identities, egos, skills, passives, egoGifts } = await fetchDeckBuilderData(lang)

  // 포크 모드: 원본 덱 데이터 로드
  if (forkId) {
    const supabase = createAdminClient()
    const { data: deck, error: deckError } = await supabase
      .schema('limbus')
      .from('decks')
      .select(`
        id, title, description, tags, content_type,
        deck_identities(*),
        deck_egos(ego_id, grade)
      `)
      .eq('id', forkId)
      .single()

    // A deck that is gone (or an id that names none) opens the empty builder; a read that failed is an error page, not a silent empty builder.
    if (deckError && !isNoRow(deckError)) throw deckError
    if (deck) {
      const { identitySlotIds, gacksungSlots, upties, skillDistribution, formationOrder, egoSlotIds } = buildEditMode({
        deckIdentities: deck.deck_identities, deckEgos: deck.deck_egos, identities, egos,
      })

      return (
        <DeckBuilderWrapper
          sinners={sinners}
          identities={identities}
          egos={egos}
          skills={skills}
          passives={passives}
          egoGifts={egoGifts}
          forkMode={{
            forkedFrom: forkId,
            title: deck.title ?? '',
            description: deck.description ?? '',
            tags: deck.tags ?? [],
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
  }

  return <DeckBuilderWrapper sinners={sinners} identities={identities} egos={egos} skills={skills} passives={passives} egoGifts={egoGifts} />
}

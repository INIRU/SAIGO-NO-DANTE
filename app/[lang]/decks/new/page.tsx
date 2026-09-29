import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { fetchDeckBuilderData } from '@/lib/decks/builder-data'
import { createAdminClient } from '@/lib/supabase/admin'
import DeckBuilderWrapper from './DeckBuilderWrapper'
import { normalizeUptie } from '@/lib/decks/deck-identity-uptie'
import type { SupportedLang } from '@/lib/i18n/types'

export async function generateMetadata({ params }: { params: Promise<{ lang: SupportedLang }> }): Promise<Metadata> {
  const { lang } = await params
  const builderT = await getTranslations({ locale: lang, namespace: 'decks.builder.metadata' })

  return {
    title: builderT('title'),
    description: builderT('description'),
  }
}

export default async function NewDeckPage({ params, searchParams }: { params: Promise<{ lang: string }>; searchParams: Promise<{ fork?: string }> }) {
  const [{ lang: rawLang }, { fork: forkId }] = await Promise.all([params, searchParams])
  const lang: SupportedLang = rawLang === 'en' || rawLang === 'ja' ? rawLang : 'ko'
  const { sinners, identities, egos, skills, passives, egoGifts } = await fetchDeckBuilderData(lang)

  // 포크 모드: 원본 덱 데이터 로드
  if (forkId) {
    const supabase = createAdminClient()
    const { data: deck } = await supabase
      .schema('limbus')
      .from('decks')
      .select(`
        id, title, description, tags, content_type,
        deck_identities(*),
        deck_egos(ego_id, grade)
      `)
      .eq('id', forkId)
      .single()

    if (deck) {
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

      const formationOrder = Object.entries(slotOrders)
        .filter(([, order]) => order !== 99)
        .sort(([, a], [, b]) => a - b)
        .map(([sinnerId]) => sinnerId)

      const egoSlotIds: Record<string, Record<string, string>> = {}
      for (const de of deck.deck_egos) {
        const ego = egos.find(e => e.id === de.ego_id)
        if (!ego) continue
        if (!egoSlotIds[ego.sinner_id]) egoSlotIds[ego.sinner_id] = {}
        egoSlotIds[ego.sinner_id][de.grade] = ego.id
      }

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

import { createClient } from '@supabase/supabase-js'
import { renderOgPreview } from '@/components/ui/OgPreview'
import { getIdentityPortraitUrl } from '@/lib/utils/images'
import { OG_SIZE, OG_CONTENT_TYPE, isSupportedLang } from '@/lib/utils/og-image'
export const runtime = 'nodejs'
export const alt = '덱 공유 이미지'
export const size = OG_SIZE
export const contentType = OG_CONTENT_TYPE
export default async function DeckOgImage({ params }: { params: Promise<{ lang: string; id: string }> }) {
  const { lang: rawLang, id } = await params
  const lang = isSupportedLang(rawLang) ? rawLang : 'ko'
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!)
  const { data: deck, error } = await supabase.schema('limbus').from('decks')
    .select('title, deck_identities(slot_order, gacksung, identities(sinner_id, folder_name, game_id))').eq('id', id).maybeSingle()
  const slots = error ? [] : [...(deck?.deck_identities ?? [])].sort((a, b) => a.slot_order - b.slot_order)
  const images = slots.slice(0, 12).map(slot => {
    const identity = Array.isArray(slot.identities) ? slot.identities[0] : slot.identities
    return identity ? getIdentityPortraitUrl(identity.sinner_id, identity.folder_name, identity.game_id, slot.gacksung ?? true) : ''
  })
  return renderOgPreview({ lang, eyebrow: 'DECK BOARD', layout: 'formation', images,
    title: deck?.title ?? (lang === 'ko' ? '덱을 찾을 수 없습니다' : lang === 'ja' ? 'デッキが見つかりません' : 'Deck not found'),
    subtitle: lang === 'ko' ? '덱 편성과 공략을 확인하세요.' : lang === 'ja' ? 'デッキ編成と攻略を確認しましょう。' : 'Explore this deck and its strategy.',
  })
}

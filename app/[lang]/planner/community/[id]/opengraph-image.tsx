import { publicSupabase } from '@/lib/supabase/public'
import { renderOgPreview } from '@/components/ui/OgPreview'
import { resolvePlannerIdentity } from '@/lib/planner/catalog-references'
import { getIdentityPortraitUrl } from '@/lib/utils/images'
import { OG_SIZE, OG_CONTENT_TYPE, isSupportedLang } from '@/lib/utils/og-image'
export const alt = '거울 던전 플랜 공유 이미지'
export const size = OG_SIZE
export const contentType = OG_CONTENT_TYPE
export default async function PlanOgImage({ params }: { params: Promise<{ lang: string; id: string }> }) {
  const { lang: rawLang, id } = await params
  const lang = isSupportedLang(rawLang) ? rawLang : 'ko'
  const supabase = publicSupabase()
  const { data: plan, error } = await supabase.schema('limbus').from('md_plans').select('title, deck').eq('id', id).maybeSingle()
  const slots = !error && Array.isArray(plan?.deck) ? plan.deck.filter(slot => slot && typeof slot === 'object' && !Array.isArray(slot)) as { identity_id?: unknown; sinner_id?: unknown; game_id?: unknown; slot_order?: number; gacksung?: boolean }[] : []
  let images: string[] = []
  if (slots.length) {
    const { data: catalog, error: catalogError } = await supabase.schema('limbus').from('identities').select('id, sinner_id, game_id, folder_name')
    if (!catalogError) images = slots.sort((a, b) => (a.slot_order ?? 99) - (b.slot_order ?? 99)).slice(0, 12).map(slot => {
      const identity = resolvePlannerIdentity(slot, catalog ?? [])
      return identity ? getIdentityPortraitUrl(identity.sinner_id, identity.folder_name, identity.game_id, slot.gacksung !== false) : ''
    })
  }
  return renderOgPreview({ lang, eyebrow: 'MIRROR DUNGEON PLANNER', layout: 'formation', images,
    title: plan?.title ?? (lang === 'ko' ? '플랜을 찾을 수 없습니다' : lang === 'ja' ? 'プランが見つかりません' : 'Plan not found'),
    subtitle: lang === 'ko' ? '층별 계획부터 최종 기프트까지' : lang === 'ja' ? '階層ごとの計画から最終ギフトまで' : 'From floor plans to final gifts',
  })
}

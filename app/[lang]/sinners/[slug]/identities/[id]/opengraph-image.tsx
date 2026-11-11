import { getIdentityById, getSinnerById } from '@/lib/db/queries'
import { getLocalizedName } from '@/lib/i18n/localize'
import { renderOgPreview } from '@/components/ui/OgPreview'
import { SINNER_COLORS } from '@/lib/constants/sinner-colors'
import { getIdentityProfileUrl } from '@/lib/utils/images'
import { OG_SIZE, OG_CONTENT_TYPE, isSupportedLang } from '@/lib/utils/og-image'
export const alt = '인격 공유 이미지'
export const size = OG_SIZE
export const contentType = OG_CONTENT_TYPE
export default async function OgImage({ params }: { params: Promise<{ lang: string; slug: string; id: string }> }) {
  const { lang: rawLang, slug, id } = await params
  const lang = isSupportedLang(rawLang) ? rawLang : 'ko'
  const [sinner, item] = await Promise.all([getSinnerById(slug), getIdentityById(id)])
  const valid = sinner && item && item.sinner_id === slug
  const title = valid ? getLocalizedName(item, lang) : (lang === 'ko' ? '정보를 찾을 수 없습니다' : lang === 'ja' ? '情報が見つかりません' : 'Not found')
  // The full illustration: the uptied one where the identity has it (rarity 1 has only the base art).
  const art = valid ? getIdentityProfileUrl(item, item.rarity > 1) : ''
  return renderOgPreview({ lang, title, accent: SINNER_COLORS[slug],
    label: valid ? getLocalizedName({ name_kr: sinner.name_kr, name_en: sinner.name, name_jp: sinner.name_jp }, lang) : undefined,
    images: art ? [art] : [],
  })
}

import { getEGOById, getSinnerById } from '@/lib/db/queries'
import { getLocalizedName } from '@/lib/i18n/localize'
import { renderOgPreview } from '@/components/ui/OgPreview'
import { OG_SIZE, OG_CONTENT_TYPE, isSupportedLang } from '@/lib/utils/og-image'
export const runtime = 'nodejs'
export const alt = 'E.G.O 공유 이미지'
export const size = OG_SIZE
export const contentType = OG_CONTENT_TYPE
export default async function OgImage({ params }: { params: Promise<{ lang: string; slug: string; egoId: string }> }) {
  const { lang: rawLang, slug, egoId } = await params
  const lang = isSupportedLang(rawLang) ? rawLang : 'ko'
  const [sinner, item] = await Promise.all([getSinnerById(slug), getEGOById(egoId)])
  const valid = sinner && item && item.sinner_id === slug
  const title = valid ? getLocalizedName({ name_kr: item.name_kr ?? item.name, name_en: item.name_en, name_jp: item.name_jp }, lang) : (lang === 'ko' ? '정보를 찾을 수 없습니다' : lang === 'ja' ? '情報が見つかりません' : 'Not found')
  const art = valid ? (item.image_url || item.cor_image_url || '') : ''
  return renderOgPreview({ lang, eyebrow: 'E.G.O ARCHIVE', title,
    subtitle: valid ? getLocalizedName({ name_kr: sinner.name_kr, name_en: sinner.name, name_jp: sinner.name_jp }, lang) : undefined,
    images: art ? [art] : [],
  })
}

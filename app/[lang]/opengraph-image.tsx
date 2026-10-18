import { renderSiteOg } from '@/components/ui/OgPreview'
import { OG_SIZE, OG_CONTENT_TYPE, isSupportedLang } from '@/lib/utils/og-image'
export const alt = 'SAIGO NO DANTE — Limbus Company fan archive'
export const size = OG_SIZE
export const contentType = OG_CONTENT_TYPE
export default async function OgImage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params
  return renderSiteOg(isSupportedLang(lang) ? lang : 'ko')
}

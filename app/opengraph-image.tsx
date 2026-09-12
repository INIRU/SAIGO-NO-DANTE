import { renderSiteOg } from '@/components/ui/OgPreview'
import { OG_SIZE, OG_CONTENT_TYPE } from '@/lib/utils/og-image'
export const runtime = 'nodejs'
export const alt = '최애의 관리자 — Limbus Company 팬 아카이브'
export const size = OG_SIZE
export const contentType = OG_CONTENT_TYPE
export default async function OgImage() { return renderSiteOg('ko') }

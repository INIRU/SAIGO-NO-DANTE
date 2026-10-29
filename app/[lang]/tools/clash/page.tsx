import ClashCalculator from '@/components/tools/ClashCalculator'
import { metaText, pageMetadata } from '@/lib/seo/metadata'
export async function generateMetadata({ params }: { params: Promise<{lang: string}> }) {
  const { lang } = await params
  return pageMetadata({ lang, path: '/tools/clash', title: metaText('clash.meta.title', lang), description: metaText('clash.meta.description', lang) })
}
export default function ClashPage() {
  return <ClashCalculator />
}

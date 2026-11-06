import DamageCalculator from '@/features/tools/components/DamageCalculator'
import { metaText, pageMetadata } from '@/lib/seo/metadata'
export async function generateMetadata({ params }: { params: Promise<{lang: string}> }) {
  const { lang } = await params
  return pageMetadata({ lang, path: '/tools/damage', title: metaText('damage.meta.title', lang), description: metaText('damage.meta.description', lang) })
}
export default function DamagePage() {
  return <DamageCalculator />
}

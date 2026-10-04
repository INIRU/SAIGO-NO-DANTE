import { getTranslations } from 'next-intl/server'
import DamageCalculator from '@/components/tools/DamageCalculator'
import { localeAlternates } from '@/lib/seo/metadata'
export async function generateMetadata({ params }: { params: Promise<{lang: string}> }) {
  const { lang } = await params
  const t = await getTranslations({ locale: lang, namespace: 'damage' })
  return { title: t('title'), description: t('subtitle'), alternates: localeAlternates(lang, '/tools/damage') }
}
export default function DamagePage() {
  return <DamageCalculator />
}

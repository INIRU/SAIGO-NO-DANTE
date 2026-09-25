import { getTranslations } from 'next-intl/server'
import ExperienceCalculator from '@/components/tools/ExperienceCalculator'
import { localeAlternates } from '@/lib/seo/metadata'
export async function generateMetadata({ params }: { params: Promise<{lang: string}> }) {
  const { lang } = await params
  const t = await getTranslations({ locale: lang, namespace: 'experience' })
  return { title: t('title'), description: t('subtitle'), alternates: localeAlternates(lang, '/tools/experience') }
}
export default function ExperiencePage() {
  return <ExperienceCalculator />
}

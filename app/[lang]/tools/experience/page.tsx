import ExperienceCalculator from '@/components/tools/ExperienceCalculator'
import { metaText, pageMetadata } from '@/lib/seo/metadata'
export async function generateMetadata({ params }: { params: Promise<{lang: string}> }) {
  const { lang } = await params
  return pageMetadata({ lang, path: '/tools/experience', title: metaText('experience.meta.title', lang), description: metaText('experience.meta.description', lang) })
}
export default function ExperiencePage() {
  return <ExperienceCalculator />
}

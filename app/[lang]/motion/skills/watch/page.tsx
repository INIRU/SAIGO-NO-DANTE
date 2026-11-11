import { getTranslations } from 'next-intl/server'
import type { Metadata } from 'next'
import { localeUrl, pageMetadata, seoLang } from '@/lib/seo/metadata'
import { loadMotionCatalog } from '@/features/motion/server'
import { findMotionSkill, toMotionParam } from '@/features/motion'
import MotionWatch from '@/features/motion/components/MotionWatch'
import RequestTimeRoute from '@/components/layout/RequestTimeRoute'

const STATE_SEPARATOR = { ko: '·', en: ', ', ja: '・' }

/** The skill an address names (`?skill=`): its own title, description, canonical and picture, for search and link cards. */
export async function generateMetadata({ params, searchParams }: { params: Promise<{ lang: string }>; searchParams?: Promise<{ skill?: string | string[] }> }): Promise<Metadata> {
  const { lang } = await params
  const t = await getTranslations({ locale: lang, namespace: 'motionPage' })
  const list = pageMetadata({ lang, path: '/motion/skills', title: t('metaTitle'), description: t('metaDescription') })
  const { skill: param } = (await searchParams) ?? {}
  if (typeof param !== 'string') return list
  const found = await loadMotionCatalog(seoLang(lang)).then(sinners => findMotionSkill(sinners, param), () => null)
  if (!found) return list
  const { owner, skill } = found
  const names = { sinner: (await getTranslations({ locale: lang, namespace: 'sinner' }))(found.sinnerId), identity: owner.label, skill: skill.title }
  return pageMetadata({
    lang,
    path: `/motion/skills/watch?skill=${toMotionParam(skill.key)}`,
    title: t('skillMetaTitle', names),
    description: t('skillMetaDescription', { ...names, states: skill.states.map(state => state.label).join(STATE_SEPARATOR[seoLang(lang)]) }),
    image: { url: localeUrl(lang, `/og/motion/skills/${toMotionParam(skill.key)}`), width: 1200, height: 630, alt: `${owner.label} — ${skill.title}` },
  })
}

/** Rendered per request: the metadata reads `?skill=` (Next blocks a static route's metadata that reads the address). */
export default function MotionWatchPage() {
  return (
    <>
      <RequestTimeRoute />
      <MotionWatch />
    </>
  )
}

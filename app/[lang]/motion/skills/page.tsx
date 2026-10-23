import { getTranslations } from 'next-intl/server'
import type { Metadata } from 'next'
import { pageMetadata, seoLang } from '@/lib/seo/metadata'
import { loadMotionCatalog } from '@/lib/motion/feed'
import { findMotionSkill, toMotionParam } from '@/lib/motion/catalog'
import SkillMotionViewer from '@/components/motion/SkillMotionViewer'
import RequestTimeRoute from '@/components/layout/RequestTimeRoute'

const STATE_SEPARATOR = { ko: '·', en: ', ', ja: '・' }

/** The list page, or the skill an address names (`?skill=`): its own title, description, canonical and portrait for search. */
export async function generateMetadata({ params, searchParams }: { params: Promise<{ lang: string }>; searchParams?: Promise<{ skill?: string | string[] }> }): Promise<Metadata> {
  const { lang } = await params
  const t = await getTranslations({ locale: lang, namespace: 'motionPage' })
  const list = pageMetadata({ lang, path: '/motion/skills', title: t('metaTitle'), description: t('metaDescription') })
  const { skill: param } = (await searchParams) ?? {}
  if (typeof param !== 'string') return list
  const found = await loadMotionCatalog(seoLang(lang)).then(sinners => findMotionSkill(sinners, param), () => null)
  if (!found) return list
  const { identity, skill } = found
  const names = { sinner: (await getTranslations({ locale: lang, namespace: 'sinner' }))(found.sinnerId), identity: identity.label, skill: skill.title }
  return pageMetadata({
    lang,
    path: `/motion/skills?skill=${toMotionParam(skill.key)}`,
    title: t('skillMetaTitle', names),
    description: t('skillMetaDescription', { ...names, states: skill.states.map(state => state.label).join(STATE_SEPARATOR[seoLang(lang)]) }),
    image: identity.portrait ? { url: identity.portrait, alt: identity.label } : undefined,
  })
}

/**
 * The frame (title, way back, full screen) is the layout's, shared with the loading screen. Rendered per request: the
 * metadata reads `?skill=` (Next blocks a static route's metadata that reads the address).
 */
export default function SkillMotionPage() {
  return (
    <>
      <RequestTimeRoute />
      <SkillMotionViewer />
    </>
  )
}

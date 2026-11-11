import { renderOgPreview } from '@/components/ui/OgPreview'
import { SINNER_SLUGS } from '@/lib/constants/game'
import { SINNER_COLORS } from '@/lib/constants/sinner-colors'
import { getThemePackCompositeImageUrl } from '@/lib/data/theme-pack-visuals'
import { getCachedAnnouncements } from '@/lib/db/announcements'
import { getLatestEGOs, getLatestIdentities, getSinnerById } from '@/lib/db/queries'
import { getLocalizedName } from '@/lib/i18n/localize'
import { OG_SECTIONS, type OgArt } from '@/lib/seo/og-cards'
import { getStoryIndex, getStorySubchapter, pickText, STORY_MAP_BASE, type StoryIndexEntry } from '@/lib/story-map'
import { getIdentityPortraitUrl, getSinnerProfileUrl } from '@/lib/utils/images'
import { isSupportedLang } from '@/lib/utils/og-image'
import { findMotionSkill } from '@/features/motion'
import { loadMotionCatalog } from '@/features/motion/server'

type Lang = 'ko' | 'en' | 'ja'
type Card = Omit<Parameters<typeof renderOgPreview>[0], 'lang'>

const SINNERS: Pick<Card, 'images' | 'layout'> = { layout: 'formation', images: SINNER_SLUGS.map(getSinnerProfileUrl) }

const storyCover = (entry: StoryIndexEntry | undefined) => !entry ? ''
  : entry.coverImg ? `${STORY_MAP_BASE}/cover/${entry.id}.webp`
  : entry.cover ? `${STORY_MAP_BASE}/map/${entry.mapId}/${entry.cover[0]}_${entry.cover[1]}.webp` : ''

async function art(kind: OgArt): Promise<Pick<Card, 'images' | 'layout'>> {
  if (kind === 'identities') {
    const latest = await getLatestIdentities(12)
    return { layout: 'formation', images: latest.map(item => getIdentityPortraitUrl(item.sinner_id, item.folder_name ?? null, item.game_id ?? null, item.rarity > 1)) }
  }
  if (kind === 'ego') return { layout: 'portrait', images: [(await getLatestEGOs(1))[0]?.image_url ?? ''] }
  if (kind === 'themepacks') {
    // Three packs whose art reads at a glance; the extreme ones are a red frame around Korean lettering.
    return { layout: 'posters', images: [1003, 1004, 1006].map(getThemePackCompositeImageUrl) }
  }
  if (kind === 'story') {
    const newest = (await getStoryIndex()).filter(entry => (entry.coverImg || entry.cover) && !entry.hard && entry.sync == null).at(-1)
    return { layout: 'portrait', images: [storyCover(newest)] }
  }
  return SINNERS
}

/** The card of a page path under `/og`, or null where there is none. A picture that cannot be read falls back to the sinners. */
async function resolve(lang: Lang, key: string[]): Promise<Card | null> {
  const path = `/${key.join('/')}`
  const section = OG_SECTIONS[path]
  if (section) return { title: section.title[lang], ...(await art(section.art).catch(() => SINNERS)) }

  const [kind, id, param] = key
  if (kind === 'sinners' && key.length === 2 && SINNER_SLUGS.includes(id)) {
    const sinner = await getSinnerById(id)
    if (!sinner) return null
    return {
      title: getLocalizedName({ name_kr: sinner.name_kr, name_en: sinner.name, name_jp: sinner.name_jp }, lang),
      label: OG_SECTIONS['/sinners'].title[lang], accent: SINNER_COLORS[id], images: [getSinnerProfileUrl(id)],
    }
  }
  if (kind === 'story' && key.length === 2 && /^\d+$/.test(id)) {
    const [sub, index] = await Promise.all([getStorySubchapter(Number(id)), getStoryIndex()])
    if (!sub) return null
    return {
      title: pickText(sub.title, lang),
      label: { ko: `${sub.number}장`, en: `Chapter ${sub.number}`, ja: `${sub.number}章` }[lang],
      images: [storyCover(index.find(entry => entry.id === sub.id))],
    }
  }
  if (kind === 'announcements' && key.length === 2) {
    const item = (await getCachedAnnouncements(lang)).find(entry => entry.id === id)
    if (!item) return null
    // Not the announcement's own cover: it carries its own lettering, which fights the title.
    return { title: item.title, label: OG_SECTIONS['/announcements'].title[lang], ...SINNERS }
  }
  if (kind === 'motion' && id === 'skills' && key.length === 3) {
    const found = findMotionSkill(await loadMotionCatalog(lang), param)
    if (!found) return null
    const { owner, skill, sinnerId } = found
    return { title: skill.title, label: owner.label, accent: SINNER_COLORS[sinnerId], images: [('egoId' in owner ? owner.image : owner.portrait) ?? ''] }
  }
  return null
}

export async function GET(_request: Request, { params }: { params: Promise<{ lang: string; key: string[] }> }) {
  const { lang: rawLang, key } = await params
  const lang = isSupportedLang(rawLang) ? rawLang : 'ko'
  const card = await resolve(lang, key).catch(() => null)
  if (!card) return new Response(null, { status: 404 })
  return renderOgPreview({ lang, ...card })
}

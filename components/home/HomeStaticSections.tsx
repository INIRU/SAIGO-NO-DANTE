import { Suspense } from 'react'
import Image from 'next/image'
import { getTranslations } from 'next-intl/server'
import { ArrowUpRight, ExternalLink, Globe, XIcon } from 'lucide-react'
import { Link } from '@/lib/i18n/navigation'
import { getGameUiAsset } from '@/lib/utils/game-ui'
import type { YoutubeVideo } from '@/lib/utils/youtube'
import type { EGOWithSinner, IdentityWithSinner } from '@/lib/types'
import type { SupportedLang } from '@/lib/i18n/types'
import IdentityFrameCard from '@/components/ui/IdentityFrameCard'
import EgoDisplayCard from '@/components/sinners/EgoDisplayCard'
import FaustPortrait from './FaustPortrait'
import LiteYoutube from '@/components/ui/LiteYoutube'
import Skeleton, { SkeletonLine, SkeletonPage } from '@/components/ui/Skeleton'
import ScrollAnimations from './ScrollAnimations'
import HomeCommunity from './HomeCommunity'
import styles from './HomeStaticSections.module.css'

type TFn = Awaited<ReturnType<typeof getTranslations>>

type Named = { name_kr?: string | null; name_en?: string | null; name_jp?: string | null }
const localName = (row: Named | null | undefined, lang: SupportedLang) =>
  (lang === 'en' ? row?.name_en : lang === 'ja' ? row?.name_jp : null) || row?.name_kr || ''

function YoutubeIcon({ size = 16 }: { size?: number | string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M2.5 17a24.12 24.12 0 0 1 0-10 2 2 0 0 1 1.4-1.4 49.56 49.56 0 0 1 16.2 0A2 2 0 0 1 21.5 7a24.12 24.12 0 0 1 0 10 2 2 0 0 1-1.4 1.4 49.55 49.55 0 0 1-16.2 0A2 2 0 0 1 2.5 17" />
      <path d="m10 15 5-3-5-3z" />
    </svg>
  )
}

function formatDate(d: string) {
  const timestamp = Date.parse(d)
  if (Number.isNaN(timestamp)) return d
  const kst = new Date(timestamp + 9 * 60 * 60 * 1000)
  return `${kst.getUTCFullYear()}.${String(kst.getUTCMonth() + 1).padStart(2, '0')}.${String(kst.getUTCDate()).padStart(2, '0')}`
}

function Heading({ id, title, href, link, external }: { id: string; title: string; href?: string; link?: string; external?: boolean }) {
  return (
    <div className={styles.heading}>
      <h2 id={id}>{title}</h2>
      {href && link && (external
        ? <a className={styles.textLink} href={href} target="_blank" rel="noopener noreferrer">{link} <ArrowUpRight size={16} aria-hidden /></a>
        : <Link className={styles.textLink} href={href}>{link} <ArrowUpRight size={16} aria-hidden /></Link>)}
    </div>
  )
}

// ── 신규 인격·E.G.O ─────────────────────────────────────────────────────────

function NewReleases({ identities, egos, lang, t }: { identities: IdentityWithSinner[]; egos: EGOWithSinner[]; lang: SupportedLang; t: TFn }) {
  if (!identities.length && !egos.length) return null
  return (
    <div className={`${styles.section} ${styles.releases}`} data-home-reveal>
      {identities.length > 0 && (
        <section aria-labelledby="home-identities-heading">
          <Heading id="home-identities-heading" title={t('home.newIdentities')} href="/sinners" link={t('home.viewAllSinners')} />
          <div className={styles.identities}>
            {identities.map(identity => (
              <Link key={identity.id} href={`/sinners/${identity.sinner_id}/identities/${identity.id}`} className={styles.release}>
                <IdentityFrameCard identity={identity} name={localName(identity, lang)} sizes="(max-width: 540px) 30vw, 9rem" />
                <span className={styles.sinnerName}>{localName(identity.sinner, lang)}</span>
              </Link>
            ))}
          </div>
        </section>
      )}
      {egos.length > 0 && (
        <section aria-labelledby="home-egos-heading">
          <Heading id="home-egos-heading" title={t('home.newEgos')} />
          <div className={styles.egos}>
            {egos.map(ego => (
              <div key={ego.id} className={styles.release}>
                <EgoDisplayCard
                  ego={{ grade: ego.grade, max_construe_level: ego.max_construe_level, image_url: ego.image_url, sin_affinity: ego.sin_affinity }}
                  href={`/sinners/${ego.sinner_id}/ego/${ego.id}`}
                  name={localName(ego, lang)}
                  sinnerId={ego.sinner_id}
                  lang={lang}
                />
                <span className={styles.sinnerName}>{localName(ego.sinner, lang)}</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

// ── 도구 ─────────────────────────────────────────────────────────────────────

const TOOLS = [
  { href: '/planner/community', key: 'planner', art: ['start-buffs/starlight'] },
  { href: '/planner/run', key: 'assist', art: [], portrait: true },
  { href: '/decks', key: 'deckBuilder', art: [] },
  { href: '/tools/experience', key: 'experience', art: ['resources/ticket-4'], wide: true },
  { href: '/tools/lunacy', key: 'lunacy', art: ['resources/lunacy-5'] },
  { href: '/random', key: 'random', art: ['shards/yi-sang', 'shards/ishmael', 'shards/heathcliff'] },
] as const

function Tools({ t, identities, lang }: { t: TFn; identities: IdentityWithSinner[]; lang: SupportedLang }) {
  return (
    <section className={styles.section} data-home-reveal aria-labelledby="home-tools-heading">
      <Heading id="home-tools-heading" title={t('home.tools.title')} />
      <div className={styles.tools}>
        {TOOLS.map(tool => (
          <Link key={tool.key} href={tool.href} className={styles.tool}>
            <span className={styles.toolName}>{t(`home.tools.${tool.key}`)}</span>
            {tool.key === 'deckBuilder' ? (
              <span className={`${styles.toolArt} ${styles.fan}`} aria-hidden>
                {identities.slice(0, 3).map(identity => <span key={identity.id} className={styles.fanCard}><IdentityFrameCard identity={identity} name="" sizes="4rem" /></span>)}
              </span>
            ) : 'portrait' in tool ? (
              // Faust, the clever one, for the recognition helper.
              <FaustPortrait className={`${styles.toolArt} ${styles.portrait}`} />
            ) : tool.art.length > 1 ? (
              <span className={`${styles.toolArt} ${styles.fan} ${styles.shardFan}`} aria-hidden>
                {tool.art.map(art => <Image key={art} src={getGameUiAsset(art)} alt="" width={256} height={256} className={styles.fanCard} unoptimized />)}
              </span>
            ) : (
              <Image src={getGameUiAsset(tool.art[0])} alt="" width={256} height={256} className={`${styles.toolArt} ${'wide' in tool ? styles.wideArt : ''}`} unoptimized />
            )}
          </Link>
        ))}
      </div>
    </section>
  )
}

// ── 영상·공식 채널 ───────────────────────────────────────────────────────────

const CHANNELS = [
  { key: 'site', href: 'https://limbuscompany.com', Icon: Globe },
  { key: 'youtube', href: 'https://www.youtube.com/@ProjectMoonOfficial', Icon: YoutubeIcon },
  { key: 'x', href: 'https://x.com/LimbusCompany_B', Icon: XIcon },
] as const

async function Official({ latestVideo, t }: { latestVideo: Promise<YoutubeVideo | null>; t: TFn }) {
  const video = await latestVideo
  const labels = { site: t('home.official.site'), youtube: 'YouTube', x: 'X' }
  const channels = (
    <div className={styles.channels}>
      {CHANNELS.map(({ key, href, Icon }) => (
        <a key={key} href={href} target="_blank" rel="noopener noreferrer" className={styles.channel}>
          <Icon size="1.125rem" /> {labels[key]} <ExternalLink size={14} aria-hidden className={styles.channelArrow} />
        </a>
      ))}
    </div>
  )
  return (
    <section className={styles.section} data-home-reveal aria-labelledby="home-official-heading">
      <Heading id="home-official-heading" title={t(video ? 'home.latestVideo' : 'home.officialChannels')} href={video ? 'https://www.youtube.com/@ProjectMoonOfficial/videos' : undefined} link={t('home.viewChannel')} external />
      {video ? (
        <div className={styles.video}>
          <div className={styles.videoFrame}><LiteYoutube id={video.videoId} title={video.title} label={t('home.watchVideo')} /></div>
          <div className={styles.videoInfo}>
            <h3>{video.title}</h3>
            {video.publishedAt && <time dateTime={video.publishedAt}>{formatDate(video.publishedAt)}</time>}
            {channels}
          </div>
        </div>
      ) : channels}
    </section>
  )
}

function OfficialSkeleton() {
  return (
    <SkeletonPage className={styles.section}>
      <div className={styles.heading}><SkeletonLine w="6rem" h="1.5rem" /></div>
      <div className={styles.video}>
        <Skeleton className={styles.videoFrame} />
        <div className={styles.videoInfo}><SkeletonLine w="80%" h="1.25rem" /><SkeletonLine w="5rem" h="0.875rem" className="mt-3" /></div>
      </div>
    </SkeletonPage>
  )
}

// ── Page body ────────────────────────────────────────────────────────────────

export default async function HomeStaticSections({ lang, latestIdentities, latestEgos, latestVideo }: {
  lang: SupportedLang
  latestIdentities: IdentityWithSinner[]
  latestEgos: EGOWithSinner[]
  latestVideo: Promise<YoutubeVideo | null>
}) {
  const t = await getTranslations()
  return (
    <div className={styles.content} data-home-content>
      <NewReleases identities={latestIdentities} egos={latestEgos} lang={lang} t={t} />
      <HomeCommunity
        plans={{ popular: t('home.popularPlans'), recent: t('home.newPlans'), link: t('home.planBoard') }}
        decks={{ popular: t('home.popularDecks'), recent: t('home.newDecks'), link: t('home.cta.decks') }}
      />
      <Tools t={t} identities={latestIdentities} lang={lang} />
      <Suspense fallback={<OfficialSkeleton />}><Official latestVideo={latestVideo} t={t} /></Suspense>
      <ScrollAnimations belowFold />
    </div>
  )
}

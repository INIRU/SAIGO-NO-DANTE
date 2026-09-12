import React from 'react'
import Image from 'next/image'
import { getGameUiAsset } from '@/lib/utils/game-ui'
import { Link } from '@/lib/i18n/navigation'
import {
  Globe, XIcon, ExternalLink, ArrowUpRight, ChevronRight, Play,
} from 'lucide-react'
import type { IdentityWithSinner } from '@/lib/types'
import type { YoutubeVideo } from '@/app/[lang]/page'
import ScrollAnimations from './ScrollAnimations'
import styles from './HomeStaticSections.module.css'
import { LatestIdentityCard } from './LatestIdentityCard'
import { getTranslations } from 'next-intl/server'

// ── SVG icons (defined here so they work in Server Components) ────────────

function YoutubeIcon({ size = 16, style }: { size?: number | string; style?: React.CSSProperties }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={style}
    >
      <path d="M2.5 17a24.12 24.12 0 0 1 0-10 2 2 0 0 1 1.4-1.4 49.56 49.56 0 0 1 16.2 0A2 2 0 0 1 21.5 7a24.12 24.12 0 0 1 0 10 2 2 0 0 1-1.4 1.4 49.55 49.55 0 0 1-16.2 0A2 2 0 0 1 2.5 17" />
      <path d="m10 15 5-3-5-3z" />
    </svg>
  )
}


// ── Static data ───────────────────────────────────────────────────────────

type TFn = Awaited<ReturnType<typeof getTranslations>>

function getFeatures(t: TFn) {
  return [
    { href: '/sinners',        icon: 'navigation/sinners',       title: t('home.feat.sinnerDb') },
    { href: '/decks',          icon: 'navigation/formation',      title: t('home.feat.deckBoard') },
    { href: '/mirror-dungeon', icon: 'navigation/mirror',  title: t('home.feat.mirrorDungeon') },
    { href: '/collection',     icon: 'navigation/collection',      title: t('home.feat.collection') },
    { href: '/random',         icon: 'navigation/extraction',     title: t('home.feat.random') },
    { href: '/planner',        icon: 'navigation/planner', title: t('home.feat.planner') },
  ]
}

function getOfficialLinks(t: TFn) {
  return [
    { label: t('home.official.site'),   href: 'https://limbuscompany.com',                    Icon: Globe },
    { label: 'Project Moon YouTube', href: 'https://www.youtube.com/@ProjectMoonOfficial', Icon: YoutubeIcon },
    { label: 'Limbus Company X',    href: 'https://x.com/LimbusCompany_B',                Icon: XIcon },
  ]
}

// ── Helpers ───────────────────────────────────────────────────────────────

function formatDate(d: string) {
  const dateOnly = d.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (dateOnly) {
    const [, year, month, day] = dateOnly
    return `${year}.${month}.${day}`
  }
  const timestamp = Date.parse(d)
  if (Number.isNaN(timestamp)) return d
  const kst = new Date(timestamp + 9 * 60 * 60 * 1000)
  return `${kst.getUTCFullYear()}.${String(kst.getUTCMonth() + 1).padStart(2, '0')}.${String(kst.getUTCDate()).padStart(2, '0')}`
}

// ── Props ─────────────────────────────────────────────────────────────────

interface HomeStaticSectionsProps {
  latestIdentities: IdentityWithSinner[]
  latestVideo: YoutubeVideo | null
}

// ── Component ─────────────────────────────────────────────────────────────

export default async function HomeStaticSections({ latestIdentities, latestVideo }: HomeStaticSectionsProps) {
  const t = await getTranslations()
  const features = getFeatures(t)
  const officialLinks = getOfficialLinks(t)
  return (
    <div className={styles.content} data-home-content>
      {latestVideo && (
        <section className={styles.section} data-home-reveal aria-labelledby="home-video-heading">
          <div className={styles.heading}>
            <h2 id="home-video-heading">{t('home.latestVideo')}</h2>
            <a className={styles.textLink} href="https://www.youtube.com/@ProjectMoonOfficial/videos" target="_blank" rel="noopener noreferrer">
              {t('home.viewChannel')} <ArrowUpRight size={16} aria-hidden />
            </a>
          </div>
          <div className={styles.videoPanel}>
            <div className={styles.videoFrame}>
              <iframe
                src={`https://www.youtube.com/embed/${latestVideo.videoId}?rel=0`}
                title={latestVideo.title}
                loading="lazy"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                sandbox="allow-scripts allow-same-origin allow-presentation allow-popups"
              />
            </div>
            <div className={styles.videoInfo}>
              <span className={styles.eyebrow}>PROJECT MOON</span>
              <h3>{latestVideo.title}</h3>
              {latestVideo.publishedAt && <time dateTime={latestVideo.publishedAt}>{formatDate(latestVideo.publishedAt)}</time>}
              <a className={styles.playLink} href={`https://www.youtube.com/watch?v=${latestVideo.videoId}`} target="_blank" rel="noopener noreferrer">
                <Play size={17} aria-hidden /> {t('home.watchVideo')}
              </a>
            </div>
          </div>
        </section>
      )}
      {latestIdentities.length > 0 && (
        <section className={styles.section} data-home-reveal aria-labelledby="home-identities-heading">
          <div className={styles.heading}>
            <h2 id="home-identities-heading">{t('home.latestIdentity')}</h2>
            <Link href="/sinners" className={styles.textLink}>{t('home.viewAllSinners')} <ArrowUpRight size={16} aria-hidden /></Link>
          </div>
          <div className={styles.identities}>
            {latestIdentities.map(identity => <LatestIdentityCard key={identity.id} identity={identity} />)}
          </div>
        </section>
      )}
      <section className={styles.section} data-home-reveal aria-labelledby="home-routes-heading">
        <div className={styles.heading}><h2 id="home-routes-heading">{t('home.archiveShortcuts')}</h2></div>
        <div className={styles.routes}>
          {features.map(feature => (
            <Link key={feature.href} href={feature.href} className={styles.tile}>
              <Image src={getGameUiAsset(feature.icon)} alt="" width={48} height={48} className={styles.gameIcon} unoptimized />
              <span>{feature.title}</span>
              <ChevronRight className={styles.arrow} size={17} aria-hidden />
            </Link>
          ))}
        </div>
      </section>
      <section className={`${styles.section} ${styles.official}`} data-home-reveal aria-labelledby="home-official-heading">
        <div className={styles.heading}><h2 id="home-official-heading">{t('home.officialChannels')}</h2></div>
        <div className={styles.channels}>
          {officialLinks.map(({label, href, Icon}) => (
            <a key={href} href={href} target="_blank" rel="noopener noreferrer" className={styles.tile}>
              <Icon size="1.5rem" /> <span>{label}</span>
              <ExternalLink className={styles.arrow} size={16} aria-hidden />
            </a>
          ))}
        </div>
      </section>
      <ScrollAnimations belowFold />
    </div>
  )
}

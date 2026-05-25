import React from 'react'
import { Link } from '@/lib/i18n/navigation'
import {
  Globe, XIcon, ExternalLink, Sparkles, ChevronRight, Calendar,
} from 'lucide-react'
import type { IdentityWithSinner } from '@/lib/types'
import type { YoutubeVideo } from '@/app/[lang]/page'
import { getSinnerLogoUrl, getIdentityInfoUrl } from '@/lib/utils/images'
import { RARITY_ICON_MAP } from '@/lib/constants/game'
import { OfficialHoverCard } from './HomeHoverCard'
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

function DiscordIcon({ size = 18, style }: { size?: number | string; style?: React.CSSProperties }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      style={style}
      aria-hidden="true"
    >
      <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057c.002.022.015.043.033.055a19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
    </svg>
  )
}

type CommandGlyphKind = 'sinner' | 'deck' | 'mirror' | 'collection' | 'tier' | 'extraction' | 'random' | 'planner'

function CommandGlyph({
  kind,
  size = '1.25rem',
  style,
}: {
  kind: CommandGlyphKind
  size?: string
  style?: React.CSSProperties
}) {
  const common = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    style,
    'aria-hidden': true,
  }

  if (kind === 'sinner') {
    return (
      <svg {...common}>
        <rect x="5" y="3" width="14" height="18" rx="1.5" stroke="currentColor" strokeWidth="1.8" />
        <path d="M9 10.2c0-1.8 1.2-3.2 3-3.2s3 1.4 3 3.2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M8.2 15.3c1-1.4 2.2-2.1 3.8-2.1s2.8.7 3.8 2.1" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M8 18h8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M17 4.5h2.5v3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    )
  }

  if (kind === 'deck') {
    return (
      <svg {...common}>
        <rect x="6" y="5" width="10" height="14" rx="1.5" stroke="currentColor" strokeWidth="1.8" transform="rotate(-8 6 5)" />
        <rect x="9" y="4" width="10" height="14" rx="1.5" stroke="currentColor" strokeWidth="1.8" transform="rotate(8 9 4)" />
        <path d="M8 15l4-4 4 3 3-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="8" cy="15" r="1.2" fill="currentColor" />
        <circle cx="12" cy="11" r="1.2" fill="currentColor" />
        <circle cx="16" cy="14" r="1.2" fill="currentColor" />
      </svg>
    )
  }

  if (kind === 'mirror' || kind === 'planner') {
    return (
      <svg {...common}>
        <path d="M12 2.8l7 4v10.4l-7 4-7-4V6.8l7-4z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
        <path d="M12 7v4.5m0 0l-4 3.5m4-3.5l4 3.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        <circle cx="12" cy="7" r="1.5" fill="currentColor" />
        <circle cx="8" cy="15" r="1.5" fill="currentColor" />
        <circle cx="16" cy="15" r="1.5" fill="currentColor" />
        <path d="M7.5 7.5l3.2 2.3M16.5 7.5l-3.2 2.3" stroke="currentColor" strokeWidth="1.2" opacity="0.7" />
      </svg>
    )
  }

  if (kind === 'collection') {
    return (
      <svg {...common}>
        <rect x="4" y="6" width="13" height="14" rx="1.5" stroke="currentColor" strokeWidth="1.8" />
        <path d="M7 4h11c1.1 0 2 .9 2 2v11" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M7.5 11h6M7.5 15h4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        <path d="M14.5 16.5l2 2 4-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    )
  }

  if (kind === 'tier') {
    return (
      <svg {...common}>
        <path d="M5 19h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        <rect x="6" y="13" width="4" height="6" rx="1" stroke="currentColor" strokeWidth="1.8" />
        <rect x="10" y="9" width="4" height="10" rx="1" stroke="currentColor" strokeWidth="1.8" />
        <rect x="14" y="5" width="4" height="14" rx="1" stroke="currentColor" strokeWidth="1.8" />
        <path d="M12 5.5l.8 1.6 1.8.3-1.3 1.2.3 1.8-1.6-.9-1.6.9.3-1.8-1.3-1.2 1.8-.3.8-1.6z" fill="currentColor" />
      </svg>
    )
  }

  if (kind === 'extraction') {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="5" stroke="currentColor" strokeWidth="1.8" />
        <path d="M12 4V2.5M12 21.5V20M20 12h1.5M2.5 12H4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M6.3 6.3L5.2 5.2M18.8 18.8l-1.1-1.1M17.7 6.3l1.1-1.1M5.2 18.8l1.1-1.1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M9 12c1.8-3.2 4.2-3.2 6 0-1.8 3.2-4.2 3.2-6 0z" fill="currentColor" opacity="0.85" />
        <path d="M15.5 9.5c1.8.4 3 1.3 4.2 2.5-1.2 1.2-2.4 2.1-4.2 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    )
  }

  return (
    <svg {...common}>
      <rect x="7" y="6" width="10" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.8" transform="rotate(8 12 11)" />
      <circle cx="10" cy="9" r="1" fill="currentColor" />
      <circle cx="14" cy="10" r="1" fill="currentColor" />
      <circle cx="12" cy="13" r="1" fill="currentColor" />
      <path d="M6 17.5c2.8 2.7 7.1 3 10.2.8" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M16.2 18.3h-3M16.2 18.3v-3" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  )
}

// ── Static data ───────────────────────────────────────────────────────────

type TFn = Awaited<ReturnType<typeof getTranslations>>

function getFeatures(t: TFn) {
  return [
    { href: '/sinners',        glyph: 'sinner' as const,     tag: 'SINNER DB',       title: t('home.feat.sinnerDb'),       desc: t('home.feat.sinnerDbDesc') },
    { href: '/decks',          glyph: 'deck' as const,       tag: 'DECK BOARD',      title: t('home.feat.deckBoard'),       desc: t('home.feat.deckBoardDesc') },
    { href: '/mirror-dungeon', glyph: 'mirror' as const,     tag: 'MIRROR DUNGEON',  title: t('home.feat.mirrorDungeon'),   desc: t('home.feat.mirrorDungeonDesc') },
    { href: '/collection',     glyph: 'collection' as const, tag: 'COLLECTION',      title: t('home.feat.collection'),      desc: t('home.feat.collectionDesc') },
    { href: '/tier-list',      glyph: 'tier' as const,       tag: 'TIER LIST',       title: t('home.feat.tierList'),        desc: t('home.feat.tierListDesc') },
    { href: '/extraction',     glyph: 'extraction' as const, tag: 'EXTRACTION SIM',  title: t('home.feat.extraction'),      desc: t('home.feat.extractionDesc') },
    { href: '/random',         glyph: 'random' as const,     tag: 'RANDOM COMP',     title: t('home.feat.random'),          desc: t('home.feat.randomDesc') },
    { href: '/planner',        glyph: 'planner' as const,    tag: 'DUNGEON PLANNER', title: t('home.feat.planner'),         desc: t('home.feat.plannerDesc') },
  ]
}

function getOfficialLinks(t: TFn) {
  return [
    { label: t('home.official.site'),    sub: 'limbuscompany.com',   href: 'https://limbuscompany.com',                    Icon: Globe,        color: '#4898b0', isInternal: false },
    { label: 'YouTube',                   sub: t('home.official.youtubeSub'), href: 'https://www.youtube.com/@ProjectMoonOfficial', Icon: YoutubeIcon,  color: '#c83030', isInternal: false },
    { label: 'Twitter / X',               sub: '@LimbusCompany_B',    href: 'https://x.com/LimbusCompany_B',                Icon: XIcon,        color: '#3870b0', isInternal: false },
    { label: t('home.official.discord'),  sub: t('home.official.discordSub'), href: '/bot', Icon: DiscordIcon, color: '#5865f2', isInternal: true  },
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
  const latestDate = latestIdentities[0]?.release_date
  const features = getFeatures(t)
  const priorityFeatures = [features[0], features[2]].filter(Boolean)
  const utilityFeatures = features.filter(feature => !priorityFeatures.includes(feature))
  const officialLinks = getOfficialLinks(t)
  const routeAccents = ['var(--gold)', '#8a6010', '#5a4a35']

  return (
    <div style={{ background: 'var(--bg-deep)' }}>

      {/* ── 최신 유튜브 영상 ─────────────────────────────────────── */}
      {latestVideo && (
        <section
          className="home-archive-module video-archive-section relative mx-auto max-w-7xl px-5 py-16 sm:px-6 md:py-24"
          style={{ isolation: 'isolate' }}
        >
          <div className="relative border-y border-[rgba(200,144,10,0.24)]">
            <div className="grid min-h-[3rem] gap-3 border-b border-[rgba(200,144,10,0.18)] px-4 py-3 md:grid-cols-[1fr_auto] md:items-center md:px-5">
              <div className="flex min-w-0 items-center gap-2.5">
                <YoutubeIcon size="0.8125rem" style={{ color: '#c83030' }} />
                <span className="font-mono text-[0.625rem] uppercase text-[rgba(200,48,48,0.82)]">
                  ARCHIVE-01 / BROADCAST
                </span>
                <span className="hidden h-px w-10 bg-[rgba(200,144,10,0.32)] md:block" aria-hidden="true" />
                <span className="hidden truncate font-compact-serif-label text-[0.9375rem] text-[rgba(232,176,48,0.78)] md:block">
                  {t('home.latestVideo')}
                </span>
              </div>
              <a
                href="https://www.youtube.com/@ProjectMoonOfficial/videos"
                target="_blank"
                rel="noopener noreferrer"
                className="group flex min-h-[2.75rem] items-center justify-between gap-3 border border-[rgba(200,48,48,0.3)] bg-[rgba(200,48,48,0.07)] px-3 py-2 font-compact-serif-label text-[0.9375rem] text-[rgba(232,176,48,0.82)] transition-[background-color,border-color,color,transform] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-[0.0625rem] hover:border-[rgba(200,48,48,0.62)] hover:bg-[rgba(200,48,48,0.14)] hover:text-[var(--gold-light)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(200,48,48,0.5)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-deep)] active:translate-y-0 md:min-w-[11rem]"
              >
                <span>{t('home.viewChannel')}</span>
                <ChevronRight size="0.875rem" className="transition-transform duration-300 group-hover:translate-x-1" />
              </a>
            </div>

            <div className="grid gap-0 md:grid-cols-[minmax(0,1fr)_21rem]">
              <div className="video-archive-frame relative p-2 md:p-3">
                <div className="relative overflow-hidden border border-[rgba(200,144,10,0.22)] shadow-[0_1rem_3rem_rgba(0,0,0,0.45)]" style={{ aspectRatio: '16/9' }}>
                  <iframe
                    src={`https://www.youtube.com/embed/${latestVideo.videoId}?rel=0&modestbranding=1`}
                    title={latestVideo.title}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    sandbox="allow-scripts allow-same-origin allow-presentation allow-popups"
                    className="absolute inset-0 h-full w-full border-0"
                  />
                </div>
              </div>

              <div className="grid min-w-0 border-t border-[rgba(200,144,10,0.18)] md:border-l md:border-t-0">
                <div className="min-w-0 px-4 py-4 md:px-5 md:py-5">
                  <h2 className="font-serif text-[1.625rem] font-medium leading-tight md:text-[2rem]" style={{ color: 'var(--gold-light)' }}>
                    {t('home.latestVideo')}
                  </h2>
                  <a
                    href={`https://www.youtube.com/watch?v=${latestVideo.videoId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-4 block min-w-0 font-compact-serif-label text-[1rem] leading-snug text-[rgba(232,176,48,0.82)] transition-colors duration-300 hover:text-[var(--gold-light)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(232,176,48,0.5)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-deep)]"
                  >
                    {latestVideo.title}
                  </a>
                </div>

                <div className="grid border-t border-[rgba(200,144,10,0.14)] sm:grid-cols-2 md:grid-cols-1">
                  <div className="px-4 py-3 md:px-5">
                    <div className="font-mono text-[0.625rem] text-[var(--text-muted)]">CHANNEL</div>
                    <div className="mt-1 font-compact-serif-label text-[0.9375rem] text-[var(--text-secondary)]">Project Moon</div>
                  </div>
                  {latestVideo.publishedAt && (
                    <div className="border-t border-[rgba(200,144,10,0.14)] px-4 py-3 sm:border-l sm:border-t-0 md:border-l-0 md:border-t md:px-5">
                      <div className="font-mono text-[0.625rem] text-[var(--text-muted)]">PUBLISHED</div>
                      <div className="mt-1 flex items-center gap-1.5 font-mono text-[0.875rem] text-[rgba(232,176,48,0.72)]">
                        <Calendar size="0.6875rem" />
                        {formatDate(latestVideo.publishedAt.slice(0, 10))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ── 최신 인격 ──────────────────────────────────────────── */}
      {latestIdentities.length > 0 && (
        <section
          className="latest-section home-archive-module relative mx-auto max-w-7xl px-5 py-16 sm:px-6 md:py-24"
          style={{ isolation: 'isolate' }}
        >
          <div
            className="absolute inset-0 pointer-events-none"
            style={{ background: 'radial-gradient(ellipse 60% 50% at 50% 50%, rgba(200,144,10,0.04) 0%, transparent 70%)', zIndex: 0 }}
          />

          <div className="relative border-y border-[rgba(200,144,10,0.22)] py-5 md:p-6" style={{ zIndex: 1 }}>
            <div className="latest-header grid gap-5 border-b border-[rgba(200,144,10,0.16)] pb-5 md:grid-cols-[1fr_auto]" suppressHydrationWarning>
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles size="0.75rem" style={{ color: 'var(--gold)' }} />
                  <span className="font-mono text-[0.625rem] text-[var(--gold-dim)]">ARCHIVE-02 / ROSTER UPDATE</span>
                </div>
                <h2 className="font-serif text-[1.875rem] font-medium leading-tight md:text-[2.25rem]" style={{ color: 'var(--gold-light)' }}>{t('home.latestIdentity')}</h2>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 md:min-w-[17rem] md:grid-cols-1">
                {latestDate && (
                  <div className="flex items-center justify-between gap-4 border border-[rgba(200,144,10,0.18)] bg-[rgba(26,21,16,0.48)] px-3 py-2.5">
                    <span className="font-mono text-[0.625rem] text-[var(--text-muted)]">ISSUED</span>
                    <span className="flex items-center gap-1.5 font-mono text-[0.875rem] text-[rgba(232,176,48,0.76)]">
                      <Calendar size="0.6875rem" />
                      {formatDate(latestDate)}
                    </span>
                  </div>
                )}
                <Link
                  href="/sinners"
                  className="group flex min-h-[2.75rem] items-center justify-between border border-[rgba(200,144,10,0.34)] bg-[rgba(200,144,10,0.08)] px-3 py-2.5 font-compact-serif-label text-[0.9375rem] text-[rgba(232,176,48,0.82)] transition-[background-color,border-color,color,transform] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-[0.0625rem] hover:border-[rgba(232,176,48,0.58)] hover:bg-[rgba(200,144,10,0.14)] hover:text-[var(--gold-light)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(232,176,48,0.5)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-deep)] active:translate-y-0"
                >
                  {t('home.viewAllSinners')}
                  <ChevronRight size="0.875rem" className="transition-transform duration-300 group-hover:translate-x-1" />
                </Link>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-[1fr_1fr_1fr] md:grid-cols-4 md:gap-4 lg:grid-cols-6">
              {latestIdentities.map((identity) => {
                const portraitUrl   = getIdentityInfoUrl(identity)
                const logoUrl       = getSinnerLogoUrl(identity.sinner_id)
                const rarityIconSrc = RARITY_ICON_MAP[identity.rarity]
                return (
                  <LatestIdentityCard
                    key={identity.id}
                    identity={identity}
                    portraitUrl={portraitUrl}
                    logoUrl={logoUrl}
                    rarityIconSrc={rarityIconSrc ?? null}
                  />
                )
              })}
            </div>
          </div>
        </section>
      )}

      {/* ── 기능 소개 ─────────────────────────────────────────── */}
      <section className="features-section home-archive-module mx-auto max-w-7xl px-5 py-16 sm:px-6 md:py-24">
        <div className="mb-6 grid gap-3 md:grid-cols-[0.42fr_1fr] md:items-end">
          <div>
              <span aria-hidden="true" className="font-mono text-[0.75rem] text-[#5a4a35]">
              ARCHIVE-03 / ROUTE MAP
            </span>
            <h2 className="mt-2 font-serif text-[1.875rem] font-medium leading-tight text-[var(--gold-light)] md:text-[2.25rem]">
              COMMAND MAP
            </h2>
          </div>
          <div className="hidden h-[0.0625rem] bg-[linear-gradient(90deg,rgba(200,144,10,0.35),transparent)] md:block" />
        </div>

        <div className="grid gap-4 lg:grid-cols-[1.08fr_0.92fr]">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-1">
            {priorityFeatures.map((feature, index) => {
              const accent = routeAccents[index] ?? 'var(--gold)'
              return (
              <Link
                key={feature.href}
                href={feature.href}
                className="feature-card group block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(232,176,48,0.55)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-deep)]"
                suppressHydrationWarning
              >
                <div
                  className="relative h-full overflow-hidden border border-[var(--border)] bg-[linear-gradient(135deg,rgba(26,21,16,0.86),rgba(18,14,8,0.78))] p-5 transition-[background-color,border-color,box-shadow,transform] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:-translate-y-[0.125rem] group-hover:border-[rgba(232,176,48,0.48)] group-hover:bg-[rgba(26,21,16,0.94)] group-hover:shadow-[0_1rem_2.5rem_rgba(0,0,0,0.35),inset_0.1875rem_0_0_rgba(200,144,10,0.8)]"
                  style={{
                    minHeight: index === 0 ? '12rem' : '10.75rem',
                  }}
                >
                  <span className="pointer-events-none absolute inset-x-0 top-0 h-[0.0625rem] scale-x-0 bg-[rgba(232,176,48,0.72)] transition-transform duration-300 group-hover:scale-x-100" aria-hidden="true" />
                  <div className="flex h-full flex-col justify-between gap-8">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="mb-2 font-mono text-[0.75rem]" style={{ color: accent, opacity: 0.72 }}>
                          {feature.tag}
                        </div>
                        <div className="font-compact-serif-label text-2xl leading-tight text-[var(--gold-light)]">
                          {feature.title}
                        </div>
                      </div>
                      <div
                        className="grid h-[2.75rem] w-[2.75rem] shrink-0 place-items-center border transition-[border-color,background-color,transform,color] duration-300 group-hover:translate-x-[0.125rem] group-hover:-translate-y-[0.125rem] group-hover:border-[rgba(232,176,48,0.58)] group-hover:bg-[rgba(200,144,10,0.16)]"
                        style={{ background: 'rgba(200,144,10,0.08)', borderColor: 'rgba(200,144,10,0.28)' }}
                      >
                        <CommandGlyph kind={feature.glyph} size="1.25rem" style={{ color: accent, opacity: 0.86 }} />
                      </div>
                    </div>
                    <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
                      <p className="max-w-[34rem] text-sm leading-relaxed text-[var(--text-tertiary)]">
                        {feature.desc}
                      </p>
                      <ChevronRight
                        aria-hidden="true"
                        size="1rem"
                        className="text-[#5a4a35] transition-[color,transform] duration-300 group-hover:translate-x-1 group-hover:text-[var(--gold)]"
                      />
                    </div>
                  </div>
                </div>
              </Link>
              )
            })}
          </div>

          <div className="feature-route-list border-y border-[rgba(200,144,10,0.2)]">
            {utilityFeatures.map((feature, index) => {
              const accent = routeAccents[(index + 1) % routeAccents.length] ?? '#5a4a35'
              return (
              <Link
                key={feature.href}
                href={feature.href}
                className="feature-card group block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(232,176,48,0.55)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-deep)]"
                suppressHydrationWarning
              >
              <div
                className="relative overflow-hidden transition-[background-color,box-shadow,transform] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:-translate-y-[0.0625rem] group-hover:bg-[rgba(36,29,21,0.72)] group-hover:shadow-[inset_0.1875rem_0_0_rgba(200,144,10,0.72)]"
                style={{
                  background: index % 2 === 0 ? 'rgba(26,21,16,0.34)' : 'rgba(13,11,8,0.22)',
                  border: '0',
                  borderBottom: index === utilityFeatures.length - 1 ? '0' : '1px solid rgba(200,144,10,0.13)',
                  padding: '1rem',
                }}
              >
                <span className="pointer-events-none absolute inset-y-3 left-0 w-[0.0625rem] scale-y-0 bg-[rgba(232,176,48,0.7)] transition-transform duration-300 group-hover:scale-y-100" aria-hidden="true" />
                <div className="grid grid-cols-[2.25rem_1fr_auto] items-center gap-3">
                  <div
                    className="grid h-[2.25rem] w-[2.25rem] place-items-center border transition-[border-color,background-color,transform] duration-300 group-hover:scale-[1.04] group-hover:border-[rgba(232,176,48,0.48)] group-hover:bg-[rgba(200,144,10,0.13)]"
                    style={{ background: 'rgba(200,144,10,0.06)', borderColor: 'rgba(200,144,10,0.18)' }}
                  >
                    <CommandGlyph kind={feature.glyph} size="1rem" style={{ color: accent, opacity: 0.78 }} />
                  </div>
                  <div className="min-w-0">
                    <div className="font-mono text-[0.75rem]" style={{ color: accent, opacity: 0.58 }}>
                      {feature.tag}
                    </div>
                    <div className="mt-1 truncate font-compact-serif-label text-base text-[var(--gold)]">
                      {feature.title}
                    </div>
                    <div className="mt-1 line-clamp-2 text-[0.875rem] leading-relaxed text-[var(--text-tertiary)]">
                      {feature.desc}
                    </div>
                  </div>
                  <ChevronRight
                    aria-hidden="true"
                    size="0.875rem"
                    className="text-[#5a4a35] transition-[color,transform] duration-300 group-hover:translate-x-1 group-hover:text-[var(--gold)]"
                  />
                </div>
              </div>
            </Link>
              )
            })}
          </div>
        </div>
      </section>

      {/* ── 공식 채널 ──────────────────────────────────────────── */}
      <section className="official-section home-archive-module mx-auto max-w-7xl px-5 pb-16 sm:px-6 md:pb-24">
        <div className="grid gap-5 border-y border-[rgba(200,144,10,0.22)] py-5 md:grid-cols-[0.36fr_1fr] md:items-stretch md:p-6">
          <div className="flex flex-col justify-between gap-4">
            <div>
              <span aria-hidden="true" className="font-mono text-[0.625rem] text-[#5a4a35]">ARCHIVE-04 / SIGNAL</span>
              <h2 className="mt-2 font-serif text-2xl font-medium leading-tight text-[var(--gold-light)]">
                SAIGO NO DANTE
              </h2>
            </div>
            <span aria-hidden="true" className="font-mono text-[0.75rem] text-[var(--text-muted)] opacity-50">
              {t('home.fanArchiveFooter')}
            </span>
          </div>

          <div className="grid gap-0 border-y border-[rgba(200,144,10,0.16)] md:border-y-0 md:border-l">
          {officialLinks.map(({ label, sub, href, Icon, color, isInternal }) => {
            const signalColor = isInternal ? 'var(--gold)' : color
            const inner = (
              <OfficialHoverCard
                color={signalColor}
                className="official-link-card group"
                style={{
                  background: 'transparent',
                  border: '0',
                  borderBottom: '1px solid rgba(200,144,10,0.13)',
                  padding: '0.875rem 0',
                  position: 'relative',
                  transition: 'background 0.3s, border-color 0.3s, box-shadow 0.3s',
                }}
              >
                <div className="grid grid-cols-[2.5rem_1fr_auto] items-center gap-3 px-3 md:px-4">
                  <div
                    className="grid h-[2.5rem] w-[2.5rem] place-items-center border"
                    style={{ background: isInternal ? 'rgba(200,144,10,0.1)' : `${color}14`, borderColor: isInternal ? 'rgba(200,144,10,0.32)' : `${color}34` }}
                  >
                    <Icon size="1rem" style={{ color: signalColor }} />
                  </div>
                  <div className="min-w-0">
                    <div className="font-compact-serif-label text-[0.9375rem] text-[var(--gold-light)]">{label}</div>
                    <div className="mt-1 truncate font-mono text-[0.875rem] text-[var(--text-muted)]">{sub}</div>
                  </div>
                  <ExternalLink
                    aria-hidden="true"
                    size="0.75rem"
                    className="text-[#5a4a35] transition-transform duration-300 group-hover:translate-x-[0.125rem] group-hover:-translate-y-[0.125rem]"
                  />
                </div>
              </OfficialHoverCard>
            )

            return (
              <div key={href} suppressHydrationWarning>
                {isInternal ? (
                  <Link href={href}>{inner}</Link>
                ) : (
                  <a href={href} target="_blank" rel="noopener noreferrer">{inner}</a>
                )}
              </div>
            )
          })}
          </div>
        </div>
      </section>

    </div>
  )
}

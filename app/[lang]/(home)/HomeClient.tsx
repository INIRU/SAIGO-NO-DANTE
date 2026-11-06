'use client'

import { useRef, useState, useCallback, useMemo } from 'react'
import { Link } from '@/lib/i18n/navigation'
import Image from 'next/image'
import dynamic from 'next/dynamic'

import { useTranslations, useLocale } from 'next-intl'
import { useRoutePrefetch } from '@/lib/hooks/useRoutePrefetch'
import type { SupportedLang } from '@/lib/i18n/types'
import HeroWordmark from '@/components/home/HeroWordmark'
import LimpiLink from '@/app/[lang]/(home)/_components/LimpiLink'
import DiscordSupportLink from '@/app/[lang]/(home)/_components/DiscordSupportLink'
import DanteLogo from '@/components/brand/DanteLogo'
import { SinnerRosterIcon, DeckBoardIcon, MirrorDungeonIcon } from '@/components/brand/icons'
import AnnouncementBanner from '@/app/[lang]/(home)/_components/AnnouncementBanner'
import type { AnnouncementPreview } from '@/lib/announcements'
import ScrollAnimations from '@/app/[lang]/(home)/_components/ScrollAnimations'
import {
  type IdentityWithSinner,
  getSinnerLogoUrl,
  RARITY_ICON_MAP,
} from '@/lib/data/sinners'

// Split into its own chunk but server-rendered: the first slide's preloaded artwork (the page's largest image) is in the
// HTML instead of waiting for this chunk and hydration. The slider touches the browser only inside effects.
const HeroGlitchSlider = dynamic(() => import('@/app/[lang]/(home)/_components/HeroGlitchSlider'))

const ACTION_BASE =
  'flex min-h-[3rem] min-w-0 items-center gap-2.5 rounded-md px-4 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gold-light)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-deep)]'

function CommandUtilityLink({
  href,
  children,
  icon,
}: {
  href: string
  children: React.ReactNode
  icon: React.ReactNode
}) {
  return (
    <Link
      href={href}
      className="group frame frame-strong frame-glow press -m-[0.414rem] flex min-h-[3.83rem] min-w-0 items-center gap-2.5 px-2 text-[0.875rem] font-medium text-[var(--text-primary)] [--frame-w:1rem]"
    >
      <span className="shrink-0 text-[var(--gold)] transition-colors duration-200 group-hover:text-[var(--gold-light)]">{icon}</span>
      <span className="truncate">{children}</span>
    </Link>
  )
}

// ── Rarity icon (small helper, no own file needed) ─────────────────────────

function RarityIcon({ rarity }: { rarity: number }) {
  const t = useTranslations('browser')
  const src = RARITY_ICON_MAP[rarity]
  if (!src) return null
  return (
    <Image
      src={src}
      alt={t('rarityStar', { n: rarity })}
      width={48}
      height={16}
      loading="eager"
      unoptimized
      style={{ objectFit: 'contain', height: '0.75rem', width: 'auto' }}
    />
  )
}

// ── Props ──────────────────────────────────────────────────────────────────

interface HomeClientProps {
  latestIdentities: IdentityWithSinner[]
  pinnedAnnouncement?: AnnouncementPreview | null
}

export default function HomeClient({ latestIdentities, pinnedAnnouncement }: HomeClientProps) {
  const t = useTranslations()
  const locale = useLocale()
  const lang = locale as SupportedLang
  useRoutePrefetch([`/${lang}/decks`, `/${lang}/mirror-dungeon`, `/${lang}/sinners`, `/${lang}/planner/community`, `/${lang}/keywords`])

  const getName = (kr?: string | null, en?: string | null, jp?: string | null): string => {
    if (lang === 'en') return en ?? kr ?? ''
    if (lang === 'ja') return jp ?? kr ?? ''
    return kr ?? ''
  }

  const sectionRef = useRef<HTMLDivElement>(null)
  const [selectedIdentity, setSelectedIdentity] = useState<IdentityWithSinner | null>(
    latestIdentities[0] ?? null
  )


  // 최신 출시일과 동일한 인격만 히어로 슬라이더에 사용
  const latestDate = latestIdentities[0]?.release_date
  const sliderIdentities = useMemo(
    () =>
      latestDate
        ? latestIdentities.filter(id => id.release_date === latestDate)
        : latestIdentities.slice(0, 1),
    [latestIdentities, latestDate]
  )

  const handleSlideChange = useCallback((identity: IdentityWithSinner) => {
    setSelectedIdentity(identity)
  }, [])


  return (
    <>
      {/* Scroll animations — targets server-rendered class names */}
      <ScrollAnimations />
      <style>{`
        @keyframes homeHeroSurfaceReveal {
          from { opacity: 0; transform: translateX(-1.125rem); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes homeHeroRiseReveal {
          from { opacity: 0; transform: translateY(0.875rem); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes homeHeroLogoReveal {
          from { opacity: 0; transform: translateY(0.75rem) scale(0.94); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        .home-command-surface {
          animation: homeHeroSurfaceReveal 0.45s cubic-bezier(0.22, 1, 0.36, 1) 0.02s both;
        }
        .home-logo-mark {
          animation: homeHeroLogoReveal 0.4s cubic-bezier(0.22, 1, 0.36, 1) 0.06s both;
        }
        .home-brand-title {
          animation: homeHeroRiseReveal 0.45s cubic-bezier(0.22, 1, 0.36, 1) 0.1s both;
        }
        .home-subtitle {
          animation: homeHeroRiseReveal 0.4s cubic-bezier(0.22, 1, 0.36, 1) 0.14s both;
        }
        .home-meta-strip {
          animation: homeHeroRiseReveal 0.36s cubic-bezier(0.22, 1, 0.36, 1) 0.18s both;
        }
        .home-command-actions {
          animation: homeHeroRiseReveal 0.36s cubic-bezier(0.22, 1, 0.36, 1) 0.22s both;
        }
        @media (prefers-reduced-motion: reduce) {
          .home-command-surface,
          .home-logo-mark,
          .home-brand-title,
          .home-subtitle,
          .home-meta-strip,
          .home-command-actions {
            animation: none !important;
            opacity: 1 !important;
            transform: none !important;
          }
        }
      `}</style>

      <div className="home-first-viewport flex min-h-svh flex-col">
      {/* ── 히어로 ─────────────────────────────────────────────── */}
      <section
        ref={sectionRef}
        className="home-hero relative flex flex-1 overflow-hidden"
        style={{ background: 'var(--bg-deep)' }}
      >
        {/* 글리치 슬라이더 (최신 인격 풀 일러스트) */}
        {sliderIdentities.length > 0 && (
          <HeroGlitchSlider identities={sliderIdentities} onSlideChange={handleSlideChange} />
        )}

        {/* 이미지 없을 때 대체 배경 */}
        {sliderIdentities.length === 0 && (
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: [
                'linear-gradient(90deg, rgba(200,144,10,0.12), transparent 18%)',
                'repeating-linear-gradient(90deg, rgba(232,176,48,0.05) 0 0.0625rem, transparent 0.0625rem 6rem)',
              ].join(', '),
            }}
          />
        )}

        <div
          className="pointer-events-none absolute inset-0 z-[1] hidden md:block"
          style={{
            background: [
              'linear-gradient(90deg, var(--bg-deep) 0%, var(--bg-deep) 23%, rgba(13,11,8,0.92) 34%, rgba(13,11,8,0.5) 49%, rgba(13,11,8,0.12) 66%, transparent 82%)',
              'linear-gradient(180deg, rgba(13,11,8,0.18) 0%, transparent 32%, rgba(13,11,8,0.68) 100%)',
            ].join(', '),
          }}
        />
        <div
          className="pointer-events-none absolute inset-0 z-[1] md:hidden"
          style={{
            background: [
              'linear-gradient(180deg, rgba(13,11,8,0.04) 0%, rgba(13,11,8,0.08) 38%, rgba(13,11,8,0.72) 78%, rgba(13,11,8,0.9) 100%)',
              'linear-gradient(90deg, rgba(13,11,8,0.32) 0%, rgba(13,11,8,0.08) 48%, transparent 100%)',
            ].join(', '),
          }}
        />
        {/* 수감자 아이콘 워터마크 */}
        {selectedIdentity && (
          <div
            key={selectedIdentity.sinner_id}
            className="absolute pointer-events-none hidden md:block"
            style={{
              left: '8%', top: '50%', transform: 'translateY(-50%)',
              width: '20rem', height: '20rem', zIndex: 2,
              opacity: 0.045,
              animation: 'heroWatermarkFade 0.6s ease-out',
            }}
          >
            <Image
              src={getSinnerLogoUrl(selectedIdentity.sinner_id)}
              alt=""
              fill
              loading="eager"
              sizes="3.75rem"
              style={{ objectFit: 'contain', filter: 'brightness(4) saturate(0)' }}
            />
          </div>
        )}

        {/* 텍스트 콘텐츠 */}
        <div className="relative z-10 flex w-full flex-col justify-end px-5 pb-8 pt-[30svh] sm:px-6 md:max-w-[40rem] md:justify-center md:px-16 md:pb-[clamp(3rem,7svh,6rem)] md:pt-[clamp(5rem,10svh,6rem)] lg:max-w-[46rem] lg:px-24">
          <div className="home-command-surface max-w-[32rem] opacity-0">
            <div className="flex items-center gap-3 md:gap-5">
              <DanteLogo size="2.75rem" className="home-logo-mark shrink-0 text-[var(--gold-light)] opacity-0 md:h-[4.5rem] md:w-[4.5rem]" />
              <HeroWordmark label={t('home.heading')} className="home-brand-title text-[length:clamp(2.75rem,11vw,3.5rem)] opacity-0 md:text-[4.75rem]" />
            </div>

            <p className="home-subtitle mt-3 text-[0.9375rem] leading-snug text-[var(--text-secondary)] opacity-0 md:mt-4 md:text-[1.0625rem]">
              Limbus Company {t('home.fanArchive')}
            </p>

            {/* 현재 슬라이드 인격 정보 */}
            {selectedIdentity && (
              <div className="home-meta-strip mt-6 min-w-0 border-l-2 border-[rgba(200,144,10,0.55)] pl-3.5 opacity-0 md:mt-9 md:pl-4" suppressHydrationWarning>
                <div className="flex items-center gap-2 text-[0.75rem] leading-none text-[var(--text-muted)]">
                  <RarityIcon rarity={selectedIdentity.rarity} />
                  <span className="tabular-nums">
                    {selectedIdentity.acquisition_info?.release_season ? `S${selectedIdentity.acquisition_info.release_season}` : selectedIdentity.release_date}
                  </span>
                </div>
                <p
                  className="mt-2 truncate font-heading text-[1.125rem] leading-tight text-[var(--gold-light)] md:text-[1.3125rem]"
                  title={getName(selectedIdentity.name_kr, selectedIdentity.name_en, selectedIdentity.name_jp)}
                >
                  {getName(selectedIdentity.name_kr, selectedIdentity.name_en, selectedIdentity.name_jp)}
                </p>
                <p className="mt-1 truncate text-[0.8125rem] text-[var(--text-secondary)]">
                  {getName(selectedIdentity.sinner?.name_kr, selectedIdentity.sinner?.name_en, selectedIdentity.sinner?.name_jp)}
                </p>
              </div>
            )}

            <div className="home-command-actions mt-6 grid grid-cols-2 gap-2 opacity-0 md:mt-8 md:gap-2.5" suppressHydrationWarning>
              <Link
                href="/sinners"
                className={`press cut-corners col-span-2 ${ACTION_BASE} bg-[var(--gold)] text-[0.9375rem] font-semibold text-[var(--bg-deep)] hover:bg-[var(--gold-light)] focus-visible:ring-inset focus-visible:ring-[var(--bg-deep)] focus-visible:ring-offset-0 md:min-h-[3.25rem]`}
              >
                <SinnerRosterIcon size="1.25rem" className="shrink-0" />
                <span className="truncate">{t('home.cta.sinners')}</span>
              </Link>
              <CommandUtilityLink href="/decks" icon={<DeckBoardIcon size="1.25rem" />}>
                {t('home.cta.decks')}
              </CommandUtilityLink>
              <CommandUtilityLink href="/planner/community" icon={<MirrorDungeonIcon size="1.25rem" />}>
                {t('home.cta.planner')}
              </CommandUtilityLink>
              <LimpiLink />
              <DiscordSupportLink />
            </div>
          </div>
        </div>
      </section>

      {/* ── 공지 띠 배너 ───────────────────────────────────────── */}
      {pinnedAnnouncement && (
        <AnnouncementBanner announcement={pinnedAnnouncement} />
      )}
      </div>
    </>
  )
}

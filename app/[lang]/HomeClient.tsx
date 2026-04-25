'use client'

import { useRef, useState, useCallback, useMemo } from 'react'
import { Link } from '@/lib/i18n/navigation'
import Image from 'next/image'
import dynamic from 'next/dynamic'
import { ArrowUpRight, Database, Layers3, Users } from 'lucide-react'

import { useTranslations, useLocale } from 'next-intl'
import { useRoutePrefetch } from '@/lib/hooks/useRoutePrefetch'
import type { SupportedLang } from '@/lib/i18n/types'
import GlitchText from '@/components/ui/GlitchText'
import AnnouncementBanner, { type AnnouncementData } from '@/components/home/AnnouncementBanner'
import ScrollAnimations from '@/components/home/ScrollAnimations'
import {
  type IdentityWithSinner,
  getSinnerLogoUrl,
  RARITY_ICON_MAP,
} from '@/lib/data/sinners'

// Heavy slider — dynamically imported for code splitting
const HeroGlitchSlider = dynamic(
  () => import('@/components/home/HeroGlitchSlider'),
  { ssr: false }
)

// ── SVG icons ─────────────────────────────────────────────────────────────

function DiscordIcon({ size = '1rem', style }: { size?: string; style?: React.CSSProperties }) {
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

function PrimaryActionIcon({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="h-[1.875rem] w-[1.875rem] shrink-0 rounded-[0.1875rem] bg-[rgba(13,11,8,0.22)] text-[var(--bg-deep)] transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:translate-x-[0.125rem] group-hover:-translate-y-[0.0625rem] group-active:translate-x-0 group-active:translate-y-0"
      style={{ display: 'grid', placeItems: 'center' }}
      aria-hidden="true"
    >
      {children}
    </span>
  )
}

function CommandUtilityLink({
  href,
  children,
  icon,
  className = '',
}: {
  href: string
  children: React.ReactNode
  icon: React.ReactNode
  className?: string
}) {
  return (
    <Link
      href={href}
      className={`group flex min-h-[2.5rem] min-w-0 items-center justify-between gap-2 border border-[rgba(200,144,10,0.28)] bg-[rgba(26,21,16,0.56)] px-3 py-2 text-[0.75rem] font-medium text-[rgba(232,196,120,0.74)] shadow-[inset_0_0.0625rem_0_rgba(232,176,48,0.08)] transition-[background-color,border-color,color,transform] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-[0.0625rem] hover:border-[rgba(232,176,48,0.5)] hover:bg-[rgba(36,29,21,0.8)] hover:text-[var(--gold-light)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(232,176,48,0.55)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-deep)] active:translate-y-0 md:min-h-[3rem] md:gap-3 md:px-4 md:py-3 md:text-[0.8125rem] ${className}`}
    >
      <span className="flex min-w-0 items-center gap-2">
        <span className="text-[rgba(232,176,48,0.55)] transition-colors duration-300 group-hover:text-[var(--gold-light)]" aria-hidden="true">
          {icon}
        </span>
        <span className="truncate">{children}</span>
      </span>
      <ArrowUpRight
        size="0.875rem"
        strokeWidth={1.7}
        className="shrink-0 opacity-45 transition-[opacity,transform] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:translate-x-[0.125rem] group-hover:-translate-y-[0.125rem] group-hover:opacity-80"
        aria-hidden="true"
      />
    </Link>
  )
}

// ── Rarity icon (small helper, no own file needed) ─────────────────────────

function RarityIcon({ rarity }: { rarity: number }) {
  const src = RARITY_ICON_MAP[rarity]
  if (!src) return null
  return (
    <Image
      src={src}
      alt={`${rarity}성`}
      width={48}
      height={16}
      unoptimized
      style={{ objectFit: 'contain', height: '0.75rem', width: 'auto' }}
    />
  )
}

// ── Props ──────────────────────────────────────────────────────────────────

interface HomeClientProps {
  latestIdentities: IdentityWithSinner[]
  pinnedAnnouncement?: AnnouncementData | null
}

export default function HomeClient({ latestIdentities, pinnedAnnouncement }: HomeClientProps) {
  const t = useTranslations()
  const locale = useLocale()
  const lang = locale as SupportedLang
  useRoutePrefetch([`/${lang}/decks`, `/${lang}/mirror-dungeon`, `/${lang}/sinners`, `/${lang}/tier-list`, `/${lang}/planner/community`, `/${lang}/keywords`])

  const getName = (kr?: string | null, en?: string | null, jp?: string | null): string => {
    if (lang === 'en') return en ?? kr ?? ''
    if (lang === 'ja') return jp ?? kr ?? ''
    return kr ?? ''
  }

  const sectionRef = useRef<HTMLDivElement>(null)
  const [selectedIdentity, setSelectedIdentity] = useState<IdentityWithSinner | null>(
    latestIdentities[0] ?? null
  )

  const hasAnnouncement = Boolean(pinnedAnnouncement)

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

  const firstViewportHeight = hasAnnouncement ? 'calc(100dvh - 3rem)' : '100dvh'

  return (
    <>
      {/* Scroll animations — targets server-rendered class names */}
      <ScrollAnimations />

      {/* ── 히어로 ─────────────────────────────────────────────── */}
      <section
        ref={sectionRef}
        className="relative overflow-hidden flex"
        style={{ minHeight: firstViewportHeight, background: 'var(--bg-deep)' }}
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
              'linear-gradient(90deg, var(--bg-deep) 0%, rgba(13,11,8,0.96) 20%, rgba(13,11,8,0.74) 43%, rgba(13,11,8,0.22) 66%, transparent 100%)',
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
        <div className="home-gold-rail pointer-events-none absolute bottom-[5.25rem] left-6 top-[5.25rem] z-[3] hidden w-[0.0625rem] origin-top bg-gradient-to-b from-transparent via-[rgba(200,144,10,0.46)] to-transparent opacity-0 md:left-[4.5rem] md:block lg:left-[6rem]" />

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
              sizes="3.75rem"
              style={{ objectFit: 'contain', filter: 'brightness(4) saturate(0)' }}
            />
          </div>
        )}

        {/* 텍스트 콘텐츠 */}
        <div
          className="relative z-10 flex w-full flex-col justify-end px-5 pb-16 pt-[48dvh] sm:px-6 md:max-w-[38rem] md:justify-center md:px-16 md:pb-24 md:pt-24 lg:max-w-[42rem] lg:px-24"
          style={{ minHeight: firstViewportHeight }}
        >
          <div className="home-command-surface max-w-full border-l border-[rgba(200,144,10,0.32)] bg-[linear-gradient(90deg,rgba(13,11,8,0.64),rgba(13,11,8,0.22)_78%,transparent)] pl-3 opacity-0 sm:pl-4 md:border-[rgba(200,144,10,0.36)] md:bg-[linear-gradient(90deg,rgba(13,11,8,0.9),rgba(13,11,8,0.48)_78%,transparent)] md:pl-6">
            <div className="mb-3 flex items-center gap-3 md:mb-5 md:gap-4">
              <Image
                src="/images/logo-hero.webp"
                alt=""
                width={66}
                height={82}
                unoptimized
                priority
                className="home-logo-mark h-auto w-[1.5rem] opacity-0 sm:w-[2rem] md:w-[4.125rem]"
                style={{ flexShrink: 0 }}
              />
              <GlitchText
                text="SAIGO NO DANTE"
                tag="h1"
                className="home-brand-title text-pretty font-display text-[1.5625rem] leading-[0.94] tracking-wider opacity-0 sm:text-[2rem] md:text-[3.875rem]"
                style={{ color: 'var(--gold)' } as React.CSSProperties}
              />
            </div>

          <p
            className="home-subtitle mb-3 max-w-[29rem] text-[0.8125rem] tracking-wider md:mb-6 md:text-lg"
            style={{ color: 'rgba(232,196,120,0.5)', opacity: 0, fontWeight: 300 }}
            suppressHydrationWarning
          >
            <span style={{ fontFamily: "'Song Myung', Georgia, serif", fontStyle: 'italic' }}>
              Limbus Company
            </span>{' '}
            <span style={{ fontFamily: 'var(--font-body)' }}>{t('home.fanArchive')}</span>
          </p>

          {/* 현재 슬라이드 인격 정보 */}
          {selectedIdentity && (
            <div className="home-meta-strip mb-4 max-w-[34rem] opacity-0 md:mb-8" suppressHydrationWarning>
              <div className="relative min-w-0 pl-3">
                <span className="absolute bottom-1 left-0 top-1 w-[0.0625rem] bg-[linear-gradient(180deg,rgba(200,144,10,0.7),rgba(200,144,10,0.12))]" aria-hidden="true" />
                <div className="mb-2 flex min-w-0 items-center gap-2.5">
                  <RarityIcon rarity={selectedIdentity.rarity} />
                  <span className="font-mono text-[0.625rem] leading-none text-[rgba(232,176,48,0.55)]">
                    {selectedIdentity.acquisition_info?.release_season ? `S${selectedIdentity.acquisition_info.release_season}` : selectedIdentity.release_date}
                  </span>
                </div>
                <div
                  className="truncate font-serif text-[0.9375rem] font-bold leading-tight text-[var(--gold-light)] md:text-[1.0625rem]"
                  title={getName(selectedIdentity.name_kr, selectedIdentity.name_en, selectedIdentity.name_jp)}
                >
                  {getName(selectedIdentity.name_kr, selectedIdentity.name_en, selectedIdentity.name_jp)}
                </div>
                <div className="mt-1 flex min-w-0 items-center gap-2 text-[0.6875rem] leading-none text-[var(--text-muted)]">
                  <span className="h-px w-5 shrink-0 bg-[rgba(200,144,10,0.45)]" aria-hidden="true" />
                  <span className="truncate font-title">
                    {getName(selectedIdentity.sinner?.name_kr, selectedIdentity.sinner?.name_en, selectedIdentity.sinner?.name_jp)}
                  </span>
                </div>
              </div>
            </div>
          )}

          <div className="home-command-actions grid max-w-[37rem] grid-cols-2 gap-1.5 opacity-0 md:grid-cols-[1fr_1.08fr] md:gap-3" suppressHydrationWarning>
            <Link
              href="/sinners"
              className="group col-span-2 flex min-h-[2.875rem] items-center justify-between gap-4 bg-[var(--gold)] px-4 py-2.5 text-[0.875rem] font-semibold text-[var(--bg-deep)] shadow-[0_0.75rem_2rem_rgba(0,0,0,0.22),inset_0_0.0625rem_0_rgba(255,244,190,0.32)] transition-[background-color,transform] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-[0.0625rem] hover:bg-[var(--gold-light)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(232,176,48,0.65)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-deep)] active:translate-y-0 md:min-h-[3.5rem] md:py-3 md:text-[0.9375rem]"
            >
              <span className="truncate">{t('home.cta.sinners')}</span>
              <PrimaryActionIcon>
                <Users size="1rem" strokeWidth={1.8} />
              </PrimaryActionIcon>
            </Link>
            <CommandUtilityLink href="/decks" icon={<Layers3 size="0.9375rem" strokeWidth={1.7} />}>
              {t('home.cta.decks')}
            </CommandUtilityLink>
            <CommandUtilityLink href="/planner/community" icon={<Database size="0.9375rem" strokeWidth={1.7} />}>
              {t('home.cta.planner')}
            </CommandUtilityLink>
            <CommandUtilityLink href="/bot" icon={<DiscordIcon size="0.9375rem" />} className="col-span-2">
              {t('home.cta.discordBot')}
            </CommandUtilityLink>
          </div>
          </div>
        </div>

        {/* 스크롤 유도 */}
        <div
          className="home-scroll-prompt absolute bottom-10 left-1/2 z-10 hidden -translate-x-1/2 flex-col items-center gap-2 opacity-0 md:flex"
          style={{ color: 'rgba(200,164,90,0.28)' }}
        >
          <span
            className="text-xs tracking-widest font-mono"
            style={{ letterSpacing: '0.3em', fontSize: '0.5625rem' }}
          >
            SCROLL
          </span>
          <div
            style={{
              width: '0.0625rem',
              height: '1.5rem',
              background: 'linear-gradient(to bottom, rgba(200,144,10,0.4), transparent)',
              animation: 'scrollPulse 2s ease-in-out infinite',
            }}
          />
        </div>
      </section>

      {/* ── 공지 띠 배너 ───────────────────────────────────────── */}
      {pinnedAnnouncement && (
        <AnnouncementBanner announcement={pinnedAnnouncement} />
      )}
    </>
  )
}

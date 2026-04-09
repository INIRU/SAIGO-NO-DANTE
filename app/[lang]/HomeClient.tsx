'use client'

import { useRef, useState, useCallback, useMemo } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import dynamic from 'next/dynamic'

import { useLanguage } from '@/lib/i18n'
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

function DiscordIcon({ size = 16, style }: { size?: number; style?: React.CSSProperties }) {
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
  const { t, lang } = useLanguage()

  const getName = (kr?: string | null, en?: string | null, jp?: string | null): string => {
    if (lang === 'en') return en ?? kr ?? ''
    if (lang === 'ja') return jp ?? kr ?? ''
    return kr ?? ''
  }

  const heroRef = useRef<HTMLDivElement>(null)
  const [heroIdentity, setHeroIdentity] = useState<IdentityWithSinner | null>(
    latestIdentities[0] ?? null
  )

  const hasAnnouncement = Boolean(pinnedAnnouncement)

  // 최신 출시일과 동일한 인격만 히어로 슬라이더에 사용
  const latestDate = latestIdentities[0]?.release_date
  const heroIdentities = useMemo(
    () =>
      latestDate
        ? latestIdentities.filter(id => id.release_date === latestDate)
        : latestIdentities.slice(0, 1),
    [latestIdentities, latestDate]
  )

  const handleSlideChange = useCallback((identity: IdentityWithSinner) => {
    setHeroIdentity(identity)
  }, [])

  const heroMinHeight = hasAnnouncement ? 'calc(100dvh - 3rem)' : '100dvh'

  return (
    <>
      {/* Scroll animations — targets server-rendered class names */}
      <ScrollAnimations />

      {/* ── 히어로 ─────────────────────────────────────────────── */}
      <section
        ref={heroRef}
        className="relative overflow-hidden flex"
        style={{ minHeight: heroMinHeight, background: 'var(--bg-deep)' }}
      >
        {/* 글리치 슬라이더 (최신 인격 풀 일러스트) */}
        {heroIdentities.length > 0 && (
          <HeroGlitchSlider identities={heroIdentities} onSlideChange={handleSlideChange} />
        )}

        {/* 이미지 없을 때 ambient glow */}
        {heroIdentities.length === 0 && (
          <div
            className="absolute inset-0 pointer-events-none"
            style={{ background: 'radial-gradient(ellipse at 50% 40%, rgba(200,164,90,0.08) 0%, transparent 60%)' }}
          />
        )}

        {/* 수감자 아이콘 워터마크 */}
        {heroIdentity && (
          <div
            key={heroIdentity.sinner_id}
            className="absolute pointer-events-none hidden md:block"
            style={{
              left: '8%', top: '50%', transform: 'translateY(-50%)',
              width: '20rem', height: '20rem', zIndex: 2,
              opacity: 0.045,
              animation: 'heroWatermarkFade 0.6s ease-out',
            }}
          >
            <Image
              src={getSinnerLogoUrl(heroIdentity.sinner_id)}
              alt=""
              fill
              sizes="60px"
              style={{ objectFit: 'contain', filter: 'brightness(4) saturate(0)' }}
            />
          </div>
        )}

        {/* 텍스트 콘텐츠 */}
        <div
          className="relative z-10 flex flex-col justify-center px-6 md:px-16 lg:px-24 max-w-xl"
          style={{ minHeight: heroMinHeight }}
        >
          <div className="flex items-center gap-3 md:gap-4 mb-2">
            <Image
              src="/images/logo-hero.webp"
              alt=""
              width={66}
              height={82}
              unoptimized
              priority
              className="w-[28px] sm:w-[38px] md:w-[66px] h-auto"
              style={{ flexShrink: 0 }}
            />
            <GlitchText
              text="SAIGO NO DANTE"
              tag="h1"
              className="font-display text-[1.625rem] sm:text-4xl md:text-6xl tracking-wider"
              style={{ color: 'var(--gold)' } as React.CSSProperties}
            />
          </div>

          <p
            className="hero-subtitle text-lg mb-4 tracking-wider"
            style={{ color: 'rgba(232,196,120,0.5)', opacity: 0, fontWeight: 300 }}
            suppressHydrationWarning
          >
            <span style={{ fontFamily: "'Song Myung', Georgia, serif", fontStyle: 'italic' }}>
              Limbus Company
            </span>{' '}
            <span style={{ fontFamily: 'var(--font-body)' }}>{t('home.fanArchive')}</span>
          </p>

          {/* 현재 슬라이드 인격 정보 */}
          {heroIdentity && (
            <div className="hero-desc mb-8" style={{ opacity: 0 }} suppressHydrationWarning>
              <div className="flex items-center gap-2 flex-wrap">
                <RarityIcon rarity={heroIdentity.rarity} />
                <span
                  className="font-serif font-bold"
                  style={{ color: 'var(--gold-light)', fontSize: '0.9375rem' }}
                >
                  {getName(heroIdentity.name_kr, heroIdentity.name_en, heroIdentity.name_jp)}
                </span>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.6875rem', fontFamily: 'var(--font-title)' }}>
                  — {getName(heroIdentity.sinner?.name_kr, heroIdentity.sinner?.name_en, heroIdentity.sinner?.name_jp)}
                </span>
              </div>
            </div>
          )}

          <div className="hero-cta flex flex-wrap gap-3 md:gap-4" style={{ opacity: 0 }} suppressHydrationWarning>
            <Link
              href="/sinners"
              className="px-5 md:px-8 py-2.5 md:py-3 text-sm md:text-base font-medium transition-all duration-300 hover:scale-105"
              style={{ background: 'var(--gold)', color: 'var(--bg-deep)', borderRadius: '0.25rem' }}
            >
              {t('home.cta.sinners')}
            </Link>
            <Link
              href="/decks"
              className="px-5 md:px-8 py-2.5 md:py-3 text-sm md:text-base font-medium transition-all duration-300 hover:scale-105"
              style={{ border: '1px solid var(--gold)', color: 'var(--gold)', borderRadius: '0.25rem' }}
            >
              {t('home.cta.decks')}
            </Link>
            <Link
              href="/planner/community"
              className="px-5 md:px-8 py-2.5 md:py-3 text-sm md:text-base font-medium transition-all duration-300 hover:scale-105"
              style={{ border: '1px solid #4898b0', color: '#4898b0', borderRadius: '0.25rem' }}
            >
              {t('home.cta.planner')}
            </Link>
            <Link
              href="/bot"
              className="flex items-center gap-2 px-5 md:px-8 py-2.5 md:py-3 text-sm md:text-base font-medium transition-all duration-300 hover:scale-105"
              style={{ border: '1px solid #5865f2', color: '#7289da', borderRadius: '0.25rem' }}
            >
              <DiscordIcon size={16} />
              {t('home.cta.discordBot')}
            </Link>
          </div>
        </div>

        {/* 스크롤 유도 */}
        <div
          className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 z-10"
          style={{ color: 'rgba(200,164,90,0.25)' }}
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

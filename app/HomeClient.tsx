'use client'

import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import {
  Globe, Youtube, XIcon, ExternalLink, Sparkles, ChevronRight, Calendar,
  Shield, Layers, Pin, ChevronDown,
} from 'lucide-react'

import GlitchText from '@/components/ui/GlitchText'
import heroStyles from '@/styles/components/HeroGlitch.module.css'
import {
  IdentityWithSinner,
  getSinnerLogoUrl, getIdentityInfoUrl,
  RARITY_ICON_MAP, BLUR_PLACEHOLDER,
} from '@/lib/data/sinners'

function DiscordIcon({ size = 18, style }: { size?: number; style?: React.CSSProperties }) {
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

const OFFICIAL_LINKS: Array<{
  label: string
  sub: string
  href: string
  icon: React.ComponentType<{ size?: number; style?: React.CSSProperties }>
  color: string
}> = [
  { label: '공식 사이트', sub: 'limbuscompany.com',           href: 'https://limbuscompany.com',                       icon: Globe,        color: '#4898b0' },
  { label: 'YouTube',    sub: '공식 채널',                    href: 'https://www.youtube.com/@ProjectMoonOfficial',   icon: Youtube,      color: '#c83030' },
  { label: 'Twitter / X',sub: '@LimbusCompany_B',            href: 'https://x.com/LimbusCompany_B',                  icon: XIcon,        color: '#3870b0' },
  { label: '팬 디스코드', sub: 'discord.gg/efaGjQwsVB',       href: 'https://discord.gg/efaGjQwsVB',                  icon: DiscordIcon,  color: '#5865f2' },
]

const FEATURES = [
  {
    href: '/sinners',
    icon: Shield,
    tag: 'SINNER DB',
    title: '수감자 DB',
    desc: '12인 수감자의 모든 인격, EGO, 스킬 데이터를 한 곳에서.',
    accent: '#c8900a',
  },
  {
    href: '/decks',
    icon: Layers,
    tag: 'DECK BOARD',
    title: '덱 공유',
    desc: '커뮤니티가 공유한 덱 빌드를 탐색하고 나만의 최적 덱을 등록하세요.',
    accent: '#4898b0',
  },
]

function formatDate(d: string) {
  const dt = new Date(d)
  return `${dt.getFullYear()}.${String(dt.getMonth() + 1).padStart(2, '0')}.${String(dt.getDate()).padStart(2, '0')}`
}

function RarityIcon({ rarity }: { rarity: number }) {
  const src = RARITY_ICON_MAP[rarity]
  if (!src) return null
  return <Image src={src} alt={`${rarity}성`} width={48} height={16} unoptimized style={{ objectFit: 'contain', height: '12px', width: 'auto' }} />
}

// ── 히어로 글리치 슬라이더 ───────────────────────────────────────────────

type HeroSlide = { url: string; identity: IdentityWithSinner; gacksung: boolean }

function HeroGlitchSlider({
  identities,
  onSlideChange,
}: {
  identities: IdentityWithSinner[]
  onSlideChange: (identity: IdentityWithSinner) => void
}) {
  const [validGacksung, setValidGacksung] = useState<Set<string>>(new Set())
  const [currentIdx, setCurrentIdx]       = useState(0)
  const [pendingIdx, setPendingIdx]       = useState<number | null>(null)
  const layerARef        = useRef<HTMLDivElement>(null)
  const chromaRRef       = useRef<HTMLDivElement>(null)
  const chromaBRef       = useRef<HTMLDivElement>(null)
  const sliderRef        = useRef<HTMLDivElement>(null)
  const isTransitionRef  = useRef(false)
  const advanceRef       = useRef<() => void>(() => {})

  // 각성 이미지 존재 여부 확인 (404 → 스킵)
  useEffect(() => {
    identities.forEach(identity => {
      const url = getIdentityInfoUrl(identity, true)
      if (!url) return
      const img = new window.Image()
      img.onload = () => setValidGacksung(prev => new Set([...prev, identity.id]))
      img.src = url
    })
  }, [identities])

  const slides = useMemo<HeroSlide[]>(() => {
    const result: HeroSlide[] = []
    identities.forEach(identity => {
      const normalUrl = getIdentityInfoUrl(identity, false)
      if (normalUrl) result.push({ url: normalUrl, identity, gacksung: false })
      if (validGacksung.has(identity.id)) {
        const gUrl = getIdentityInfoUrl(identity, true)
        if (gUrl) result.push({ url: gUrl, identity, gacksung: true })
      }
    })
    return result
  }, [identities, validGacksung])

  // 부모에 현재 슬라이드 알림
  useEffect(() => {
    const s = slides[currentIdx]
    if (s) onSlideChange(s.identity)
  }, [currentIdx, slides, onSlideChange])

  // 최초 fade-in
  const sliderAnimRef = useRef(false)
  useEffect(() => {
    const el = sliderRef.current
    if (!el || sliderAnimRef.current) return
    sliderAnimRef.current = true
    import('gsap').then(({ gsap }) => {
      gsap.fromTo(el, { opacity: 0 }, { opacity: 1, duration: 0.9, delay: 0.4, ease: 'power2.out' })
    })
  }, [])

  // 켄번즈 효과 — 슬라이드마다 천천히 줌인
  useEffect(() => {
    const el = layerARef.current
    if (!el) return
    import('gsap').then(({ gsap }) => {
      gsap.killTweensOf(el)
      gsap.fromTo(el,
        { scale: 1, x: '0%', y: '0%' },
        { scale: 1.06, x: '-1%', y: '-0.8%', duration: 8, ease: 'none', transformOrigin: 'right center' }
      )
    })
  }, [currentIdx])

  // 글리치 전환
  const glitchTo = useCallback(async (nextIdx: number) => {
    if (isTransitionRef.current || slides.length < 2) return
    isTransitionRef.current = true
    setPendingIdx(nextIdx)

    // Layer B에 새 이미지가 렌더될 때까지 한 프레임 대기
    await new Promise(r => setTimeout(r, 16))

    const { gsap } = await import('gsap')
    const a = layerARef.current
    const rCh = chromaRRef.current
    const bCh = chromaBRef.current
    if (!a) { isTransitionRef.current = false; return }

    const tl = gsap.timeline({
      onComplete: () => {
        setCurrentIdx(nextIdx)
        setPendingIdx(null)
        gsap.set(a, { clipPath: '', x: 0, filter: 'none' })
        if (rCh) gsap.set(rCh, { opacity: 0, x: 0, clipPath: 'none' })
        if (bCh) gsap.set(bCh, { opacity: 0, x: 0, clipPath: 'none' })
        isTransitionRef.current = false
      },
    })

    // 메인 이미지 글리치
    tl.to(a, { clipPath: 'inset(12% 0 75% 0)', x: -7, filter: 'brightness(1.8)',     duration: 0.05 })
      .to(a, { clipPath: 'inset(50% 0 28% 0)', x: 9,  filter: 'hue-rotate(80deg)',   duration: 0.04 })
      .to(a, { clipPath: 'inset(6%  0 82% 0)', x: -5, filter: 'brightness(2.2)',     duration: 0.05 })
      .to(a, { clipPath: 'inset(70% 0 10% 0)', x: 6,  filter: 'hue-rotate(-60deg)',  duration: 0.04 })
      .to(a, { clipPath: 'inset(28% 0 52% 0)', x: -8, filter: 'brightness(1.5)',     duration: 0.04 })
      .to(a, { clipPath: 'inset(0 0 100% 0)',   x: 0,  filter: 'none',               duration: 0.06 })
  }, [slides.length])

  // advance ref 최신화
  useEffect(() => {
    advanceRef.current = () => glitchTo((currentIdx + 1) % slides.length)
  }, [currentIdx, slides.length, glitchTo])

  // 자동 슬라이드: 같은 인격 노말→각성은 1.5초, 다른 인격으로 전환은 5초
  useEffect(() => {
    if (slides.length < 2) return
    const nextIdx = (currentIdx + 1) % slides.length
    const isSameIdentity = slides[currentIdx]?.identity.id === slides[nextIdx]?.identity.id
    const delay = isSameIdentity ? 2500 : 5000
    const id = setTimeout(() => advanceRef.current(), delay)
    return () => clearTimeout(id)
  }, [currentIdx, slides])

  const current = slides[currentIdx]
  const pending = pendingIdx !== null ? slides[pendingIdx] : null

  if (!current) return null

  return (
    <div ref={sliderRef} className="absolute inset-0 md:inset-y-0 md:left-auto md:right-0 w-full md:w-[62%] overflow-hidden" style={{ opacity: 0, zIndex: 1 }}>
      {/* Layer B: 다음 이미지 (아래) */}
      {pending && (
        <div className="absolute inset-0" style={{ zIndex: 5 }}>
          <Image src={pending.url} alt="" fill placeholder="blur" blurDataURL={BLUR_PLACEHOLDER} className="object-cover object-top" sizes="(max-width: 768px) 100vw, 62vw" />
        </div>
      )}
      {/* Layer A: 현재 이미지 (글리치 시 위에서 사라짐) */}
      <div ref={layerARef} className="absolute inset-0" style={{ zIndex: 10 }}>
        <Image src={current.url} alt={current.identity.name_kr} fill priority placeholder="blur" blurDataURL={BLUR_PLACEHOLDER} className="object-cover object-top" sizes="(max-width: 768px) 100vw, 62vw" />
        {/* RGB Chromatic Aberration 오버레이 (전환 시 GSAP 제어) */}
        <div ref={chromaRRef} className={heroStyles.chromaR} style={{ zIndex: 2 }}>
          <Image src={current.url} alt="" fill loading="lazy" className="object-cover object-top" style={{ filter: 'grayscale(1)' }} sizes="(max-width: 768px) 100vw, 62vw" />
        </div>
        <div ref={chromaBRef} className={heroStyles.chromaB} style={{ zIndex: 2 }}>
          <Image src={current.url} alt="" fill loading="lazy" className="object-cover object-top" style={{ filter: 'grayscale(1)' }} sizes="(max-width: 768px) 100vw, 62vw" />
        </div>
      </div>
      {/* 그라디언트 오버레이 — 모바일은 더 진하게 */}
      <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 15, background: 'linear-gradient(to right, var(--bg-deep) 0%, rgba(13,11,8,0.9) 25%, rgba(13,11,8,0.5) 55%, transparent 85%)' }} />
      <div className="absolute inset-0 pointer-events-none md:hidden" style={{ zIndex: 15, background: 'linear-gradient(to right, rgba(13,11,8,0.95) 0%, rgba(13,11,8,0.7) 50%, rgba(13,11,8,0.3) 100%)' }} />
      <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 15, background: 'linear-gradient(to top, var(--bg-deep) 0%, transparent 30%)' }} />
      {/* 슬라이드 인디케이터 */}
      {slides.length > 1 && (
        <div className="absolute bottom-5 right-5 flex gap-2" style={{ zIndex: 20 }}>
          {slides.map((s, i) => (
            <button
              key={i}
              onClick={() => glitchTo(i)}
              title={`${s.identity.name_kr}${s.gacksung ? ' 각성' : ''}`}
              style={{
                width: i === currentIdx ? '18px' : '5px',
                height: '5px',
                borderRadius: '3px',
                background: i === currentIdx ? 'var(--gold)' : 'rgba(200,164,90,0.25)',
                border: 'none',
                cursor: 'pointer',
                padding: 0,
                transition: 'all 0.3s ease',
              }}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ── 메인 컴포넌트 ────────────────────────────────────────────────────────────

type YoutubeVideo = { videoId: string; title: string; publishedAt: string }
type Announcement = { id: string; title: string; content: string; pinned: boolean; created_at: string }

export default function HomeClient({
  latestIdentities,
  latestVideo,
  pinnedAnnouncement,
}: {
  latestIdentities: IdentityWithSinner[]
  latestVideo?: YoutubeVideo | null
  pinnedAnnouncement?: Announcement | null
}) {
  const heroRef = useRef<HTMLDivElement>(null)
  const [heroIdentity, setHeroIdentity] = useState<IdentityWithSinner | null>(latestIdentities[0] ?? null)
  const [hoveredFeature, setHoveredFeature] = useState<number | null>(null)
  const [announcementOpen, setAnnouncementOpen] = useState(false)
  const [announcementDismissed, setAnnouncementDismissed] = useState(false)

  // 최신 출시일과 동일한 인격만 히어로 슬라이더에 사용
  const latestDate     = latestIdentities[0]?.release_date
  const heroIdentities = useMemo(() =>
    latestDate
      ? latestIdentities.filter(id => id.release_date === latestDate)
      : latestIdentities.slice(0, 1),
    [latestIdentities, latestDate]
  )

  const handleSlideChange = useCallback((identity: IdentityWithSinner) => {
    setHeroIdentity(identity)
  }, [])

  const scrollAnimRef = useRef(false)
  useEffect(() => {
    if (scrollAnimRef.current) return
    scrollAnimRef.current = true
    const init = async () => {
      const { gsap } = await import('gsap')
      const { ScrollTrigger } = await import('gsap/ScrollTrigger')
      gsap.registerPlugin(ScrollTrigger)

      const ctx = gsap.context(() => {
        // 히어로 텍스트
        gsap.timeline({ defaults: { ease: 'power3.out' } })
          .fromTo('.hero-subtitle', { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.8, delay: 0.3 })
          .fromTo('.hero-desc',     { opacity: 0, y: 15 }, { opacity: 1, y: 0, duration: 0.6 }, '-=0.4')
          .fromTo('.hero-cta',      { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.5, stagger: 0.1 }, '-=0.3')

        // 최신 인격 카드
        gsap.fromTo('.latest-card',
          { opacity: 0, y: 50, scale: 0.94 },
          { opacity: 1, y: 0, scale: 1, duration: 0.6, stagger: 0.07, ease: 'power2.out',
            scrollTrigger: { trigger: '.latest-section', start: 'top 78%' } }
        )
        gsap.fromTo('.latest-header',
          { opacity: 0, x: -20 },
          { opacity: 1, x: 0, duration: 0.6, ease: 'power2.out',
            scrollTrigger: { trigger: '.latest-section', start: 'top 85%' } }
        )

        // 공식 링크
        gsap.fromTo('.official-link-card',
          { opacity: 0, scale: 0.88, y: 20 },
          { opacity: 1, scale: 1, y: 0, duration: 0.55, stagger: 0.1, ease: 'back.out(1.4)',
            scrollTrigger: { trigger: '.official-section', start: 'top 85%' } }
        )

        // 기능 패널
        gsap.fromTo('.feature-card',
          { opacity: 0, y: 40 },
          { opacity: 1, y: 0, duration: 0.7, stagger: 0.15, ease: 'power2.out',
            scrollTrigger: { trigger: '.features-section', start: 'top 75%' } }
        )
      })

      ScrollTrigger.refresh()
      return () => ctx.revert()
    }

    let cleanup: (() => void) | undefined
    init().then(fn => { cleanup = fn })
    return () => { cleanup?.() }
  }, [])

  return (
    <div style={{ background: 'var(--bg-deep)' }}>

      {/* ── 히어로 ─────────────────────────────────────────────── */}
      <section ref={heroRef} className="relative overflow-hidden flex" style={{ minHeight: pinnedAnnouncement && !announcementDismissed ? 'calc(100dvh - 48px)' : '100dvh' }}>

        {/* 글리치 슬라이더 (최신 인격 풀 일러스트) */}
        {heroIdentities.length > 0 && (
          <HeroGlitchSlider identities={heroIdentities} onSlideChange={handleSlideChange} />
        )}

        {/* 이미지 없을 때 ambient glow */}
        {heroIdentities.length === 0 && (
          <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse at 50% 40%, rgba(200,164,90,0.08) 0%, transparent 60%)' }} />
        )}

        {/* 수감자 아이콘 워터마크 (왼쪽 영역) — 모바일 숨김, 페이드 전환 */}
        {heroIdentity && (
          <div
            key={heroIdentity.sinner_id}
            className="absolute pointer-events-none hidden md:block"
            style={{
              left: '8%', top: '50%', transform: 'translateY(-50%)',
              width: '320px', height: '320px', zIndex: 2,
              opacity: 0.045,
              animation: 'heroWatermarkFade 0.6s ease-out',
            }}
          >
            <Image src={getSinnerLogoUrl(heroIdentity.sinner_id)} alt="" fill sizes="60px" style={{ objectFit: 'contain', filter: 'brightness(4) saturate(0)' }} />
          </div>
        )}

        {/* 텍스트 콘텐츠 */}
        <div className="relative z-10 flex flex-col justify-center px-6 md:px-16 lg:px-24 max-w-xl" style={{ minHeight: pinnedAnnouncement && !announcementDismissed ? 'calc(100dvh - 48px)' : '100dvh' }}>
          <div className="flex items-center gap-3 md:gap-4 mb-2">
            <Image src="/images/logo-hero.webp" alt="" width={66} height={82} className="w-[28px] sm:w-[38px] md:w-[66px] h-auto" style={{ flexShrink: 0 }} />
            <GlitchText
              text="SAIGO NO DANTE"
              tag="h1"
              className="font-display text-[1.625rem] sm:text-4xl md:text-6xl tracking-wider"
              style={{ color: 'var(--gold)' } as React.CSSProperties}
            />
          </div>

          <p className="hero-subtitle font-serif text-lg italic mb-4" style={{ color: 'rgba(232,196,120,0.5)', opacity: 0 }}>
            Limbus Company 팬 아카이브
          </p>

          {/* 현재 슬라이드 인격 정보 */}
          {heroIdentity && (
            <div className="hero-desc mb-8" style={{ opacity: 0 }}>
              <div className="flex items-center gap-2 flex-wrap">
                <RarityIcon rarity={heroIdentity.rarity} />
                <span className="font-serif font-bold" style={{ color: 'var(--gold-light)', fontSize: '0.9375rem' }}>
                  {heroIdentity.name_kr}
                </span>
                <span style={{ color: '#7a6840', fontSize: '0.6875rem', fontFamily: 'var(--font-title)' }}>
                  — {heroIdentity.sinner?.name_kr}
                </span>
              </div>
            </div>
          )}

          <div className="hero-cta flex flex-wrap gap-3 md:gap-4" style={{ opacity: 0 }}>
            <Link
              href="/sinners"
              className="px-5 md:px-8 py-2.5 md:py-3 text-sm md:text-base font-medium transition-all duration-300 hover:scale-105"
              style={{ background: 'var(--gold)', color: 'var(--bg-deep)', borderRadius: '4px' }}
            >
              수감자 목록
            </Link>
            <Link
              href="/decks"
              className="px-5 md:px-8 py-2.5 md:py-3 text-sm md:text-base font-medium transition-all duration-300 hover:scale-105"
              style={{ border: '1px solid var(--gold)', color: 'var(--gold)', borderRadius: '4px' }}
            >
              덱 게시판
            </Link>
            <a
              href="https://discord.gg/efaGjQwsVB"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-5 md:px-8 py-2.5 md:py-3 text-sm md:text-base font-medium transition-all duration-300 hover:scale-105"
              style={{ border: '1px solid #5865f2', color: '#7289da', borderRadius: '4px' }}
            >
              <DiscordIcon size={16} />
              팬 디스코드
            </a>
          </div>
        </div>

        {/* 스크롤 유도 */}
        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 z-10" style={{ color: 'rgba(200,164,90,0.25)' }}>
          <span className="text-xs tracking-widest font-mono" style={{ letterSpacing: '0.3em', fontSize: '0.5625rem' }}>SCROLL</span>
          <div style={{
            width: '0.0625rem',
            height: '1.5rem',
            background: 'linear-gradient(to bottom, rgba(200,144,10,0.4), transparent)',
            animation: 'scrollPulse 2s ease-in-out infinite',
          }} />
        </div>
      </section>

      {/* ── 공지 띠 배너 ───────────────────────────────────────── */}
      {pinnedAnnouncement && !announcementDismissed && (
        <div
          style={{
            background: 'linear-gradient(135deg, rgba(200,144,10,0.1) 0%, rgba(13,11,8,0.98) 100%)',
            borderBottom: '1px solid rgba(200,144,10,0.2)',
          }}
        >
          <div className="max-w-7xl mx-auto px-6">
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '12px 0',
                cursor: 'pointer',
                userSelect: 'none',
              }}
              onClick={() => setAnnouncementOpen(prev => !prev)}
            >
              <Pin size={13} style={{ color: '#c8900a', flexShrink: 0, transform: 'rotate(45deg)' }} />
              <span
                className="font-serif font-bold"
                style={{ color: 'var(--gold-light)', fontSize: '0.875rem', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
              >
                {pinnedAnnouncement.title}
              </span>
              <span className="font-mono" style={{ color: '#7a6840', fontSize: '0.625rem', flexShrink: 0 }}>
                {new Date(pinnedAnnouncement.created_at).toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' })}
              </span>
              <Link
                href="/announcements"
                onClick={e => e.stopPropagation()}
                className="font-mono transition-colors hover:opacity-70"
                style={{ color: '#8a6010', fontSize: '0.625rem', flexShrink: 0, letterSpacing: '0.05em' }}
              >
                전체보기
              </Link>
              <ChevronDown
                size={14}
                style={{
                  color: '#8a6010',
                  flexShrink: 0,
                  transform: announcementOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                  transition: 'transform 0.25s ease',
                }}
              />
              <button
                onClick={e => { e.stopPropagation(); setAnnouncementDismissed(true) }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#7a6840',
                  cursor: 'pointer',
                  padding: 4,
                  flexShrink: 0,
                  display: 'flex',
                  alignItems: 'center',
                }}
                title="닫기"
              >
                <XIcon size={13} />
              </button>
            </div>

            {announcementOpen && pinnedAnnouncement.content && (
              <div
                style={{
                  paddingBottom: 14,
                  paddingLeft: 25,
                  color: '#7a6845',
                  fontSize: '0.8125rem',
                  lineHeight: 1.7,
                  borderTop: '1px solid rgba(200,144,10,0.1)',
                  paddingTop: 12,
                  whiteSpace: 'pre-wrap',
                }}
              >
                {pinnedAnnouncement.content}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── 최신 유튜브 영상 ─────────────────────────────────────── */}
      {latestVideo && (
        <section
          className="relative max-w-7xl mx-auto px-6 py-20"
          style={{
            // atmospheric radial glow behind the whole section
            isolation: 'isolate',
          }}
        >
          {/* subtle atmospheric background */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: 'radial-gradient(ellipse 70% 60% at 50% 50%, rgba(200,48,30,0.04) 0%, transparent 70%)',
              zIndex: 0,
            }}
          />

          <div className="relative" style={{ zIndex: 1 }}>
            {/* 섹션 헤더 */}
            <div className="flex items-end justify-between mb-6">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Youtube size={11} style={{ color: '#c83030' }} />
                  <span className="font-mono" style={{ color: '#c83030', fontSize: '0.625rem', letterSpacing: '0.4em', opacity: 0.8 }}>
                    LATEST VIDEO
                  </span>
                </div>
                <h2 className="font-serif text-4xl font-bold tracking-wide" style={{ color: 'var(--gold-light)' }}>
                  최신 영상
                </h2>
              </div>
              <a
                href="https://www.youtube.com/@ProjectMoonOfficial/videos"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-sm transition-all hover:gap-2.5 mb-1"
                style={{ color: '#c83030', opacity: 0.7 }}
              >
                채널 더보기 <ChevronRight size={14} />
              </a>
            </div>

            <div className="divider-gold mb-8" />

            <div className="grid grid-cols-1 md:grid-cols-5 gap-6 items-start">
              {/* iframe embed */}
              <div
                className="md:col-span-3"
                style={{
                  position: 'relative',
                  paddingTop: '56.25%',
                  borderRadius: '4px',
                  overflow: 'hidden',
                  border: '1px solid var(--border)',
                  boxShadow: '0 8px 40px rgba(0,0,0,0.6)',
                }}
              >
                <iframe
                  src={`https://www.youtube.com/embed/${latestVideo.videoId}?rel=0&modestbranding=1`}
                  title={latestVideo.title}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 'none' }}
                />
              </div>

              {/* 영상 정보 */}
              <div className="md:col-span-2 flex flex-col justify-center gap-4 py-2">
                {/* 제목 */}
                <a
                  href={`https://www.youtube.com/watch?v=${latestVideo.videoId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-serif font-bold text-xl leading-snug hover:text-yellow-300 transition-colors"
                  style={{ color: 'var(--gold-light)' }}
                >
                  {latestVideo.title}
                </a>

                {/* 출판일 */}
                {latestVideo.publishedAt && (
                  <div className="flex items-center gap-1.5" style={{ color: '#7a6840' }}>
                    <Calendar size={11} />
                    <span className="font-mono" style={{ fontSize: '0.6875rem' }}>
                      {formatDate(latestVideo.publishedAt.slice(0, 10))}
                    </span>
                  </div>
                )}

                {/* 구분선 */}
                <div className="divider-gold" />

                {/* 채널 배지 */}
                <div className="flex items-center gap-3">
                  <div
                    className="flex items-center justify-center w-8 h-8 rounded-full shrink-0"
                    style={{ background: 'rgba(200,48,48,0.12)', border: '1px solid rgba(200,48,48,0.3)' }}
                  >
                    <Youtube size={15} style={{ color: '#c83030' }} />
                  </div>
                  <div>
                    <div className="font-serif text-sm font-bold" style={{ color: 'var(--gold-light)' }}>
                      Project Moon
                    </div>
                    <div className="font-mono" style={{ color: '#7a6840', fontSize: '0.625rem' }}>
                      @projectmoon_official
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ── 최신 인격 ──────────────────────────────────────────── */}
      {latestIdentities.length > 0 && (
        <section
          className="latest-section relative max-w-7xl mx-auto px-6 py-20"
          style={{ isolation: 'isolate' }}
        >
          <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse 60% 50% at 50% 50%, rgba(200,144,10,0.04) 0%, transparent 70%)', zIndex: 0 }} />

          <div className="relative" style={{ zIndex: 1 }}>
            <div className="latest-header flex items-end justify-between mb-6">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles size={11} style={{ color: 'var(--gold)' }} />
                  <span className="font-mono" style={{ color: 'var(--gold-dim)', fontSize: '0.625rem', letterSpacing: '0.4em' }}>LATEST UPDATE</span>
                </div>
                <h2 className="font-serif text-4xl font-bold tracking-wide" style={{ color: 'var(--gold-light)' }}>최신 인격</h2>
              </div>
              {latestDate && (
                <div className="flex items-center gap-1.5 mb-1" style={{ color: '#7a6840' }}>
                  <Calendar size={11} />
                  <span className="font-mono" style={{ fontSize: '0.6875rem' }}>{formatDate(latestDate)}</span>
                </div>
              )}
            </div>

            <div className="divider-gold mb-10" />

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
              {latestIdentities.map((identity) => {
                const portraitUrl   = getIdentityInfoUrl(identity)
                const logoUrl       = getSinnerLogoUrl(identity.sinner_id)
                const rarityIconSrc = RARITY_ICON_MAP[identity.rarity]
                return (
                  <Link key={identity.id} href={`/sinners/${identity.sinner_id}/identities/${identity.id}`} className="latest-card group block" style={{ opacity: 0 }}>
                    <div
                      className="relative overflow-hidden"
                      style={{ aspectRatio: '3/4', background: 'linear-gradient(160deg, #1e1810 0%, #120e08 100%)', border: '1px solid var(--border)', borderRadius: '4px', transition: 'border-color 0.25s, box-shadow 0.25s' }}
                      onMouseEnter={e => {
                        e.currentTarget.style.borderColor = 'var(--gold-dim)'
                        e.currentTarget.style.boxShadow = '0 0 20px rgba(200,144,10,0.2), inset 0 0 20px rgba(200,144,10,0.05)'
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.borderColor = 'var(--border)'
                        e.currentTarget.style.boxShadow = 'none'
                      }}
                    >
                      {portraitUrl ? (
                        <Image src={portraitUrl} alt={identity.name_kr} fill
                          placeholder="blur" blurDataURL={BLUR_PLACEHOLDER}
                          className="object-cover object-top transition-transform duration-500 group-hover:scale-105"
                          style={{ objectPosition: '50% 10%' }}
                          sizes="200px" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center" style={{ background: 'linear-gradient(160deg, #1e1810 0%, #0d0a06 100%)' }}>
                          <span className="font-serif font-bold" style={{ fontSize: '2.5rem', color: 'rgba(200,144,10,0.08)' }}>
                            {identity.name_kr?.[0] ?? '?'}
                          </span>
                        </div>
                      )}
                      <div className="absolute top-2 left-2 z-10">
                        <Image src={logoUrl} alt="" width={20} height={20} style={{ filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.8))', opacity: 0.75 }} />
                      </div>
                      {rarityIconSrc && (
                        <div className="absolute top-2 right-2 z-10">
                          <Image src={rarityIconSrc} alt={`${identity.rarity}성`} width={48} height={16} unoptimized style={{ height: '11px', width: 'auto', objectFit: 'contain' }} />
                        </div>
                      )}
                      <div className="absolute bottom-0 left-0 right-0 z-10" style={{ height: '60%', background: 'linear-gradient(to top, rgba(13,11,8,1) 0%, rgba(13,11,8,0.85) 40%, rgba(13,11,8,0.2) 75%, transparent 100%)' }} />
                      <div className="absolute bottom-0 left-0 right-0 px-2 pb-2 z-20">
                        <div className="font-serif font-bold leading-tight group-hover:text-yellow-300 transition-colors" style={{ color: 'var(--gold-light)', fontSize: '0.8125rem' }}>
                          {identity.name_kr}
                        </div>
                        <div style={{ color: '#7a6840', fontSize: '0.5625rem', fontFamily: 'var(--font-title)', marginTop: '1px' }}>
                          {identity.sinner?.name_kr ?? identity.sinner_id}
                        </div>
                      </div>
                    </div>
                    {identity.release_date && (
                      <div className="mt-1.5 flex items-center gap-1" style={{ color: '#3a2a15' }}>
                        <Calendar size={9} />
                        <span className="font-mono" style={{ fontSize: '0.5625rem' }}>{formatDate(identity.release_date)}</span>
                      </div>
                    )}
                  </Link>
                )
              })}
            </div>

            <div className="mt-10 flex justify-end">
              <Link href="/sinners" className="flex items-center gap-1.5 text-sm transition-all hover:gap-2.5" style={{ color: 'var(--gold-dim)' }}>
                전체 수감자 보기
                <ChevronRight size={14} />
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* ── 기능 소개 (수직 메뉴 패널) ─────────────────────────── */}
      <section className="features-section max-w-7xl mx-auto px-6 py-16">
        {/* 섹션 헤더 */}
        <div className="flex items-center gap-4 mb-8">
          <div className="divider-gold flex-1" />
          <span className="font-mono shrink-0" style={{ color: '#3a2a15', fontSize: '0.625rem', letterSpacing: '0.4em' }}>
            FEATURES
          </span>
          <div className="divider-gold flex-1" />
        </div>

        {/* 패널 묶음 — 하나의 border 안에 divider로 구분 */}
        <div style={{ border: '1px solid var(--border)', borderRadius: '4px', overflow: 'hidden' }}>
          {FEATURES.map((feature, i) => {
            const Icon = feature.icon
            const isHovered = hoveredFeature === i
            return (
              <Link
                key={feature.href}
                href={feature.href}
                className="feature-card block"
                style={{ opacity: 0 }}
                onMouseEnter={() => setHoveredFeature(i)}
                onMouseLeave={() => setHoveredFeature(null)}
              >
                <div
                  style={{
                    position: 'relative',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '20px',
                    padding: '20px 24px',
                    background: isHovered
                      ? `linear-gradient(to right, ${feature.accent}0a 0%, var(--bg-card) 40%)`
                      : 'var(--bg-card)',
                    borderTop: i > 0 ? '1px solid var(--border)' : 'none',
                    transition: 'background 0.25s ease',
                    overflow: 'hidden',
                  }}
                >
                  {/* 왼쪽 세로 accent bar */}
                  <div
                    style={{
                      position: 'absolute',
                      left: 0,
                      top: 0,
                      bottom: 0,
                      width: '3px',
                      background: feature.accent,
                      transform: isHovered ? 'scaleY(1)' : 'scaleY(0)',
                      transformOrigin: 'center',
                      transition: 'transform 0.22s ease',
                      borderRadius: '0 2px 2px 0',
                    }}
                  />

                  {/* 아이콘 컨테이너 */}
                  <div
                    style={{
                      flexShrink: 0,
                      width: '44px',
                      height: '44px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: isHovered ? `${feature.accent}1a` : `${feature.accent}0e`,
                      border: `1px solid ${isHovered ? feature.accent + '60' : feature.accent + '30'}`,
                      borderRadius: '4px',
                      transition: 'background 0.25s ease, border-color 0.25s ease',
                    }}
                  >
                    <Icon
                      size={20}
                      style={{
                        color: feature.accent,
                        opacity: isHovered ? 1 : 0.7,
                        transition: 'opacity 0.25s ease',
                      }}
                    />
                  </div>

                  {/* 텍스트 */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {/* mono 태그 */}
                    <div
                      className="font-mono"
                      style={{
                        fontSize: '0.5625rem',
                        letterSpacing: '0.35em',
                        color: feature.accent,
                        opacity: isHovered ? 0.9 : 0.5,
                        marginBottom: '4px',
                        transition: 'opacity 0.25s ease',
                      }}
                    >
                      {feature.tag}
                    </div>
                    {/* 타이틀 */}
                    <div
                      className="font-serif font-bold"
                      style={{
                        fontSize: '1.0625rem',
                        color: isHovered ? 'var(--gold-light)' : 'var(--gold)',
                        marginBottom: '3px',
                        transition: 'color 0.25s ease',
                      }}
                    >
                      {feature.title}
                    </div>
                    {/* 설명 */}
                    <div
                      style={{
                        fontSize: '0.75rem',
                        color: isHovered ? '#7a6040' : '#7a6840',
                        fontFamily: 'var(--font-body)',
                        transition: 'color 0.25s ease',
                        lineHeight: 1.5,
                      }}
                    >
                      {feature.desc}
                    </div>
                  </div>

                  {/* 쉐브론 */}
                  <ChevronRight
                    size={16}
                    style={{
                      flexShrink: 0,
                      color: isHovered ? feature.accent : '#3a2a15',
                      transform: isHovered ? 'translateX(2px)' : 'translateX(0)',
                      transition: 'color 0.25s ease, transform 0.25s ease',
                    }}
                  />
                </div>
              </Link>
            )
          })}
        </div>
      </section>

      {/* ── 공식 채널 ──────────────────────────────────────────── */}
      <section className="official-section max-w-7xl mx-auto px-6 pb-24">
        <div className="flex items-center gap-4 mb-8">
          <div className="divider-gold flex-1" />
          <span className="font-mono shrink-0" style={{ color: '#3a2a15', fontSize: '0.625rem', letterSpacing: '0.4em' }}>OFFICIAL</span>
          <div className="divider-gold flex-1" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {OFFICIAL_LINKS.map(({ label, sub, href, icon: Icon, color }) => (
            <a
              key={href}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="official-link-card group flex items-center gap-4 px-6 py-5 transition-all duration-300"
              style={{
                background: 'linear-gradient(135deg, #1a1510 0%, #120e08 100%)',
                border: '1px solid var(--border)',
                borderRadius: '4px',
                opacity: 0,
              }}
              onMouseEnter={e => {
                const el = e.currentTarget as HTMLElement
                el.style.borderColor = color + '80'
                el.style.boxShadow = `0 0 20px ${color}20`
              }}
              onMouseLeave={e => {
                const el = e.currentTarget as HTMLElement
                el.style.borderColor = 'var(--border)'
                el.style.boxShadow = 'none'
              }}
            >
              <div className="flex items-center justify-center w-10 h-10 rounded-full shrink-0" style={{ background: `${color}18`, border: `1px solid ${color}40` }}>
                <Icon size={18} style={{ color }} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-serif font-bold text-sm mb-0.5" style={{ color: 'var(--gold-light)' }}>{label}</div>
                <div className="truncate font-mono" style={{ color: '#7a6840', fontSize: '0.625rem' }}>{sub}</div>
              </div>
              <ExternalLink size={13} className="shrink-0 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" style={{ color: '#3a2a15' }} />
            </a>
          ))}
        </div>
      </section>


    </div>
  )
}

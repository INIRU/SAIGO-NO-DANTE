'use client'

import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import {
  Globe, Youtube, XIcon, ExternalLink, Sparkles, ChevronRight, Calendar,
  Shield, Layers, Pin, ChevronDown,
  Compass, BookOpen, Trophy, Dices, Shuffle, Map,
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
  { label: '팬 디스코드', sub: '봇 소개 · 서버 참여',           href: '/bot',                                           icon: DiscordIcon,  color: '#5865f2' },
]

const FEATURES = [
  {
    href: '/sinners',
    icon: Shield,
    tag: 'SINNER DB',
    title: '수감자 DB',
    desc: '12인 수감자의 인격, EGO, 스킬 데이터를 한 곳에서.',
    accent: '#c8900a',
  },
  {
    href: '/decks',
    icon: Layers,
    tag: 'DECK BOARD',
    title: '덱 게시판',
    desc: '커뮤니티 덱 빌드를 탐색하고 나만의 덱을 등록.',
    accent: '#4898b0',
  },
  {
    href: '/mirror-dungeon',
    icon: Compass,
    tag: 'MIRROR DUNGEON',
    title: '거울 던전',
    desc: 'EGO 기프트 도감, 키워드 필터, 조합 레시피.',
    accent: '#8058a8',
  },
  {
    href: '/collection',
    icon: BookOpen,
    tag: 'COLLECTION',
    title: '보유 현황',
    desc: '나의 인격·EGO 체크리스트, URL로 공유.',
    accent: '#d4b830',
  },
  {
    href: '/tier-list',
    icon: Trophy,
    tag: 'TIER LIST',
    title: '티어표',
    desc: '커뮤니티 투표 기반 리세마라 티어 랭킹.',
    accent: '#d06030',
  },
  {
    href: '/extraction',
    icon: Dices,
    tag: 'EXTRACTION SIM',
    title: '추출 시뮬',
    desc: '뽑기 확률 시뮬레이션으로 운명을 시험.',
    accent: '#c83030',
  },
  {
    href: '/random',
    icon: Shuffle,
    tag: 'RANDOM COMP',
    title: '랜덤 편성',
    desc: '슬롯머신 UI로 무작위 편성, 키워드 필터.',
    accent: '#3870b0',
  },
  {
    href: '/planner',
    icon: Map,
    tag: 'DUNGEON PLANNER',
    title: '거던 플래너',
    desc: '층별 테마팩 선택, 전략 시뮬레이션.',
    accent: '#8b1a1a',
  },
]

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
          <Image src={pending.url} alt="" fill placeholder="blur" blurDataURL={BLUR_PLACEHOLDER} className="object-cover object-top" sizes="(max-width: 768px) 100vw, 62vw" quality={90} />
        </div>
      )}
      {/* Layer A: 현재 이미지 (글리치 시 위에서 사라짐) */}
      <div ref={layerARef} className="absolute inset-0" style={{ zIndex: 10 }}>
        <Image src={current.url} alt={current.identity.name_kr} fill priority placeholder="blur" blurDataURL={BLUR_PLACEHOLDER} className="object-cover object-top" sizes="(max-width: 768px) 100vw, 62vw" quality={90} />
        {/* RGB Chromatic Aberration 오버레이 (전환 시 GSAP 제어) */}
        <div ref={chromaRRef} className={heroStyles.chromaR} style={{ zIndex: 2 }}>
          <Image src={current.url} alt="" fill loading="lazy" className="object-cover object-top" style={{ filter: 'grayscale(1)' }} sizes="(max-width: 768px) 100vw, 62vw" quality={60} />
        </div>
        <div ref={chromaBRef} className={heroStyles.chromaB} style={{ zIndex: 2 }}>
          <Image src={current.url} alt="" fill loading="lazy" className="object-cover object-top" style={{ filter: 'grayscale(1)' }} sizes="(max-width: 768px) 100vw, 62vw" quality={60} />
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

        // 기능 카드 그리드
        gsap.fromTo('.feature-card',
          { opacity: 0, y: 30 },
          { opacity: 1, y: 0, duration: 0.5, stagger: 0.08, ease: 'power2.out',
            scrollTrigger: { trigger: '.features-section', start: 'top 80%' } }
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

          <p className="hero-subtitle text-lg mb-4 tracking-wider" style={{ color: 'rgba(232,196,120,0.5)', opacity: 0, fontWeight: 300 }}>
            <span style={{ fontFamily: "'Song Myung', Georgia, serif", fontStyle: 'italic' }}>Limbus Company</span>{' '}
            <span className="font-serif">팬 아카이브</span>
          </p>

          {/* 현재 슬라이드 인격 정보 */}
          {heroIdentity && (
            <div className="hero-desc mb-8" style={{ opacity: 0 }}>
              <div className="flex items-center gap-2 flex-wrap">
                <RarityIcon rarity={heroIdentity.rarity} />
                <span className="font-serif font-bold" style={{ color: 'var(--gold-light)', fontSize: '0.9375rem' }}>
                  {heroIdentity.name_kr}
                </span>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.6875rem', fontFamily: 'var(--font-title)' }}>
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
            <Link
              href="/planner/community"
              className="px-5 md:px-8 py-2.5 md:py-3 text-sm md:text-base font-medium transition-all duration-300 hover:scale-105"
              style={{ border: '1px solid #4898b0', color: '#4898b0', borderRadius: '4px' }}
            >
              거던 플래너
            </Link>
            <Link
              href="/bot"
              className="flex items-center gap-2 px-5 md:px-8 py-2.5 md:py-3 text-sm md:text-base font-medium transition-all duration-300 hover:scale-105"
              style={{ border: '1px solid #5865f2', color: '#7289da', borderRadius: '4px' }}
            >
              <DiscordIcon size={16} />
              디스코드 봇
            </Link>
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
                className="font-serif font-light"
                style={{ color: 'var(--gold-light)', fontSize: '0.875rem', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
              >
                {pinnedAnnouncement.title}
              </span>
              <span className="font-mono" style={{ color: 'var(--text-muted)', fontSize: '0.625rem', flexShrink: 0 }}>
                {formatDate(pinnedAnnouncement.created_at)}
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
                  color: 'var(--text-muted)',
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
                  color: 'var(--text-tertiary)',
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
          className="relative max-w-5xl mx-auto px-6 py-20"
          style={{ isolation: 'isolate' }}
        >
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
                <h2 className="font-serif text-4xl font-medium tracking-wide" style={{ color: 'var(--gold-light)' }}>
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

            {/* 풀 폭 영상 */}
            <div
              style={{
                position: 'relative',
                paddingTop: '56.25%',
                borderRadius: '0.25rem',
                overflow: 'hidden',
                border: '1px solid var(--border)',
                boxShadow: '0 0.5rem 2.5rem rgba(0,0,0,0.6)',
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

            {/* 하단 메타 바 */}
            <div
              className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 mt-4"
              style={{ padding: '0.75rem 0' }}
            >
              {/* 채널 배지 */}
              <div className="flex items-center gap-2.5 shrink-0">
                <div
                  className="flex items-center justify-center rounded-full shrink-0"
                  style={{ width: '1.75rem', height: '1.75rem', background: 'rgba(200,48,48,0.12)', border: '1px solid rgba(200,48,48,0.3)' }}
                >
                  <Youtube size={13} style={{ color: '#c83030' }} />
                </div>
                <span className="font-serif text-sm" style={{ color: 'var(--text-secondary)' }}>
                  Project Moon
                </span>
              </div>

              {/* 구분점 (데스크탑) */}
              <span className="hidden sm:block" style={{ color: 'var(--text-muted)', fontSize: '0.5rem' }}>●</span>

              {/* 영상 제목 */}
              <a
                href={`https://www.youtube.com/watch?v=${latestVideo.videoId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-serif font-light leading-snug hover:text-yellow-300 transition-colors flex-1 min-w-0 truncate"
                style={{ color: 'var(--gold-light)', fontSize: '0.9375rem' }}
              >
                {latestVideo.title}
              </a>

              {/* 출판일 */}
              {latestVideo.publishedAt && (
                <div className="flex items-center gap-1.5 shrink-0" style={{ color: 'var(--text-muted)' }}>
                  <Calendar size={10} />
                  <span className="font-mono" style={{ fontSize: '0.625rem' }}>
                    {formatDate(latestVideo.publishedAt.slice(0, 10))}
                  </span>
                </div>
              )}
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
                <h2 className="font-serif text-4xl font-medium tracking-wide" style={{ color: 'var(--gold-light)' }}>최신 인격</h2>
              </div>
              {latestDate && (
                <div className="flex items-center gap-1.5 mb-1" style={{ color: 'var(--text-muted)' }}>
                  <Calendar size={11} />
                  <span className="font-mono" style={{ fontSize: '0.6875rem' }}>{formatDate(latestDate)}</span>
                </div>
              )}
            </div>

            <div className="divider-gold mb-10" />

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {latestIdentities.map((identity) => {
                const portraitUrl   = getIdentityInfoUrl(identity)
                const logoUrl       = getSinnerLogoUrl(identity.sinner_id)
                const rarityIconSrc = RARITY_ICON_MAP[identity.rarity]
                return (
                  <Link key={identity.id} href={`/sinners/${identity.sinner_id}/identities/${identity.id}`} className="latest-card group block" style={{ opacity: 0 }}>
                    <div
                      className="relative overflow-hidden"
                      style={{ aspectRatio: '3/4', background: 'linear-gradient(160deg, #1e1810 0%, #120e08 100%)', border: '1px solid var(--border)', borderRadius: '0.25rem', transition: 'border-color 0.25s, box-shadow 0.25s' }}
                      onMouseEnter={e => {
                        e.currentTarget.style.borderColor = 'var(--gold-dim)'
                        e.currentTarget.style.boxShadow = '0 0 1.25rem rgba(200,144,10,0.2), inset 0 0 1.25rem rgba(200,144,10,0.05)'
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
                          <span className="font-serif font-light" style={{ fontSize: '2.5rem', color: 'rgba(200,144,10,0.08)' }}>
                            {identity.name_kr?.[0] ?? '?'}
                          </span>
                        </div>
                      )}
                      <div className="absolute top-2 left-2 z-10">
                        <Image src={logoUrl} alt="" width={20} height={20} style={{ filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.8))', opacity: 0.75 }} />
                      </div>
                      {rarityIconSrc && (
                        <div className="absolute top-2 right-2 z-10">
                          <Image src={rarityIconSrc} alt={`${identity.rarity}성`} width={48} height={16} unoptimized style={{ height: '0.6875rem', width: 'auto', objectFit: 'contain' }} />
                        </div>
                      )}
                      <div className="absolute bottom-0 left-0 right-0 z-10" style={{ height: '60%', background: 'linear-gradient(to top, rgba(13,11,8,1) 0%, rgba(13,11,8,0.85) 40%, rgba(13,11,8,0.2) 75%, transparent 100%)' }} />
                      <div className="absolute bottom-0 left-0 right-0 px-2 pb-2 z-20">
                        <div className="font-serif font-light leading-tight group-hover:text-yellow-300 transition-colors" style={{ color: 'var(--gold-light)', fontSize: '0.8125rem' }}>
                          {identity.name_kr}
                        </div>
                        <div className="flex items-center gap-1" style={{ marginTop: '0.125rem' }}>
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.5625rem', fontFamily: 'var(--font-title)' }}>
                            {identity.sinner?.name_kr ?? identity.sinner_id}
                          </span>
                          {identity.release_date && (
                            <>
                              <span style={{ color: '#3a2a15', fontSize: '0.375rem' }}>·</span>
                              <span className="font-mono" style={{ color: '#3a2a15', fontSize: '0.5rem' }}>
                                {formatDate(identity.release_date)}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </Link>
                )
              })}
            </div>

            <div className="mt-12 flex justify-center">
              <Link
                href="/sinners"
                className="flex items-center gap-2 font-serif text-sm transition-all"
                style={{
                  color: 'var(--gold-dim)',
                  border: '1px solid var(--gold-dim)',
                  padding: '0.5rem 1.5rem',
                  borderRadius: '0.125rem',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.borderColor = 'var(--gold)'
                  e.currentTarget.style.color = 'var(--gold-light)'
                  e.currentTarget.style.background = 'rgba(200,144,10,0.05)'
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.borderColor = 'var(--gold-dim)'
                  e.currentTarget.style.color = 'var(--gold-dim)'
                  e.currentTarget.style.background = 'transparent'
                }}
              >
                전체 수감자 보기
                <ChevronRight size={14} />
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* ── 기능 소개 (카드 그리드) ──────────────────────────── */}
      <section className="features-section max-w-7xl mx-auto px-6 py-16">
        <div className="flex items-center gap-4 mb-10">
          <div className="divider-gold flex-1" />
          <span className="font-mono shrink-0" style={{ color: '#3a2a15', fontSize: '0.625rem', letterSpacing: '0.4em' }}>
            FEATURES
          </span>
          <div className="divider-gold flex-1" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {FEATURES.map((feature) => {
            const Icon = feature.icon
            return (
              <Link
                key={feature.href}
                href={feature.href}
                className="feature-card group relative block"
                style={{
                  opacity: 0,
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border)',
                  borderRadius: '0.25rem',
                  padding: '1.5rem',
                  minHeight: '10rem',
                  transition: 'border-color 0.25s, box-shadow 0.25s, background 0.25s',
                }}
                onMouseEnter={e => {
                  const el = e.currentTarget
                  el.style.borderColor = `${feature.accent}50`
                  el.style.boxShadow = `0 0 1.5rem ${feature.accent}15, inset 0 0 1.5rem ${feature.accent}08`
                  el.style.background = `linear-gradient(135deg, ${feature.accent}08 0%, var(--bg-card) 60%)`
                }}
                onMouseLeave={e => {
                  const el = e.currentTarget
                  el.style.borderColor = 'var(--border)'
                  el.style.boxShadow = 'none'
                  el.style.background = 'var(--bg-card)'
                }}
              >
                {/* 아이콘 */}
                <div
                  className="flex items-center justify-center rounded-full"
                  style={{
                    width: '2.5rem',
                    height: '2.5rem',
                    background: `${feature.accent}12`,
                    border: `1px solid ${feature.accent}30`,
                    marginBottom: '1rem',
                    transition: 'background 0.25s, border-color 0.25s',
                  }}
                >
                  <Icon
                    size={18}
                    style={{ color: feature.accent, opacity: 0.8, transition: 'opacity 0.25s' }}
                  />
                </div>

                {/* 태그 */}
                <div
                  className="font-mono"
                  style={{
                    fontSize: '0.5625rem',
                    letterSpacing: '0.3em',
                    color: feature.accent,
                    opacity: 0.5,
                    marginBottom: '0.25rem',
                  }}
                >
                  {feature.tag}
                </div>

                {/* 타이틀 */}
                <div
                  className="font-serif font-light"
                  style={{
                    fontSize: '1.0625rem',
                    color: 'var(--gold)',
                    marginBottom: '0.25rem',
                    transition: 'color 0.25s',
                  }}
                >
                  {feature.title}
                </div>

                {/* 설명 */}
                <div
                  style={{
                    fontSize: '0.75rem',
                    color: 'var(--text-tertiary)',
                    fontFamily: 'var(--font-body)',
                    lineHeight: 1.5,
                  }}
                >
                  {feature.desc}
                </div>

                {/* 쉐브론 */}
                <ChevronRight
                  size={14}
                  className="absolute transition-all group-hover:translate-x-0.5"
                  style={{
                    bottom: '1rem',
                    right: '1rem',
                    color: '#3a2a15',
                  }}
                />
              </Link>
            )
          })}
        </div>
      </section>

      {/* ── 공식 채널 ──────────────────────────────────────────── */}
      <section className="official-section max-w-7xl mx-auto px-6 pb-16">
        <div className="flex items-center gap-4 mb-10">
          <div className="divider-gold flex-1" />
          <span className="font-mono shrink-0" style={{ color: '#3a2a15', fontSize: '0.625rem', letterSpacing: '0.4em' }}>OFFICIAL</span>
          <div className="divider-gold flex-1" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {OFFICIAL_LINKS.map(({ label, sub, href, icon: Icon, color }) => {
            const isInternal = href.startsWith('/')
            const linkProps = isInternal ? {} : { target: '_blank' as const, rel: 'noopener noreferrer' }
            const Wrapper = isInternal ? Link : 'a'
            return (
              <Wrapper
                key={href}
                href={href}
                {...linkProps}
                className="official-link-card group relative flex flex-col items-center text-center transition-all duration-300"
                style={{
                  background: 'linear-gradient(160deg, #1a1510 0%, #120e08 100%)',
                  border: '1px solid var(--border)',
                  borderRadius: '0.25rem',
                  padding: '1.5rem',
                  minHeight: '9rem',
                  opacity: 0,
                }}
                onMouseEnter={e => {
                  const el = e.currentTarget as HTMLElement
                  el.style.borderColor = color + '60'
                  el.style.boxShadow = `0 0 1.25rem ${color}15`
                }}
                onMouseLeave={e => {
                  const el = e.currentTarget as HTMLElement
                  el.style.borderColor = 'var(--border)'
                  el.style.boxShadow = 'none'
                }}
              >
                <div
                  className="flex items-center justify-center rounded-full"
                  style={{
                    width: '2.5rem',
                    height: '2.5rem',
                    background: `${color}18`,
                    border: `1px solid ${color}40`,
                    marginBottom: '1rem',
                  }}
                >
                  <Icon size={18} style={{ color }} />
                </div>
                <div className="font-serif font-light text-sm mb-1" style={{ color: 'var(--gold-light)' }}>{label}</div>
                <div className="truncate font-mono w-full" style={{ color: 'var(--text-muted)', fontSize: '0.625rem' }}>{sub}</div>
                <ExternalLink
                  size={12}
                  className="absolute transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                  style={{ bottom: '0.75rem', right: '0.75rem', color: '#3a2a15' }}
                />
              </Wrapper>
            )
          })}
        </div>

        {/* 마무리 */}
        <div className="mt-14 flex flex-col items-center gap-3">
          <div className="divider-gold" style={{ maxWidth: '12rem' }} />
          <span className="font-logo tracking-widest" style={{ color: 'var(--gold-dim)', fontSize: '1.125rem', opacity: 0.4, letterSpacing: '0.3em' }}>
            SAIGO NO DANTE
          </span>
          <span className="font-mono" style={{ color: 'var(--text-muted)', fontSize: '0.5625rem', opacity: 0.3 }}>
            Limbus Company 팬 아카이브
          </span>
        </div>
      </section>

    </div>
  )
}

'use client'

import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { XIcon, Pin, ChevronDown } from 'lucide-react'

import GlitchText from '@/components/ui/GlitchText'
import heroStyles from '@/styles/components/HeroGlitch.module.css'
import {
  IdentityWithSinner,
  getSinnerLogoUrl, getIdentityInfoUrl,
  RARITY_ICON_MAP, BLUR_PLACEHOLDER,
} from '@/lib/data/sinners'

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
      style={{ objectFit: 'contain', height: '12px', width: 'auto' }}
    />
  )
}

// ── 히어로 글리치 슬라이더 ────────────────────────────────────────────────

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

  // 켄번즈 효과 — 슬라이드마다 천천히 줌인
  useEffect(() => {
    const el = layerARef.current
    if (!el) return
    let ctx: any
    ;(async () => {
      const { gsap } = await import('gsap')
      gsap.killTweensOf(el)
      ctx = gsap.context(() => {
        gsap.fromTo(el,
          { scale: 1, x: '0%', y: '0%' },
          { scale: 1.06, x: '-1%', y: '-0.8%', duration: 8, ease: 'none', transformOrigin: 'right center' }
        )
      })
    })()
    return () => { ctx?.revert() }
  }, [currentIdx])

  // 글리치 전환
  const glitchTo = useCallback(async (nextIdx: number) => {
    if (isTransitionRef.current || slides.length < 2) return
    isTransitionRef.current = true
    setPendingIdx(nextIdx)

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

  // 자동 슬라이드
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
    <div ref={sliderRef} className="absolute inset-0 md:inset-y-0 md:left-auto md:right-0 w-full md:w-[62%] overflow-hidden" style={{ zIndex: 1 }}>
      {/* Layer B: 다음 이미지 (아래) */}
      {pending && (
        <div className="absolute inset-0" style={{ zIndex: 5 }}>
          <Image src={pending.url} alt="" fill placeholder="blur" blurDataURL={BLUR_PLACEHOLDER} className="object-cover object-top" sizes="(max-width: 768px) 100vw, 62vw" quality={90} />
        </div>
      )}
      {/* Layer A: 현재 이미지 (글리치 시 위에서 사라짐) */}
      <div ref={layerARef} className="absolute inset-0" style={{ zIndex: 10 }}>
        <Image src={current.url} alt={current.identity.name_kr} fill priority placeholder="blur" blurDataURL={BLUR_PLACEHOLDER} className="object-cover object-top" sizes="(max-width: 768px) 100vw, 62vw" quality={90} />
        {/* RGB Chromatic Aberration 오버레이 */}
        <div ref={chromaRRef} className={heroStyles.chromaR} style={{ zIndex: 2 }}>
          <Image src={current.url} alt="" fill loading="lazy" className="object-cover object-top" style={{ filter: 'grayscale(1)' }} sizes="(max-width: 768px) 100vw, 62vw" quality={60} />
        </div>
        <div ref={chromaBRef} className={heroStyles.chromaB} style={{ zIndex: 2 }}>
          <Image src={current.url} alt="" fill loading="lazy" className="object-cover object-top" style={{ filter: 'grayscale(1)' }} sizes="(max-width: 768px) 100vw, 62vw" quality={60} />
        </div>
      </div>
      {/* 그라디언트 오버레이 */}
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

// ── Props ─────────────────────────────────────────────────────────────────

type YoutubeIconVideo = { videoId: string; title: string; publishedAt: string }
type Announcement = { id: string; title: string; content: string; pinned: boolean; created_at: string }

export default function HomeClient({
  latestIdentities,
  pinnedAnnouncement,
}: {
  latestIdentities: IdentityWithSinner[]
  latestVideo?: YoutubeIconVideo | null
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

  // GSAP scroll animations — target classes on server-rendered below-fold sections
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

        // 최신 인격 카드 — targets server-rendered .latest-card elements
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
    <>
      {/* ── 히어로 ─────────────────────────────────────────────── */}
      <section
        ref={heroRef}
        className="relative overflow-hidden flex"
        style={{ minHeight: pinnedAnnouncement && !announcementDismissed ? 'calc(100dvh - 48px)' : '100dvh', background: 'var(--bg-deep)' }}
      >
        {/* 글리치 슬라이더 (최신 인격 풀 일러스트) */}
        {heroIdentities.length > 0 && (
          <HeroGlitchSlider identities={heroIdentities} onSlideChange={handleSlideChange} />
        )}

        {/* 이미지 없을 때 ambient glow */}
        {heroIdentities.length === 0 && (
          <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse at 50% 40%, rgba(200,164,90,0.08) 0%, transparent 60%)' }} />
        )}

        {/* 수감자 아이콘 워터마크 */}
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
        <div
          className="relative z-10 flex flex-col justify-center px-6 md:px-16 lg:px-24 max-w-xl"
          style={{ minHeight: pinnedAnnouncement && !announcementDismissed ? 'calc(100dvh - 48px)' : '100dvh' }}
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
    </>
  )
}

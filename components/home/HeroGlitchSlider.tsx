'use client'

import { useEffect, useRef, useState, useCallback, useMemo, type CSSProperties } from 'react'
import Image from 'next/image'

import heroStyles from '@/styles/components/HeroGlitch.module.css'
import { type IdentityWithSinner, getIdentityInfoUrl, BLUR_PLACEHOLDER } from '@/lib/data/sinners'
import { getBlurDataURL } from '@/lib/utils/thumbhash'
import { useLocale } from 'next-intl'

type HeroSlide = { url: string; identity: IdentityWithSinner; gacksung: boolean }
type ProbeImage = HTMLImageElement & { fetchPriority?: 'high' | 'low' | 'auto' }
type GsapModule = typeof import('gsap')

interface HeroGlitchSliderProps {
  identities: IdentityWithSinner[]
  onSlideChange: (identity: IdentityWithSinner) => void
}

let gsapModulePromise: Promise<GsapModule> | null = null

function loadGsap() {
  gsapModulePromise ??= import('gsap')
  return gsapModulePromise
}

function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function requestIdle(callback: () => void) {
  if ('requestIdleCallback' in window) {
    const id = window.requestIdleCallback(callback, { timeout: 4000 })
    return () => window.cancelIdleCallback(id)
  }

  const id = globalThis.setTimeout(callback, 1200)
  return () => globalThis.clearTimeout(id)
}

export default function HeroGlitchSlider({ identities, onSlideChange }: HeroGlitchSliderProps) {
  const locale = useLocale()

  const getName = (kr?: string | null, en?: string | null, jp?: string | null): string => {
    if (locale === 'en') return en ?? kr ?? ''
    if (locale === 'ja') return jp ?? kr ?? ''
    return kr ?? ''
  }

  const [validGacksung, setValidGacksung] = useState<Set<string>>(new Set())
  const [currentIdx, setCurrentIdx]       = useState(0)
  const [pendingIdx, setPendingIdx]       = useState<number | null>(null)
  const layerARef        = useRef<HTMLDivElement>(null)
  const pendingLayerRef  = useRef<HTMLDivElement>(null)
  const chromaRRef       = useRef<HTMLDivElement>(null)
  const chromaBRef       = useRef<HTMLDivElement>(null)
  const scanlineRef      = useRef<HTMLDivElement>(null)
  const sliderRef        = useRef<HTMLDivElement>(null)
  const isTransitionRef  = useRef(false)
  const advanceRef       = useRef<() => void>(() => {})
  const kenBurnsCtxRef   = useRef<ReturnType<typeof import('gsap')['gsap']['context']> | null>(null)
  const glitchTlRef      = useRef<ReturnType<typeof import('gsap')['gsap']['timeline']> | null>(null)

  // 각성 이미지 존재 여부 확인 (404 → 스킵). Idle 이후 한 장씩 확인해 홈 초기 네트워크를 막지 않는다.
  useEffect(() => {
    let cancelled = false
    let cleanupIdle: (() => void) | undefined
    let img: ProbeImage | undefined
    const candidates = identities
      .map(identity => ({ identity, url: getIdentityInfoUrl(identity, true) }))
      .filter((entry): entry is { identity: IdentityWithSinner; url: string } => Boolean(entry.url))

    const probeNext = (index: number) => {
      if (cancelled || index >= candidates.length) return

      cleanupIdle = requestIdle(() => {
        if (cancelled) return
        const candidate = candidates[index]
        img = new window.Image() as ProbeImage
        img.decoding = 'async'
        img.fetchPriority = 'low'
        img.onload = () => {
          if (!cancelled) setValidGacksung(prev => new Set([...prev, candidate.identity.id]))
          probeNext(index + 1)
        }
        img.onerror = () => probeNext(index + 1)
        img.src = candidate.url
      })
    }

    probeNext(0)

    return () => {
      cancelled = true
      cleanupIdle?.()
      if (img) {
        img.onload = null
        img.onerror = null
        img.src = ''
      }
    }
  }, [identities])

  // 첫 상호작용에서 GSAP chunk를 기다리지 않도록 idle 시점에 미리 데운다.
  useEffect(() => {
    if (prefersReducedMotion()) return
    return requestIdle(() => {
      void loadGsap()
    })
  }, [])

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
    let cancelled = false
    kenBurnsCtxRef.current?.revert()
    kenBurnsCtxRef.current = null

    if (prefersReducedMotion()) {
      el.style.transform = ''
      el.style.transformOrigin = ''
      return
    }

    ;(async () => {
      const { gsap } = await loadGsap()
      if (cancelled) return

      gsap.killTweensOf(el)
      kenBurnsCtxRef.current = gsap.context(() => {
        gsap.fromTo(
          el,
          { scale: 1, x: '0%', y: '0%' },
          { scale: 1.06, x: '-1%', y: '-0.8%', duration: 8, ease: 'none', transformOrigin: 'right center' },
        )
      }, el)
    })()

    return () => {
      cancelled = true
      kenBurnsCtxRef.current?.revert()
      kenBurnsCtxRef.current = null
    }
  }, [currentIdx])

  useEffect(() => {
    return () => {
      kenBurnsCtxRef.current?.revert()
      glitchTlRef.current?.kill()
    }
  }, [])

  // 글리치 전환
  const glitchTo = useCallback(async (nextIdx: number) => {
    if (nextIdx === currentIdx || nextIdx < 0 || nextIdx >= slides.length || isTransitionRef.current || slides.length < 2) return
    isTransitionRef.current = true
    setPendingIdx(nextIdx)

    await new Promise<void>(resolve => requestAnimationFrame(() => resolve()))

    const a = layerARef.current
    const nextLayer = pendingLayerRef.current
    const rCh = chromaRRef.current
    const bCh = chromaBRef.current
    const scanline = scanlineRef.current
    if (!a) { isTransitionRef.current = false; return }

    if (prefersReducedMotion()) {
      setCurrentIdx(nextIdx)
      setPendingIdx(null)
      isTransitionRef.current = false
      return
    }

    const { gsap } = await loadGsap()
    kenBurnsCtxRef.current?.revert()
    kenBurnsCtxRef.current = null
    glitchTlRef.current?.kill()

    const resetGlitchLayers = () => {
      const glitchTargets = [a, nextLayer, rCh, bCh, scanline].filter((el): el is HTMLDivElement => Boolean(el))
      gsap.set(glitchTargets, {
        clearProps: 'clipPath,x,y,scale,filter,transform,willChange,opacity',
      })
    }

    glitchTlRef.current = gsap.timeline({
      defaults: { ease: 'steps(1)', duration: 0.026 },
      onComplete: () => {
        setCurrentIdx(nextIdx)
        requestAnimationFrame(() => {
          setPendingIdx(null)
          resetGlitchLayers()
          isTransitionRef.current = false
          glitchTlRef.current = null
        })
      },
      onInterrupt: () => {
        resetGlitchLayers()
        isTransitionRef.current = false
        glitchTlRef.current = null
      },
    })

    if (nextLayer) {
      glitchTlRef.current
        .set(nextLayer, {
          opacity: 0,
          scale: 1.018,
          filter: 'brightness(0.62) saturate(0.86)',
          willChange: 'opacity, transform, filter',
        }, 0)
        .to(nextLayer, {
          opacity: 1,
          scale: 1,
          filter: 'brightness(1) saturate(1)',
          duration: 0.222,
          ease: 'power2.out',
        }, 0.018)
    }

    if (rCh && bCh) {
      glitchTlRef.current
        .set([rCh, bCh], { opacity: 0.82, clipPath: 'inset(0 0 0 0)', willChange: 'opacity, transform, clip-path' }, 0)
        .to(rCh, { x: '-0.42rem', y: '-0.04rem' }, 0)
        .to(bCh, { x: '0.46rem', y: '0.04rem' }, 0)
        .to(rCh, { x: '0.34rem', y: 0, clipPath: 'inset(43% 0 34% 0)' }, 0.052)
        .to(bCh, { x: '-0.38rem', y: 0, clipPath: 'inset(9% 0 78% 0)' }, 0.052)
        .to(rCh, { x: '-0.2rem', clipPath: 'inset(70% 0 10% 0)' }, 0.112)
        .to(bCh, { x: '0.24rem', clipPath: 'inset(24% 0 58% 0)' }, 0.112)
        .to([rCh, bCh], { opacity: 0, x: 0, y: 0, duration: 0.052 }, 0.188)
    }

    if (scanline) {
      glitchTlRef.current
        .set(scanline, { opacity: 0, x: '-0.75rem', willChange: 'opacity, transform' }, 0)
        .to(scanline, { opacity: 0.42, x: '0.22rem', duration: 0.046, ease: 'power1.out' }, 0.034)
        .to(scanline, { opacity: 0.18, x: '0.68rem', duration: 0.05, ease: 'power1.inOut' }, 0.104)
        .to(scanline, { opacity: 0, x: '1rem', duration: 0.048, ease: 'power1.in' }, 0.172)
    }

    glitchTlRef.current
      .set(a, { willChange: 'clip-path, transform, filter' }, 0)
      .to(a, { clipPath: 'inset(8% 0 78% 0)', x: '-0.32rem', y: '-0.04rem', filter: 'brightness(1.65) contrast(1.12)' }, 0)
      .to(a, { clipPath: 'inset(47% 0 32% 0)', x: '0.42rem', y: 0, filter: 'hue-rotate(56deg) brightness(1.28)' }, 0.046)
      .to(a, { clipPath: 'inset(5% 0 84% 0)', x: '-0.24rem', y: '0.03rem', filter: 'brightness(2.05) saturate(1.18)' }, 0.092)
      .to(a, { clipPath: 'inset(69% 0 11% 0)', x: '0.3rem', y: 0, filter: 'hue-rotate(-42deg) brightness(1.22)' }, 0.136)
      .to(a, { clipPath: 'inset(26% 0 57% 0)', x: '-0.18rem', y: '-0.02rem', filter: 'brightness(1.46)' }, 0.176)
      .to(a, { clipPath: 'inset(0 0 100% 0)', x: 0, y: 0, filter: 'none', duration: 0.044 }, 0.212)
  }, [currentIdx, slides.length])

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
  const chromaImageStyle = useMemo(() => ({
    '--hero-glitch-image': `url("${current?.url.replace(/"/g, '\\"') ?? ''}")`,
  }) as CSSProperties, [current?.url])

  if (!current) return null

  return (
    <div
      ref={sliderRef}
      className="absolute inset-0 md:inset-y-0 md:left-auto md:right-0 w-full md:w-[62%] overflow-hidden"
      style={{ zIndex: 1 }}
    >
      {/* Layer B: 다음 이미지 (아래) */}
      {pending && (
        <div ref={pendingLayerRef} className={heroStyles.pendingLayer}>
          <Image
            src={pending.url}
            alt=""
            fill
            placeholder="blur"
            blurDataURL={getBlurDataURL(pending.url) ?? BLUR_PLACEHOLDER}
            className="object-cover object-top"
            sizes="(max-width: 768px) 100vw, 62vw"
            quality={90}
          />
        </div>
      )}
      {/* Layer A: 현재 이미지 (글리치 시 위에서 사라짐) */}
      <div ref={layerARef} className="absolute inset-0" style={{ zIndex: 10 }}>
        <Image
          src={current.url}
          alt={getName(current.identity.name_kr, current.identity.name_en, current.identity.name_jp)}
          fill
          preload
          placeholder="blur"
          blurDataURL={getBlurDataURL(current.url) ?? BLUR_PLACEHOLDER}
          className="object-cover object-top"
          sizes="(max-width: 768px) 100vw, 62vw"
          quality={90}
        />
        {/* RGB Chromatic Aberration 오버레이 */}
        <div ref={chromaRRef} className={heroStyles.chromaR} style={chromaImageStyle} />
        <div ref={chromaBRef} className={heroStyles.chromaB} style={chromaImageStyle} />
      </div>
      <div ref={scanlineRef} className={heroStyles.scanline} />
      {/* 그라디언트 오버레이 */}
      <div
        className="absolute pointer-events-none"
        style={{ inset: '-1px', zIndex: 15, background: 'linear-gradient(to right, var(--bg-deep) 0%, rgba(13,11,8,0.9) 25%, rgba(13,11,8,0.5) 55%, transparent 85%)' }}
      />
      <div
        className="absolute pointer-events-none md:hidden"
        style={{ inset: '-1px', zIndex: 15, background: 'linear-gradient(to right, rgba(13,11,8,0.95) 0%, rgba(13,11,8,0.7) 50%, rgba(13,11,8,0.3) 100%)' }}
      />
      <div
        className="absolute pointer-events-none"
        style={{ inset: '-1px', zIndex: 15, background: 'linear-gradient(to top, var(--bg-deep) 0%, transparent 30%)' }}
      />
      {/* 슬라이드 인디케이터 */}
      {slides.length > 1 && (
        <div className="absolute bottom-5 right-5 flex gap-2" style={{ zIndex: 20 }}>
          {slides.map((s, i) => (
            <button
              key={i}
              onClick={() => glitchTo(i)}
              aria-label={`${getName(s.identity.name_kr, s.identity.name_en, s.identity.name_jp)}${s.gacksung ? ' 각성' : ''} 슬라이드 보기`}
              aria-current={i === currentIdx ? 'true' : undefined}
              className={`${heroStyles.indicator} ${i === currentIdx ? heroStyles.indicatorActive : ''}`}
              title={`${getName(s.identity.name_kr, s.identity.name_en, s.identity.name_jp)}${s.gacksung ? ' 각성' : ''}`}
            />
          ))}
        </div>
      )}
    </div>
  )
}

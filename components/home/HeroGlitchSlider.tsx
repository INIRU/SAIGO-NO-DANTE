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
  const glitchSliceRef   = useRef<HTMLDivElement>(null)
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
    const glitchSlice = glitchSliceRef.current
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
    const frozenTransform = window.getComputedStyle(a).transform
    const frozenTransformOrigin = window.getComputedStyle(a).transformOrigin
    gsap.killTweensOf(a)
    if (frozenTransform && frozenTransform !== 'none') {
      gsap.set(a, { transform: frozenTransform, transformOrigin: frozenTransformOrigin })
    }
    kenBurnsCtxRef.current = null
    glitchTlRef.current?.kill()

    const resetGlitchLayers = () => {
      const glitchTargets = [a, nextLayer, glitchSlice, rCh, bCh, scanline].filter((el): el is HTMLDivElement => Boolean(el))
      gsap.set(glitchTargets, {
        clearProps: 'clipPath,x,y,scale,filter,transform,willChange,opacity,visibility',
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
          autoAlpha: 0,
          scale: 1.018,
          filter: 'brightness(0.62) saturate(0.86)',
          willChange: 'opacity, transform, filter',
        }, 0)
        .to(nextLayer, {
          autoAlpha: 1,
          scale: 1,
          filter: 'brightness(1) saturate(1)',
          duration: 0.064,
          ease: 'power3.out',
        }, 0.246)
    }

    if (glitchSlice) {
      glitchTlRef.current
        .set(glitchSlice, {
          autoAlpha: 0,
          x: 0,
          y: 0,
          scale: 1,
          clipPath: 'inset(0 0 100% 0)',
          filter: 'brightness(1) contrast(1) saturate(1)',
          willChange: 'opacity, transform, clip-path, filter',
        }, 0)
        .to(glitchSlice, {
          autoAlpha: 0.92,
          x: '-0.64rem',
          y: '-0.03rem',
          clipPath: 'inset(8% 0 77% 0)',
          filter: 'brightness(1.74) contrast(1.24) saturate(0.92)',
        }, 0)
        .to(glitchSlice, {
          autoAlpha: 0.78,
          x: '0.52rem',
          y: '0.04rem',
          clipPath: 'inset(39% 0 43% 0)',
          filter: 'brightness(0.84) contrast(1.42) saturate(1.18)',
        }, 0.034)
        .to(glitchSlice, {
          autoAlpha: 0.86,
          x: '-0.38rem',
          y: 0,
          clipPath: 'inset(3% 0 88% 0)',
          filter: 'brightness(2.1) contrast(1.18) saturate(0.82)',
        }, 0.072)
        .to(glitchSlice, {
          autoAlpha: 0.72,
          x: '0.42rem',
          y: '-0.02rem',
          clipPath: 'inset(61% 0 21% 0)',
          filter: 'brightness(1.08) contrast(1.52) saturate(1.1)',
        }, 0.108)
        .to(glitchSlice, {
          autoAlpha: 0.88,
          x: '-0.72rem',
          y: '0.03rem',
          clipPath: 'inset(23% 0 62% 0)',
          filter: 'brightness(1.56) contrast(1.32) saturate(0.9)',
        }, 0.148)
        .to(glitchSlice, {
          autoAlpha: 0.62,
          x: '0.28rem',
          y: 0,
          clipPath: 'inset(72% 0 9% 0)',
          filter: 'brightness(0.96) contrast(1.62) saturate(1.16)',
        }, 0.188)
        .to(glitchSlice, {
          autoAlpha: 0.46,
          x: '-0.18rem',
          clipPath: 'inset(17% 0 73% 0)',
          filter: 'brightness(1.86) contrast(1.2) saturate(0.92)',
        }, 0.224)
        .to(glitchSlice, {
          autoAlpha: 0,
          x: 0,
          y: 0,
          clipPath: 'inset(0 0 100% 0)',
          filter: 'brightness(1) contrast(1) saturate(1)',
          duration: 0.054,
          ease: 'power1.in',
        }, 0.254)
    }

    if (rCh && bCh) {
      glitchTlRef.current
        .set([rCh, bCh], { opacity: 0.62, clipPath: 'inset(0 0 0 0)', willChange: 'opacity, transform, clip-path' }, 0)
        .to(rCh, { x: '-0.3rem', y: '-0.03rem' }, 0)
        .to(bCh, { x: '0.34rem', y: '0.03rem' }, 0)
        .to(rCh, { x: '0.26rem', y: 0, clipPath: 'inset(43% 0 34% 0)' }, 0.052)
        .to(bCh, { x: '-0.28rem', y: 0, clipPath: 'inset(9% 0 78% 0)' }, 0.052)
        .to(rCh, { x: '-0.16rem', clipPath: 'inset(70% 0 10% 0)' }, 0.112)
        .to(bCh, { x: '0.2rem', clipPath: 'inset(24% 0 58% 0)' }, 0.112)
        .to([rCh, bCh], { opacity: 0.28, x: 0, y: 0, duration: 0.05 }, 0.188)
        .to(rCh, { opacity: 0.22, x: '-0.12rem', clipPath: 'inset(31% 0 47% 0)', duration: 0.026 }, 0.232)
        .to(bCh, { opacity: 0.22, x: '0.14rem', clipPath: 'inset(52% 0 27% 0)', duration: 0.026 }, 0.232)
        .to([rCh, bCh], { opacity: 0, x: 0, duration: 0.066 }, 0.268)
    }

    if (scanline) {
      glitchTlRef.current
        .set(scanline, { opacity: 0, x: '-0.75rem', willChange: 'opacity, transform' }, 0)
        .to(scanline, { opacity: 0.42, x: '0.22rem', duration: 0.046, ease: 'power1.out' }, 0.034)
        .to(scanline, { opacity: 0.18, x: '0.68rem', duration: 0.05, ease: 'power1.inOut' }, 0.104)
        .to(scanline, { opacity: 0.08, x: '1rem', duration: 0.052, ease: 'power1.in' }, 0.172)
        .to(scanline, { opacity: 0.26, x: '-0.18rem', duration: 0.026, ease: 'power1.out' }, 0.224)
        .to(scanline, { opacity: 0, x: '0.72rem', duration: 0.052, ease: 'power1.in' }, 0.256)
    }

    glitchTlRef.current
      .set(a, { autoAlpha: 1, filter: 'none', willChange: 'opacity, filter' }, 0)
      .to(a, { filter: 'brightness(1.18) contrast(1.06)' }, 0.034)
      .to(a, { filter: 'brightness(0.96) contrast(1.18) saturate(0.96)' }, 0.116)
      .to(a, { filter: 'brightness(1.08) contrast(1.1)' }, 0.188)
      .to(a, { autoAlpha: 0, filter: 'brightness(0.84) contrast(1.2)', duration: 0.052, ease: 'power2.in' }, 0.246)
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
      </div>
      {/* Current 이미지 기반 글리치 오버레이: base 레이어는 full-cover로 유지한다. */}
      <div ref={glitchSliceRef} className={heroStyles.glitchSlice} style={chromaImageStyle} />
      {/* RGB Chromatic Aberration 오버레이 */}
      <div ref={chromaRRef} className={heroStyles.chromaR} style={chromaImageStyle} />
      <div ref={chromaBRef} className={heroStyles.chromaB} style={chromaImageStyle} />
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

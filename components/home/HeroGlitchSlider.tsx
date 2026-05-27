'use client'

import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import Image from 'next/image'

import { type IdentityWithSinner, getIdentityInfoUrl, BLUR_PLACEHOLDER } from '@/lib/data/sinners'
import { getBlurDataURL } from '@/lib/utils/thumbhash'
import { useLocale } from 'next-intl'

type HeroSlide = { url: string; identity: IdentityWithSinner; gacksung: boolean }
type ProbeImage = HTMLImageElement & { fetchPriority?: 'high' | 'low' | 'auto' }

interface HeroGlitchSliderProps {
  identities: IdentityWithSinner[]
  onSlideChange: (identity: IdentityWithSinner) => void
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
  const sliderRef        = useRef<HTMLDivElement>(null)
  const isTransitionRef  = useRef(false)
  const advanceRef       = useRef<() => void>(() => {})
  const kenBurnsRef      = useRef<Animation | null>(null)
  const glitchRef        = useRef<Animation | null>(null)

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
    kenBurnsRef.current?.cancel()

    if (prefersReducedMotion()) {
      el.style.transform = ''
      el.style.transformOrigin = ''
      return
    }

    el.style.transformOrigin = 'right center'
    kenBurnsRef.current = el.animate(
      [
        { transform: 'translate3d(0%, 0%, 0) scale(1)' },
        { transform: 'translate3d(-1%, -0.8%, 0) scale(1.06)' },
      ],
      { duration: 8000, easing: 'linear', fill: 'forwards' },
    )

    return () => {
      kenBurnsRef.current?.cancel()
      kenBurnsRef.current = null
    }
  }, [currentIdx])

  // 글리치 전환
  const glitchTo = useCallback(async (nextIdx: number) => {
    if (isTransitionRef.current || slides.length < 2) return
    isTransitionRef.current = true
    setPendingIdx(nextIdx)

    await new Promise(r => setTimeout(r, 16))

    const a = layerARef.current
    if (!a) { isTransitionRef.current = false; return }

    if (prefersReducedMotion()) {
      setCurrentIdx(nextIdx)
      setPendingIdx(null)
      isTransitionRef.current = false
      return
    }

    kenBurnsRef.current?.cancel()
    glitchRef.current?.cancel()
    glitchRef.current = a.animate(
      [
        { clipPath: 'inset(0 0 0 0)', transform: 'translate3d(0, 0, 0)', filter: 'none' },
        { clipPath: 'inset(12% 0 75% 0)', transform: 'translate3d(-0.4375rem, 0, 0)', filter: 'brightness(1.8)' },
        { clipPath: 'inset(50% 0 28% 0)', transform: 'translate3d(0.5625rem, 0, 0)', filter: 'hue-rotate(80deg)' },
        { clipPath: 'inset(6% 0 82% 0)', transform: 'translate3d(-0.3125rem, 0, 0)', filter: 'brightness(2.2)' },
        { clipPath: 'inset(70% 0 10% 0)', transform: 'translate3d(0.375rem, 0, 0)', filter: 'hue-rotate(-60deg)' },
        { clipPath: 'inset(28% 0 52% 0)', transform: 'translate3d(-0.5rem, 0, 0)', filter: 'brightness(1.5)' },
        { clipPath: 'inset(0 0 100% 0)', transform: 'translate3d(0, 0, 0)', filter: 'none' },
      ],
      { duration: 280, easing: 'steps(1, end)', fill: 'forwards' },
    )

    try {
      await glitchRef.current.finished
    } finally {
      setCurrentIdx(nextIdx)
      setPendingIdx(null)
      a.style.clipPath = ''
      a.style.transform = ''
      a.style.filter = ''
      isTransitionRef.current = false
    }
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
    <div
      ref={sliderRef}
      className="absolute inset-0 md:inset-y-0 md:left-auto md:right-0 w-full md:w-[62%] overflow-hidden"
      style={{ zIndex: 1 }}
    >
      {/* Layer B: 다음 이미지 (아래) */}
      {pending && (
        <div className="absolute inset-0" style={{ zIndex: 5 }}>
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
              title={`${getName(s.identity.name_kr, s.identity.name_en, s.identity.name_jp)}${s.gacksung ? ' 각성' : ''}`}
              style={{
                width: i === currentIdx ? '1.125rem' : '0.3125rem',
                height: '0.3125rem',
                borderRadius: '0.1875rem',
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

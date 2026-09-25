'use client'

import { useEffect, useRef, useState, useMemo, useCallback, type AnimationEvent, type CSSProperties } from 'react'
import Image from 'next/image'

import styles from '@/styles/components/HeroGlitch.module.css'
import { type IdentityWithSinner, getIdentityProfileUrl, BLUR_PLACEHOLDER } from '@/lib/data/sinners'
import { getBlurDataURL } from '@/lib/utils/thumbhash'
import { useLocale, useTranslations } from 'next-intl'

type HeroSlide = { url: string; identity: IdentityWithSinner; gacksung: boolean }
type Layer = { key: number; slide: HeroSlide; dur: number }
type ProbeImage = HTMLImageElement & { fetchPriority?: 'high' | 'low' | 'auto' }

interface HeroGlitchSliderProps {
  identities: IdentityWithSinner[]
  onSlideChange: (identity: IdentityWithSinner) => void
}

function requestIdle(callback: () => void) {
  if ('requestIdleCallback' in window) {
    const id = window.requestIdleCallback(callback, { timeout: 4000 })
    return () => window.cancelIdleCallback(id)
  }
  const id = globalThis.setTimeout(callback, 1200)
  return () => globalThis.clearTimeout(id)
}

// 슬라이드마다 CSS 켄번즈(1→1.06)가 타이머를 겸한다: 애니메이션이 끝나면 다음 장으로 넘어가고,
// 화면 밖·숨은 탭에서는 animation-play-state로 줌과 타이머가 함께 멈춘다.
export default function HeroGlitchSlider({ identities, onSlideChange }: HeroGlitchSliderProps) {
  const locale = useLocale()
  const t = useTranslations('home.slide')
  const getName = (kr?: string | null, en?: string | null, jp?: string | null): string => {
    if (locale === 'en') return en ?? kr ?? ''
    if (locale === 'ja') return jp ?? kr ?? ''
    return kr ?? ''
  }

  const rootRef = useRef<HTMLDivElement>(null)
  const [validGacksung, setValidGacksung] = useState<Set<string>>(new Set())

  // 각성 이미지 존재 여부 확인 (404 → 스킵). Idle 이후 한 장씩 확인해 홈 초기 네트워크를 막지 않는다.
  useEffect(() => {
    let cancelled = false
    let cleanupIdle: (() => void) | undefined
    let img: ProbeImage | undefined
    const candidates = identities
      .map(identity => ({ identity, url: getIdentityProfileUrl(identity, true) }))
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
      const normalUrl = getIdentityProfileUrl(identity, false)
      if (normalUrl) result.push({ url: normalUrl, identity, gacksung: false })
      if (validGacksung.has(identity.id)) {
        const gUrl = getIdentityProfileUrl(identity, true)
        if (gUrl) result.push({ url: gUrl, identity, gacksung: true })
      }
    })
    return result
  }, [identities, validGacksung])

  // 일반 → 같은 인격의 각성으로 이어질 때는 짧게 보여 준다.
  const durFor = useCallback(
    (s: HeroSlide) => (!s.gacksung && validGacksung.has(s.identity.id) ? 2500 : 5000),
    [validGacksung],
  )

  // [이전, 현재] 레이어. 이전 장은 켄번즈 끝 상태로 멈춘 채 새 장 아래에 남아 크로스페이드 바닥이 된다.
  const [stack, setStack] = useState<Layer[]>(() => (slides[0] ? [{ key: 0, slide: slides[0], dur: 5000 }] : []))
  const current = stack.at(-1)
  const prev = stack.length > 1 ? stack[0] : null
  const curIdx = current ? Math.max(0, slides.findIndex(s => s.url === current.slide.url)) : 0
  const upcoming = slides.length > 1 ? slides[(curIdx + 1) % slides.length] : null

  const goTo = useCallback((slide: HeroSlide) => {
    setStack(s => {
      const cur = s.at(-1)
      if (!cur || cur.slide.url === slide.url) return s
      return [cur, { key: cur.key + 1, slide, dur: durFor(slide) }]
    })
  }, [durFor])

  const currentIdentity = current?.slide.identity
  useEffect(() => {
    if (currentIdentity) onSlideChange(currentIdentity)
  }, [currentIdentity, onSlideChange])

  useEffect(() => {
    const el = rootRef.current
    if (!el) return
    let onScreen = true
    const sync = () => el.toggleAttribute('data-paused', document.hidden || !onScreen)
    const io = new IntersectionObserver(([entry]) => { onScreen = entry.isIntersecting; sync() })
    io.observe(el)
    document.addEventListener('visibilitychange', sync)
    return () => { io.disconnect(); document.removeEventListener('visibilitychange', sync) }
  }, [])

  if (!current) return null

  const onZoomEnd = (e: AnimationEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget && upcoming) goTo(upcoming)
  }

  const art = (s: HeroSlide, alt = '', first = false) => (
    <Image
      src={s.url}
      alt={alt}
      fill
      {...(first ? { preload: true } : { loading: 'eager' as const, fetchPriority: 'low' as const })}
      placeholder="blur"
      blurDataURL={getBlurDataURL(s.url) ?? BLUR_PLACEHOLDER}
      className="object-cover object-center"
      sizes="100vw"
      quality={90}
    />
  )

  const layers: (Layer & { state: 'prev' | 'current' | 'next' })[] = [
    ...(prev ? [{ ...prev, state: 'prev' as const }] : []),
    { ...current, state: 'current' as const },
    ...(upcoming ? [{ key: current.key + 1, slide: upcoming, dur: 0, state: 'next' as const }] : []),
  ]

  return (
    <div ref={rootRef} data-hero-slider className={`absolute inset-0 w-full overflow-hidden ${styles.root}`} style={{ zIndex: 1 }}>
      <div className={styles.artwork} data-hero-artwork>
        {layers.map(l => {
          const isCurrent = l.state === 'current'
          const entering = isCurrent && l.key > 0
          return (
            <div
              key={l.key}
              className={styles.layer}
              data-state={l.state}
              data-enter={entering || undefined}
              aria-hidden={isCurrent ? undefined : true}
              style={{ '--hero-dur': `${l.dur}ms` } as CSSProperties}
            >
              <div className={styles.fade}>
                <div className={styles.zoom} onAnimationEnd={isCurrent ? onZoomEnd : undefined}>
                  {art(l.slide, isCurrent ? getName(l.slide.identity.name_kr, l.slide.identity.name_en, l.slide.identity.name_jp) : '', l.key === 0)}
                </div>
              </div>
              {entering && (
                <div className={styles.glitch} aria-hidden="true">
                  <div className={`${styles.split} ${styles.splitR}`}>{art(l.slide)}</div>
                  <div className={`${styles.split} ${styles.splitB}`}>{art(l.slide)}</div>
                  <div className={`${styles.slice} ${styles.sliceA}`}>{art(l.slide)}</div>
                  <div className={`${styles.slice} ${styles.sliceB}`}>{art(l.slide)}</div>
                </div>
              )}
            </div>
          )
        })}
      </div>
      {slides.length > 1 && (
        <div className="absolute bottom-5 right-5 flex gap-2" style={{ zIndex: 20 }}>
          {slides.map(s => {
            const name = getName(s.identity.name_kr, s.identity.name_en, s.identity.name_jp)
            const label = s.gacksung ? t('awakened', { name }) : name
            const active = s.url === current.slide.url
            return (
              <button
                key={s.url}
                onClick={() => goTo(s)}
                aria-label={t('view', { name: label })}
                aria-current={active ? 'true' : undefined}
                className={`${styles.indicator} ${active ? styles.indicatorActive : ''}`}
                title={label}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}

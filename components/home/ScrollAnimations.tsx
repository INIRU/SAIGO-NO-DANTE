'use client'

import { useEffect, useRef } from 'react'

/**
 * Thin client component that runs GSAP scroll-triggered animations
 * targeting class names already present in the server-rendered DOM.
 * Accepts no props — all targets are selected by class name.
 */
export default function ScrollAnimations() {
  const initializedRef = useRef(false)

  useEffect(() => {
    if (initializedRef.current) return
    initializedRef.current = true

    let cleanup: (() => void) | undefined

    const init = async () => {
      const gsap = (await import('gsap')).default
      const { ScrollTrigger } = await import('gsap/ScrollTrigger')
      gsap.registerPlugin(ScrollTrigger)

      const ctx = gsap.context(() => {
        // 히어로 텍스트 (hero section 진입 애니메이션)
        gsap.timeline({ defaults: { ease: 'power3.out' } })
          .fromTo('.hero-subtitle', { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.8, delay: 0.3 })
          .fromTo('.hero-desc',     { opacity: 0, y: 15 }, { opacity: 1, y: 0, duration: 0.6 }, '-=0.4')
          .fromTo('.hero-cta',      { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.5, stagger: 0.1 }, '-=0.3')

        // 최신 인격 카드 — server-rendered .latest-card elements
        if (document.querySelector('.latest-card')) {
          gsap.fromTo('.latest-card',
            { opacity: 0, y: 50, scale: 0.94 },
            {
              opacity: 1, y: 0, scale: 1,
              duration: 0.6, stagger: 0.07, ease: 'power2.out',
              scrollTrigger: { trigger: '.latest-section', start: 'top 78%' },
            }
          )
        }
        if (document.querySelector('.latest-header')) {
          gsap.fromTo('.latest-header',
            { opacity: 0, x: -20 },
            {
              opacity: 1, x: 0,
              duration: 0.6, ease: 'power2.out',
              scrollTrigger: { trigger: '.latest-section', start: 'top 85%' },
            }
          )
        }

        // 공식 링크
        if (document.querySelector('.official-link-card')) {
          gsap.fromTo('.official-link-card',
            { opacity: 0, scale: 0.88, y: 20 },
            {
              opacity: 1, scale: 1, y: 0,
              duration: 0.55, stagger: 0.1, ease: 'back.out(1.4)',
              scrollTrigger: { trigger: '.official-section', start: 'top 85%' },
            }
          )
        }

        // 기능 카드 그리드
        if (document.querySelector('.feature-card')) {
          gsap.fromTo('.feature-card',
            { opacity: 0, y: 30 },
            {
              opacity: 1, y: 0,
              duration: 0.5, stagger: 0.08, ease: 'power2.out',
              scrollTrigger: { trigger: '.features-section', start: 'top 80%' },
            }
          )
        }
      })

      ScrollTrigger.refresh()
      return () => ctx.revert()
    }

    init().then(fn => { cleanup = fn })
    return () => { cleanup?.() }
  }, [])

  // Renders nothing — side-effects only
  return null
}

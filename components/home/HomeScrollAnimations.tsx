'use client'

import { useEffect, useRef } from 'react'

/**
 * Mounts GSAP ScrollTrigger animations for the home page.
 * This component renders nothing — it only sets up animation effects on
 * elements that are already server-rendered in the DOM.
 */
export default function HomeScrollAnimations() {
  const initRef = useRef(false)

  useEffect(() => {
    if (initRef.current) return
    initRef.current = true

    let cleanup: (() => void) | undefined
    const init = async () => {
      const gsap = (await import('gsap')).default
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

    init().then(fn => { cleanup = fn })
    return () => { cleanup?.() }
  }, [])

  return null
}

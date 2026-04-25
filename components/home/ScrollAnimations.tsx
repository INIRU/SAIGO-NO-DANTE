'use client'

import { useEffect, useRef } from 'react'

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
        const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

        if (reducedMotion) {
          gsap.set(
            '.home-command-surface, .home-logo-mark, .home-brand-title, .home-subtitle, .home-meta-strip, .home-command-actions, .home-scroll-prompt',
            { opacity: 1, clearProps: 'transform' }
          )
          gsap.set('.home-gold-rail', { opacity: 0.65, scaleY: 1 })
        } else {
          gsap.timeline({ defaults: { ease: 'power3.out' } })
            .fromTo('.home-command-surface', { opacity: 0, x: -18 }, { opacity: 1, x: 0, duration: 0.65, delay: 0.15 })
            .fromTo('.home-logo-mark', { opacity: 0, y: 12, scale: 0.94 }, { opacity: 1, y: 0, scale: 1, duration: 0.55 }, '-=0.3')
            .fromTo('.home-brand-title', { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.72 }, '-=0.38')
            .fromTo('.home-gold-rail', { opacity: 0, scaleY: 0.08 }, { opacity: 0.65, scaleY: 1, duration: 0.8, transformOrigin: '50% 0%' }, '-=0.55')
            .fromTo('.home-subtitle', { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.62 }, '-=0.42')
            .fromTo('.home-meta-strip', { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.55 }, '-=0.28')
            .fromTo('.home-command-actions', { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.5 }, '-=0.22')
            .fromTo('.home-scroll-prompt', { opacity: 0, y: -6 }, { opacity: 1, y: 0, duration: 0.5 }, '-=0.12')
        }

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

  return null
}

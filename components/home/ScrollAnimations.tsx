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
            '.latest-card, .latest-header, .feature-card',
            { opacity: 1, clearProps: 'transform' }
          )
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

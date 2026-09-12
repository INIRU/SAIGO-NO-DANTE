'use client'

import { useEffect } from 'react'

export default function ScrollAnimations({ belowFold = false }: { belowFold?: boolean }) {
  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)')
    if (preference.matches || (belowFold && CSS.supports('animation-timeline: view()'))) return
    const animations: Animation[] = []
    let observer: IntersectionObserver | undefined
    if (belowFold) {
      observer = new IntersectionObserver(entries => {
        entries.forEach(entry => {
          if (!entry.isIntersecting) return
          observer?.unobserve(entry.target)
          animations.push(entry.target.animate([
            { opacity: .35, transform: 'translateY(.75rem)' },
            { opacity: 1, transform: 'translateY(0)' },
          ], { duration: 280, easing: 'cubic-bezier(.22,1,.36,1)' }))
        })
      }, { threshold: .05 })
      document.querySelectorAll('[data-home-reveal]').forEach(element => observer?.observe(element))
    } else {
      const heroTimeline = [
        { element: document.querySelector('.hero-subtitle'), y: '.75rem', delay: 100, duration: 450 },
        { element: document.querySelector('.hero-desc'), y: '.5rem', delay: 160, duration: 400 },
        { element: document.querySelector('.hero-cta'), y: '.375rem', delay: 220, duration: 360 },
      ]

      heroTimeline.forEach(({ element, y, delay, duration }) => {
        if (!(element instanceof HTMLElement)) return
        animations.push(element.animate(
          [
            { opacity: 0, transform: `translate3d(0, ${y}, 0)` },
            { opacity: 1, transform: 'translate3d(0, 0, 0)' },
          ],
          { duration, delay, easing: 'cubic-bezier(0.16, 1, 0.3, 1)', fill: 'both' },
        ))
      })

    }
    const stop = () => {
      observer?.disconnect()
      animations.forEach(animation => animation.cancel())
    }
    const onPreferenceChange = () => { if (preference.matches) stop() }
    preference.addEventListener('change', onPreferenceChange)
    return () => {
      stop()
      preference.removeEventListener('change', onPreferenceChange)
    }
  }, [belowFold])
  return null
}

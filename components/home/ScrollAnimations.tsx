'use client'

import { useEffect, useRef } from 'react'

type RevealConfig = {
  selector: string
  trigger?: string
  keyframes: Keyframe[]
  options: KeyframeAnimationOptions
  stagger?: number
}

const revealConfigs: RevealConfig[] = [
  {
    selector: '.latest-card',
    trigger: '.latest-section',
    keyframes: [
      { opacity: 0, transform: 'translate3d(0, 3.125rem, 0) scale(0.94)' },
      { opacity: 1, transform: 'translate3d(0, 0, 0) scale(1)' },
    ],
    options: { duration: 600, easing: 'cubic-bezier(0.16, 1, 0.3, 1)', fill: 'both' },
    stagger: 70,
  },
  {
    selector: '.latest-header',
    trigger: '.latest-section',
    keyframes: [
      { opacity: 0, transform: 'translate3d(-1.25rem, 0, 0)' },
      { opacity: 1, transform: 'translate3d(0, 0, 0)' },
    ],
    options: { duration: 600, easing: 'cubic-bezier(0.16, 1, 0.3, 1)', fill: 'both' },
  },
  {
    selector: '.official-link-card',
    trigger: '.official-section',
    keyframes: [
      { opacity: 0, transform: 'translate3d(0, 1.25rem, 0) scale(0.88)' },
      { opacity: 1, transform: 'translate3d(0, 0, 0) scale(1)' },
    ],
    options: { duration: 550, easing: 'cubic-bezier(0.22, 1, 0.36, 1)', fill: 'both' },
    stagger: 100,
  },
  {
    selector: '.feature-card',
    trigger: '.features-section',
    keyframes: [
      { opacity: 0, transform: 'translate3d(0, 1.875rem, 0)' },
      { opacity: 1, transform: 'translate3d(0, 0, 0)' },
    ],
    options: { duration: 500, easing: 'cubic-bezier(0.16, 1, 0.3, 1)', fill: 'both' },
    stagger: 80,
  },
]

function showImmediately(elements: Element[]) {
  elements.forEach(element => {
    if (element instanceof HTMLElement) {
      element.style.opacity = '1'
      element.style.transform = ''
      element.style.filter = ''
    }
  })
}

export default function ScrollAnimations() {
  const initializedRef = useRef(false)

  useEffect(() => {
    if (initializedRef.current) return
    initializedRef.current = true

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const animations: Animation[] = []
    const observers: IntersectionObserver[] = []

    const heroElements = [
      document.querySelector('.hero-subtitle'),
      document.querySelector('.hero-desc'),
      document.querySelector('.hero-cta'),
    ].filter(Boolean) as Element[]

    if (reduceMotion) {
      showImmediately(heroElements)
      showImmediately(revealConfigs.flatMap(config => Array.from(document.querySelectorAll(config.selector))))
      return
    }

    const heroTimeline = [
      { element: document.querySelector('.hero-subtitle'), y: '1.25rem', delay: 300, duration: 800 },
      { element: document.querySelector('.hero-desc'), y: '0.9375rem', delay: 700, duration: 600 },
      { element: document.querySelector('.hero-cta'), y: '0.625rem', delay: 1000, duration: 500 },
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

    revealConfigs.forEach(config => {
      const elements = Array.from(document.querySelectorAll(config.selector)).filter(
        (element): element is HTMLElement => element instanceof HTMLElement,
      )
      if (elements.length === 0) return

      const trigger = document.querySelector(config.trigger ?? config.selector)
      if (!trigger) {
        showImmediately(elements)
        return
      }

      const observer = new IntersectionObserver(([entry]) => {
        if (!entry?.isIntersecting) return
        observer.disconnect()
        elements.forEach((element, index) => {
          animations.push(element.animate(config.keyframes, {
            ...config.options,
            delay: (config.options.delay ?? 0) + index * (config.stagger ?? 0),
          }))
        })
      }, { rootMargin: '0px 0px -15% 0px', threshold: 0.01 })

      observer.observe(trigger)
      observers.push(observer)
    })

    return () => {
      observers.forEach(observer => observer.disconnect())
      animations.forEach(animation => animation.cancel())
      showImmediately(heroElements)
    }
  }, [])

  return null
}

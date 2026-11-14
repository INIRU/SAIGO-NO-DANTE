'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * The section table of contents of a detail page: the current item follows the scroll (the last section above the
 * line at 30% of the screen), the mobile row of links scrolls to keep it in view, and a click scrolls to the section
 * without leaving a hash (so the back link's history stays). `sectionKey` is the section ids joined with commas.
 */
export function useSectionNav(sectionKey: string, loading: boolean, firstSection: string) {
  const [activeSection, setActiveSection] = useState(firstSection)
  // 스크롤 위치에 맞춰 구역 목차의 현재 항목을 표시한다: 화면 위 30% 선을 지난 마지막 구역
  useEffect(() => {
    const ids = sectionKey.split(',')
    let frame = 0
    const update = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        const line = window.innerHeight * 0.3
        let current = ids[0]
        for (const sectionId of ids) {
          const top = document.getElementById(sectionId)?.getBoundingClientRect().top
          if (top != null && top <= line) current = sectionId
        }
        setActiveSection(current)
      })
    }
    update()
    window.addEventListener('scroll', update, { passive: true })
    window.addEventListener('resize', update)
    return () => { cancelAnimationFrame(frame); window.removeEventListener('scroll', update); window.removeEventListener('resize', update) }
  }, [sectionKey, loading])

  // 모바일의 가로 목차에서 현재 항목이 보이도록 목차만 가로로 스크롤한다
  const sectionNavRef = useRef<HTMLOListElement>(null)
  useEffect(() => {
    const list = sectionNavRef.current
    const link = list?.querySelector<HTMLElement>('[aria-current]')
    if (!list || !link) return
    const left = link.offsetLeft - list.offsetLeft
    if (left < list.scrollLeft || left + link.offsetWidth > list.scrollLeft + list.clientWidth) {
      list.scrollTo({ left: Math.max(0, left - 16) })
    }
  }, [activeSection])

  // 해시를 남기지 않고 이동해 BackLink의 뒤로 가기 기록을 그대로 둔다
  const goToSection = (sectionId: string) => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    document.getElementById(sectionId)?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' })
    setActiveSection(sectionId)
  }

  return { activeSection, sectionNavRef, goToSection }
}

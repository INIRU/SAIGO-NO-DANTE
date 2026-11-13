'use client'

import { useEffect } from 'react'

const PLANNER_FOOTER_HIDDEN_CLASS = 'planner-footer-hidden'

export default function PlannerFooterHide() {
  useEffect(() => {
    const root = document.documentElement
    const body = document.body

    const removePlannerFooterClass = () => {
      root.classList.remove(PLANNER_FOOTER_HIDDEN_CLASS)
      body.classList.remove(PLANNER_FOOTER_HIDDEN_CLASS)
    }

    root.classList.add(PLANNER_FOOTER_HIDDEN_CLASS)
    body.classList.add(PLANNER_FOOTER_HIDDEN_CLASS)
    window.addEventListener('pagehide', removePlannerFooterClass)

    return () => {
      window.removeEventListener('pagehide', removePlannerFooterClass)
      removePlannerFooterClass()
    }
  }, [])

  return (
    <style>{`
      body.${PLANNER_FOOTER_HIDDEN_CLASS} .site-footer {
        display: none !important;
      }
    `}</style>
  )
}

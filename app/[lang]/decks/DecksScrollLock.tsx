'use client'

import { useEffect } from 'react'

const SCROLL_LOCK_CLASS = 'decks-list-scroll-locked'

function clearDecksScrollLock() {
  document.documentElement.classList.remove(SCROLL_LOCK_CLASS)
  document.body.classList.remove(SCROLL_LOCK_CLASS)
  document.documentElement.style.overflow = ''
  document.body.style.overflow = ''
}

export default function DecksScrollLock() {
  useEffect(() => {
    const root = document.documentElement
    const body = document.body

    root.style.overflow = ''
    body.style.overflow = ''
    root.classList.add(SCROLL_LOCK_CLASS)
    body.classList.add(SCROLL_LOCK_CLASS)

    window.addEventListener('pagehide', clearDecksScrollLock)

    return () => {
      window.removeEventListener('pagehide', clearDecksScrollLock)
      clearDecksScrollLock()
    }
  }, [])

  return (
    <style>{`
      html.${SCROLL_LOCK_CLASS},
      body.${SCROLL_LOCK_CLASS} {
        overflow: hidden;
      }

      body.${SCROLL_LOCK_CLASS} footer,
      body.${SCROLL_LOCK_CLASS} [data-floating-font-control] {
        display: none !important;
      }
    `}</style>
  )
}

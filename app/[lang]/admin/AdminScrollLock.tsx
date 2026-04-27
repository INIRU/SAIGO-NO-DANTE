'use client'

import { useEffect } from 'react'

const SCROLL_LOCK_CLASS = 'admin-scroll-locked'

function clearAdminScrollLock() {
  document.documentElement.classList.remove(SCROLL_LOCK_CLASS)
  document.body.classList.remove(SCROLL_LOCK_CLASS)
  document.documentElement.style.overflow = ''
  document.body.style.overflow = ''
}

function isAdminPath(pathname: string) {
  const segments = pathname.split('/').filter(Boolean)
  return segments[0] === 'admin' || segments[1] === 'admin'
}

export default function AdminScrollLock() {
  useEffect(() => {
    const root = document.documentElement
    const body = document.body

    root.style.overflow = ''
    body.style.overflow = ''
    root.classList.add(SCROLL_LOCK_CLASS)
    body.classList.add(SCROLL_LOCK_CLASS)

    const handleClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return

      const target = event.target
      if (!(target instanceof Element)) return

      const link = target.closest('a[href]')
      if (!(link instanceof HTMLAnchorElement)) return
      if (link.target && link.target !== '_self') return
      if (link.hasAttribute('download')) return

      const href = link.getAttribute('href')
      if (!href || href.startsWith('#')) return

      let destination: URL
      try {
        destination = new URL(href, window.location.href)
      } catch {
        return
      }
      if (destination.origin !== window.location.origin) return

      if (!isAdminPath(destination.pathname)) {
        clearAdminScrollLock()
      }
    }

    document.addEventListener('click', handleClick, { capture: true })
    window.addEventListener('pagehide', clearAdminScrollLock)

    return () => {
      document.removeEventListener('click', handleClick, { capture: true })
      window.removeEventListener('pagehide', clearAdminScrollLock)
      clearAdminScrollLock()
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

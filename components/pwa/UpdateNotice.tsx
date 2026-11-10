'use client'

import { useEffect, useState } from 'react'
import { RefreshCw, X } from 'lucide-react'
import { useTranslations } from 'next-intl'
import Button from '@/components/ui/Button'

/** The page's own build; the server's comes from /api/version. Both are next.config `env` NEXT_PUBLIC_BUILD_ID. */
const OWN_BUILD = process.env.NEXT_PUBLIC_BUILD_ID
const CHECK_EVERY = 30 * 60 * 1000
/** Coming back to the tab checks again at most this often. */
const RECHECK_AFTER = 5 * 60 * 1000

export function isNewBuild(own: string | undefined, served: string | null): boolean {
  return !!own && !!served && own !== served
}

async function reload() {
  // a waiting service worker takes over first, so the reload is served by the new one
  const registration = await navigator.serviceWorker?.getRegistration().catch(() => undefined)
  await registration?.update().catch(() => {})
  location.reload()
}

/** Whether a new build went live while this page stayed open (or came back from the browser's cache). */
function useNewBuild(): boolean {
  const [fresh, setFresh] = useState(false)
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' || fresh) return
    let last = 0
    const check = async () => {
      if (Date.now() - last < RECHECK_AFTER) return
      last = Date.now()
      const served = await fetch('/api/version', { cache: 'no-store' }).then(r => r.ok ? r.json() : null).then(d => d?.build ?? null, () => null)
      if (isNewBuild(OWN_BUILD, served)) setFresh(true)
    }
    const onVisible = () => { if (document.visibilityState === 'visible') check() }
    check()
    const timer = setInterval(() => { last = 0; onVisible() }, CHECK_EVERY)
    document.addEventListener('visibilitychange', onVisible)
    addEventListener('pageshow', onVisible)
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', onVisible); removeEventListener('pageshow', onVisible) }
  }, [fresh])
  return fresh
}

/**
 * A small card in the bottom-left corner (the page arrows hold the right one) when a new build went live: one reload button
 * and a close. One surface like the game info windows (DESIGN.md): panel, 1px border, no glow or accent stripe.
 */
export default function UpdateNotice() {
  const t = useTranslations('common')
  const fresh = useNewBuild()
  const [closed, setClosed] = useState(false)
  if (!fresh || closed) return null
  return (
    <div role="status" className="update-notice">
      <span>{t('updateAvailable')}</span>
      <Button variant="outline" size="sm" icon={RefreshCw} onClick={reload}>{t('updateReload')}</Button>
      <Button variant="ghost" size="sm" icon={X} aria-label={t('close')} onClick={() => setClosed(true)} />
    </div>
  )
}

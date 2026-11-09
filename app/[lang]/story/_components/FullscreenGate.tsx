'use client'

import { useEffect, useState } from 'react'
import { Maximize } from 'lucide-react'
import { buttonClass } from '@/components/ui/Button'

type Lang = 'ko' | 'en' | 'ja'
const L = {
  ko: { go: '전체화면으로 보기', note: '가로 화면으로 봅니다' },
  en: { go: 'View full screen', note: 'Shown in landscape' },
  ja: { go: '全画面で見る', note: '横画面で表示します' },
}
// Phones, tablets and small windows: the browser's own bars leave too little of the map (USER 2026-11-09)
const SMALL = '(pointer: coarse), (max-width: 900px), (max-height: 500px)'

/** Over the story on a small screen until it is tapped: the page goes full screen (where the browser allows it; not
 * iPhone Safari) and turns to landscape (screen.orientation.lock where it exists, else story.css turns the page). */
export default function FullscreenGate({ lang }: { lang: Lang }) {
  const [show, setShow] = useState(false)
  useEffect(() => {
    const small = window.matchMedia(SMALL).matches
    setShow(small && !document.fullscreenElement && sessionStorageGet() !== '1')
  }, [])
  if (!show) return null
  const s = L[lang]
  const go = async () => {
    setShow(false)
    sessionStorageSet('1')
    const el = document.documentElement
    try {
      if (el.requestFullscreen) await el.requestFullscreen({ navigationUI: 'hide' })
      const o = screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> }
      await o.lock?.('landscape')
    } catch { /* not allowed here: the page stays as it is, turned by story.css when upright */ }
  }
  return (
    <div className="absolute inset-0 z-[90] flex flex-col items-center justify-center gap-3 bg-black/85 backdrop-blur-sm">
      <button type="button" onClick={go} className={buttonClass({ variant: 'primary' })}>
        <Maximize size={18} aria-hidden />{s.go}
      </button>
      <p className="text-[0.875rem] text-[#b0a890]">{s.note}</p>
    </div>
  )
}

// tapped once in this tab: not asked again (sessionStorage may throw in private modes)
function sessionStorageGet() { try { return sessionStorage.getItem('story-fullscreen') } catch { return null } }
function sessionStorageSet(v: string) { try { sessionStorage.setItem('story-fullscreen', v) } catch { /* ignore */ } }

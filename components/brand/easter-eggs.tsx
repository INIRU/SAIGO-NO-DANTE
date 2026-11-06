'use client'

import { useCallback, useEffect, useRef } from 'react'
import { recordEgg, type EasterEgg } from '@/lib/easter-eggs'
import { showSuccess } from '@/lib/toast'

const FOUND = { ko: '이스터 에그를 발견했어요', en: 'You found an easter egg', ja: 'イースターエッグを見つけました' }

/** Records an easter egg in this browser and, when signed in, on the account (a 401 when signed out is fine). */
export function discoverEgg(egg: EasterEgg) {
  if (!recordEgg(localStorage, egg)) return
  void fetch('/api/profile/eggs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ eggs: [egg] }) }).catch(() => {})
  const lang = document.documentElement.lang
  showSuccess(FOUND[lang === 'en' || lang === 'ja' ? lang : 'ko'])
}

/** Click handler that finds the egg after `times` clicks, each within `gapMs` of the previous one. */
export function useTapEgg(egg: EasterEgg, times: number, gapMs = 1500) {
  const taps = useRef({ count: 0, at: 0 })
  return useCallback(() => {
    const now = Date.now()
    taps.current = { count: now - taps.current.at <= gapMs ? taps.current.count + 1 : 1, at: now }
    if (taps.current.count >= times) { taps.current.count = 0; discoverEgg(egg) }
  }, [egg, times, gapMs])
}

const KONAMI = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a']

/** Listens for the Konami code anywhere except while typing; mounted once in the locale layout. */
export function KonamiListener() {
  useEffect(() => {
    let step = 0
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (target?.closest('input, textarea, select, [contenteditable="true"]')) return
      const key = event.key.length === 1 ? event.key.toLowerCase() : event.key
      step = key === KONAMI[step] ? step + 1 : key === KONAMI[0] ? 1 : 0
      if (step === KONAMI.length) { step = 0; discoverEgg('konami') }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
  return null
}

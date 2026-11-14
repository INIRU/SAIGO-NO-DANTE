import { useCallback, useEffect, useState, type RefObject } from 'react'

type Fullscreenable = HTMLElement & { webkitRequestFullscreen?: () => Promise<void> | void }
type WebkitDocument = Document & { webkitFullscreenElement?: Element | null; webkitExitFullscreen?: () => void }
type Orientation = { lock?: (orientation: 'landscape') => Promise<void>; unlock?: () => void }
type StageScreen = { full: boolean; native: boolean; turned: boolean }

const OFF: StageScreen = { full: false, native: false, turned: false }

/**
 * Fill the screen with the stage: the browser's full screen when it gives one to an element (iPhone Safari does not), else
 * the page's own cover. For landscape on a portrait screen: the screen's lock (Android, only in the browser's full
 * screen), else the stage turned a quarter.
 */
export async function openStage(el: Fullscreenable, landscape: boolean, env: { orientation?: Orientation; portrait: boolean }): Promise<StageScreen> {
  let native = false
  try {
    if (el.requestFullscreen) { await el.requestFullscreen({ navigationUI: 'hide' }); native = true }
    else if (el.webkitRequestFullscreen) { await el.webkitRequestFullscreen(); native = true }
  } catch { /* refused: the page's cover instead */ }
  let turned = false
  if (landscape && env.portrait) {
    try {
      if (!native || !env.orientation?.lock) throw new Error('no lock')
      await env.orientation.lock('landscape')
    } catch { turned = true }
  }
  return { full: true, native, turned }
}

const fullscreenElement = () => document.fullscreenElement ?? (document as WebkitDocument).webkitFullscreenElement ?? null
const unlock = () => { try { (screen.orientation as Orientation | undefined)?.unlock?.() } catch { /* nothing locked */ } }

/** The stage's full screen and landscape modes; leaving the browser's full screen (Esc, back gesture) ends them. */
export function useStageScreen(ref: RefObject<HTMLElement | null>) {
  const [mode, setMode] = useState<StageScreen>(OFF)

  const close = useCallback(() => {
    const doc = document as WebkitDocument
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => {})
    else if (doc.webkitFullscreenElement) doc.webkitExitFullscreen?.()
    unlock()
    setMode(OFF)
  }, [])

  const open = useCallback(async (landscape: boolean) => {
    const el = ref.current
    if (!el) return
    setMode(await openStage(el, landscape, { orientation: screen.orientation as Orientation | undefined, portrait: innerHeight > innerWidth }))
  }, [ref])

  useEffect(() => {
    if (!mode.full) return
    const onChange = () => { if (!fullscreenElement()) { unlock(); setMode(OFF) } }
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') close() }
    // The phone turned by hand: the quarter turn is no longer needed.
    const onResize = () => { if (innerWidth > innerHeight) setMode(current => current.turned ? { ...current, turned: false } : current) }
    const previousOverflow = document.body.style.overflow
    if (mode.native) {
      document.addEventListener('fullscreenchange', onChange)
      document.addEventListener('webkitfullscreenchange', onChange)
    } else {
      document.body.style.overflow = 'hidden'
      window.addEventListener('keydown', onKey)
    }
    window.addEventListener('resize', onResize)
    return () => {
      document.removeEventListener('fullscreenchange', onChange)
      document.removeEventListener('webkitfullscreenchange', onChange)
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('resize', onResize)
      document.body.style.overflow = previousOverflow
    }
  }, [mode.full, mode.native, close])

  return { ...mode, open, close }
}

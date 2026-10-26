import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { LayerCompositor, type LayerSetMeta } from '@/lib/motion/compositor'
import { motionAssetUrl, type MotionState } from '@/lib/motion/catalog'

/** `labelKey`: the layer's name as keys (`[Keyword] stack`), written in the page language by the side panel. */
export type MotionStatus = 'idle' | 'loading' | 'ready' | 'error'
export type MotionError = 'webgl' | 'load'
/** The frame being shown, read by the controls only (the rest of the page does not re-render 60 times a second). */
export type MotionFrameStore = { subscribe: (listener: () => void) => () => void; get: () => number }

/** How long without a frame report, while playing, before a display refresh draws the frame itself (6 frames at 60 fps). */
const STALE_MS = 100

/**
 * The skill motion player (the reference player of the R2 export, as a hook): a hidden video element feeds the WebGL2
 * compositor, which draws the picture into a canvas the hook puts in `hostRef`. A newer load cancels an older one. The
 * video starts muted (autoplay), and iOS Safari loads no frame until play(), so a load always calls play() first. While held (the stage's
 * Project Moon notice is up) a load stops at its first frame and nothing plays; releasing the hold starts it.
 */
export function useSkillMotion() {
  const hostRef = useRef<HTMLDivElement | null>(null)
  const video = useRef<HTMLVideoElement | null>(null)
  const comp = useRef<LayerCompositor | null>(null)
  const meta = useRef<LayerSetMeta | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  // The stage out of view (a phone scrolled down to the skill card): no frame is drawn, so iOS Safari does not upload a
  // 1920×1440 video frame 60 times a second for nothing.
  const onScreen = useRef(true)
  const observer = useRef<IntersectionObserver | null>(null)
  const held = useRef(true)
  const token = useRef(0)
  const frame = useRef({ value: 0, listeners: new Set<() => void>() })
  const [status, setStatus] = useState<MotionStatus>('idle')
  const [error, setError] = useState<MotionError | null>(null)
  const [playing, setPlaying] = useState(false)
  const [muted, setMuted] = useState(true)
  const [volume, setVolumeState] = useState(1)
  // Read when a new <video> is made: React keeps this hook's state while the page is hidden (a client navigation away
  // and back), but the effect below makes a fresh element, muted at full volume.
  const volumeRef = useRef(1)
  const [frames, setFrames] = useState(0)
  const [hasAudio, setHasAudio] = useState(false)

  const frameStore = useRef<MotionFrameStore>({
    subscribe: listener => { frame.current.listeners.add(listener); return () => frame.current.listeners.delete(listener) },
    get: () => frame.current.value,
  }).current

  /**
   * Frees the compositor and its GL context at once. A dropped context otherwise lives until it is collected, and on iOS
   * Safari that memory, with the video's frames, can leave the page's other images drawn as black boxes.
   */
  const free = useCallback(() => {
    comp.current?.dispose()
    comp.current = null
    canvasRef.current?.getContext('webgl2')?.getExtension('WEBGL_lose_context')?.loseContext()
    canvasRef.current = null
  }, [])

  const show = useCallback((n: number) => {
    if (n === frame.current.value) return
    frame.current.value = n
    frame.current.listeners.forEach(listener => listener())
  }, [])

  const draw = useCallback(() => {
    const v = video.current, m = meta.current
    if (!v || !m || !comp.current || !onScreen.current) return
    const n = Math.min(m.frames - 1, Math.floor(v.currentTime * m.fps + 1e-3))
    comp.current.draw(v, n)
    show(n)
  }, [show])

  useEffect(() => {
    const v = document.createElement('video')
    v.loop = true
    v.playsInline = true
    v.preload = 'auto'
    v.muted = true
    v.volume = volumeRef.current
    // It plays muted (the browser allows that without a press), so the controls show it muted, at the volume they had.
    setMuted(true)
    v.crossOrigin = 'anonymous' // the R2 host allows the site: WebGL may read the frames
    video.current = v
    observer.current = new IntersectionObserver(([entry]) => {
      onScreen.current = entry.isIntersecting
      if (entry.isIntersecting) draw()
    })
    // The video's frame reports draw each new frame. Every display refresh while it plays also checks on them: when none
    // came for STALE_MS (Windows Chrome stopped sending them for this off-document video while it played on, the canvas
    // frozen mid-skill), the refresh draws the frame itself and asks again. Without the reports (old Safari) it always does.
    const reports = 'requestVideoFrameCallback' in v
    let ticking = false, reportedAt = 0, pending = 0
    const report = () => {
      reportedAt = performance.now()
      draw()
      if (!v.paused) pending = v.requestVideoFrameCallback(report)
    }
    const watch = () => {
      if (v.paused) { ticking = false; return }
      if (!reports || performance.now() - reportedAt > STALE_MS) {
        draw()
        if (reports) { v.cancelVideoFrameCallback(pending); pending = v.requestVideoFrameCallback(report) }
      }
      requestAnimationFrame(watch)
    }
    const onPlay = () => {
      setPlaying(true)
      if (ticking) return
      ticking = true
      reportedAt = performance.now()
      draw()
      if (reports) pending = v.requestVideoFrameCallback(report)
      requestAnimationFrame(watch)
    }
    const onPause = () => { setPlaying(false); draw() }
    const onVisibility = () => { if (document.hidden) v.pause() }
    v.addEventListener('play', onPlay)
    v.addEventListener('pause', onPause)
    v.addEventListener('seeked', draw)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      token.current++
      v.removeEventListener('play', onPlay)
      v.removeEventListener('pause', onPause)
      v.removeEventListener('seeked', draw)
      document.removeEventListener('visibilitychange', onVisibility)
      if (reports) v.cancelVideoFrameCallback(pending)
      observer.current?.disconnect()
      v.pause()
      v.removeAttribute('src')
      v.load()
      free()
    }
  }, [draw, free])

  /** Load one state (another skill or condition), from its first frame. */
  const load = useCallback(async (state: MotionState) => {
    const v = video.current
    if (!v) return
    const mine = ++token.current
    show(0)
    setStatus('loading')
    setError(null)
    try {
      const response = await fetch(motionAssetUrl(state.meta))
      if (!response.ok) throw new Error(String(response.status))
      const m = await response.json() as LayerSetMeta
      if (mine !== token.current) return
      v.pause()
      free()
      meta.current = null
      v.src = motionAssetUrl(state.video)
      const loaded = new Promise<void>((resolve, reject) => {
        v.onloadeddata = () => resolve()
        v.onerror = () => reject(new Error('video'))
      })
      v.play().catch(() => {})
      await loaded
      if (mine !== token.current) return
      // A canvas keeps its first GL context: a new element for every load.
      const canvas = document.createElement('canvas')
      canvas.className = 'block h-auto w-full'
      try {
        comp.current = new LayerCompositor(canvas, m)
      } catch {
        v.pause()
        setError('webgl')
        setStatus('error')
        return
      }
      canvasRef.current = canvas
      hostRef.current?.replaceChildren(canvas)
      observer.current?.disconnect()
      observer.current?.observe(canvas)
      meta.current = m
      setFrames(m.frames)
      setHasAudio(Boolean(m.audio))
      v.currentTime = 0
      draw()
      setStatus('ready')
      if (!held.current) v.play().catch(() => {})
      else v.pause()
    } catch {
      if (mine !== token.current) return
      setError('load')
      setStatus('error')
    }
  }, [draw, show])

  const togglePlay = useCallback(() => { const v = video.current; if (v && !held.current) (v.paused ? v.play().catch(() => {}) : v.pause()) }, [])
  /** Hold or release playback; a release plays the loaded video (the notice's 확인 is the press that starts it). */
  const hold = useCallback((on: boolean) => {
    held.current = on
    const v = video.current
    if (!v) return
    if (on) v.pause()
    else if (meta.current && v.paused) v.play().catch(() => {})
  }, [])
  /**
   * Go to a frame: the middle of its slot (a seek to the exact boundary may land on the previous frame). The controls show
   * it at once: the seek bar under a finger and repeated frame steps do not wait for the video to get there.
   */
  const seek = useCallback((n: number) => {
    const v = video.current, m = meta.current
    if (!v || !m) return
    const to = Math.max(0, Math.min(m.frames - 1, n))
    v.pause()
    v.currentTime = (to + 0.5) / m.fps
    show(to)
  }, [show])
  const step = useCallback((delta: number) => seek(frame.current.value + delta), [seek])
  const toggleMute = useCallback(() => {
    const v = video.current
    if (!v) return
    v.muted = !v.muted
    // Sound back on after the slider took it to 0: at full volume, not silent.
    if (!v.muted && v.volume === 0) { v.volume = 1; volumeRef.current = 1; setVolumeState(1) }
    setMuted(v.muted)
    if (!v.muted && v.paused && !held.current) v.play().catch(() => {})
  }, [])
  /** The slider: above 0 turns the sound on, 0 mutes. iPhone Safari ignores it (the device buttons only). */
  const setVolume = useCallback((value: number) => {
    const v = video.current
    if (!v) return
    v.volume = value
    volumeRef.current = value
    v.muted = value === 0
    setVolumeState(value)
    setMuted(v.muted)
  }, [])

  return { hostRef, status, error, playing, muted, volume, frames, hasAudio, frameStore, load, togglePlay, hold, seek, step, toggleMute, setVolume }
}

/** The frame being shown, for a component that draws it (the counter, the seek bar). */
export function useMotionFrame(store: MotionFrameStore): number {
  return useSyncExternalStore(store.subscribe, store.get, () => 0)
}

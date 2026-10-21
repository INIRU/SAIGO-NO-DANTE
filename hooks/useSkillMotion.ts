import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { LayerCompositor, type LayerSetMeta } from '@/lib/motion/compositor'
import { motionAssetUrl, type MotionState } from '@/lib/motion/catalog'

export type MotionLayerToggle = { id: string; label: string; on: boolean; offAtSkill: boolean }
export type MotionStatus = 'idle' | 'loading' | 'ready' | 'error'
export type MotionError = 'webgl' | 'load'
/** The frame being shown, read by the controls only (the rest of the page does not re-render 60 times a second). */
export type MotionFrameStore = { subscribe: (listener: () => void) => () => void; get: () => number }

type Keep = { t: number; playing: boolean }

/**
 * The skill motion player (the reference player of the R2 export, as a hook): a hidden video element feeds the WebGL2
 * compositor, which draws the base picture plus the wanted buff layers into a canvas the hook puts in `hostRef`. A newer
 * load cancels an older one; the layer switches are kept by layer id across skills and states. The video starts muted
 * (autoplay), and iOS Safari loads no frame until play(), so a load always calls play() first.
 */
export function useSkillMotion() {
  const hostRef = useRef<HTMLDivElement | null>(null)
  const video = useRef<HTMLVideoElement | null>(null)
  const comp = useRef<LayerCompositor | null>(null)
  const meta = useRef<LayerSetMeta | null>(null)
  const toggles = useRef(new Map<string, boolean>())
  const token = useRef(0)
  const frame = useRef({ value: 0, listeners: new Set<() => void>() })
  const [status, setStatus] = useState<MotionStatus>('idle')
  const [error, setError] = useState<MotionError | null>(null)
  const [playing, setPlaying] = useState(false)
  const [muted, setMuted] = useState(true)
  const [frames, setFrames] = useState(0)
  const [hasAudio, setHasAudio] = useState(false)
  const [layers, setLayers] = useState<MotionLayerToggle[]>([])

  const frameStore = useRef<MotionFrameStore>({
    subscribe: listener => { frame.current.listeners.add(listener); return () => frame.current.listeners.delete(listener) },
    get: () => frame.current.value,
  }).current

  const draw = useCallback(() => {
    const v = video.current, m = meta.current
    if (!v || !m || !comp.current) return
    const n = Math.min(m.frames - 1, Math.floor(v.currentTime * m.fps + 1e-3))
    comp.current.draw(v, n)
    if (n !== frame.current.value) {
      frame.current.value = n
      frame.current.listeners.forEach(listener => listener())
    }
  }, [])

  useEffect(() => {
    const v = document.createElement('video')
    v.loop = true
    v.playsInline = true
    v.preload = 'auto'
    v.muted = true
    v.crossOrigin = 'anonymous' // the R2 host allows the site: WebGL may read the frames
    video.current = v
    let ticking = false
    const tick = () => {
      draw()
      if (v.paused) { ticking = false; return }
      if ('requestVideoFrameCallback' in v) v.requestVideoFrameCallback(tick)
      else requestAnimationFrame(tick)
    }
    const onPlay = () => { setPlaying(true); if (!ticking) { ticking = true; tick() } }
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
      v.pause()
      v.removeAttribute('src')
      v.load()
      comp.current?.dispose()
      comp.current = null
    }
  }, [draw])

  /** Load one state; `keep` holds the time and play state over a change of state of the same skill. */
  const load = useCallback(async (state: MotionState, keep: Keep | null = null) => {
    const v = video.current
    if (!v) return
    const mine = ++token.current
    setStatus('loading')
    setError(null)
    try {
      const response = await fetch(motionAssetUrl(state.meta, state.bytes))
      if (!response.ok) throw new Error(String(response.status))
      const m = await response.json() as LayerSetMeta
      if (mine !== token.current) return
      v.pause()
      comp.current?.dispose()
      comp.current = null
      meta.current = null
      v.src = motionAssetUrl(state.video, state.bytes)
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
      hostRef.current?.replaceChildren(canvas)
      meta.current = m
      m.layers.forEach((layer, k) => {
        if (!toggles.current.has(layer.id)) toggles.current.set(layer.id, layer.enabled !== false)
        comp.current!.on[k] = !layer.empty && toggles.current.get(layer.id)!
      })
      setLayers(m.layers.filter(layer => !layer.empty).map(layer => ({ id: layer.id, label: layer.label, on: toggles.current.get(layer.id)!, offAtSkill: Boolean(layer.offAtSkill) })))
      setFrames(m.frames)
      setHasAudio(Boolean(m.audio))
      v.currentTime = keep ? Math.min(keep.t, (m.frames - 1) / m.fps) : 0
      frame.current.value = -1
      draw()
      setStatus('ready')
      if (!keep || keep.playing) v.play().catch(() => {})
      else v.pause()
    } catch {
      if (mine !== token.current) return
      setError('load')
      setStatus('error')
    }
  }, [draw])

  const current = useCallback((): Keep => ({ t: video.current?.currentTime ?? 0, playing: Boolean(video.current && !video.current.paused) }), [])
  const togglePlay = useCallback(() => { const v = video.current; if (v) (v.paused ? v.play().catch(() => {}) : v.pause()) }, [])
  /** Go to a frame: the middle of its slot (a seek to the exact boundary may land on the previous frame). */
  const seek = useCallback((n: number) => {
    const v = video.current, m = meta.current
    if (!v || !m) return
    v.pause()
    v.currentTime = (Math.max(0, Math.min(m.frames - 1, n)) + 0.5) / m.fps
  }, [])
  const step = useCallback((delta: number) => seek(frame.current.value + delta), [seek])
  const toggleMute = useCallback(() => {
    const v = video.current
    if (!v) return
    v.muted = !v.muted
    setMuted(v.muted)
    if (!v.muted && v.paused) v.play().catch(() => {})
  }, [])
  const setLayer = useCallback((id: string, on: boolean) => {
    toggles.current.set(id, on)
    meta.current?.layers.forEach((layer, k) => { if (layer.id === id && comp.current) comp.current.on[k] = on })
    setLayers(list => list.map(layer => layer.id === id ? { ...layer, on } : layer))
    draw()
  }, [draw])

  return { hostRef, status, error, playing, muted, frames, hasAudio, layers, frameStore, load, current, togglePlay, seek, step, toggleMute, setLayer }
}

/** The frame being shown, for a component that draws it (the counter, the seek bar). */
export function useMotionFrame(store: MotionFrameStore): number {
  return useSyncExternalStore(store.subscribe, store.get, () => 0)
}

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { LayerCompositor, type LayerSetMeta } from '@/features/motion/lib/compositor'
import { isPhone, phoneMeta, type PhoneVideo } from '@/features/motion/lib/phone'
import { SoundPlayer } from '@/features/motion/lib/sounds'
import { SoundButtons, type VoiceLink } from '@/features/motion/lib/soundbuttons'
import { MOTION_ASSET_BASE, motionAssetUrl, type MotionState } from '@/features/motion/lib/catalog'
import { useStored } from '@/hooks/useStored'

export type MotionStatus = 'idle' | 'loading' | 'ready' | 'error'
export type MotionError = 'webgl' | 'load'
/** The frame being shown, read by the controls only (the rest of the page does not re-render 60 times a second). */
export type MotionFrameStore = { subscribe: (listener: () => void) => () => void; get: () => number }
/** The three volumes, 0..1: the page's master (the game's loudness at 1), and the game's voice and effects options. */
export type MotionVolumes = { master: number; voice: number; sfx: number }
/** A part of the video the seek bar marks: `key` is the chapter's name token (`<s:2021112>`, `<coin:2>`, `<form>`…). */
export type MotionChapter = { f: number; kind: 'form' | 'skill' | 'cutin' | 'coin' | 'reuse' | 'part'; key: string }
/** A moment on the seek bar: a hit (with its targets, damage and whether it is a critical hit or kills), a kill or a voice line. */
export type MotionMark = { f: number; kind: 'hit' | 'kill' | 'voice'; targets?: number; damage?: number; critical?: boolean; kill?: boolean }
/** What layers.json says beyond the compositor's own fields: `tail` = seconds the sound runs on after the last picture frame. */
type MotionMeta = LayerSetMeta & { tail?: number; chapters?: MotionChapter[]; marks?: MotionMark[] }

/** How long without a frame report, while playing, before a display refresh draws the frame itself (6 frames at 60 fps). */
const STALE_MS = 100
const SOUND_WAIT_MS = 8000   // how long a video waits for its sound before it plays without

// The visitor's sound settings, kept in the browser: the master starts at the game's full loudness, where a hit has its edge.
const SOUND_KEY = 'motion-sound-v2'
// Whether the sound is on, '1' or '0': it stays as the visitor left it through other videos, pages and visits.
const SOUND_ON_KEY = 'motion-sound-on'
const readSoundOn = () => { try { return localStorage.getItem(SOUND_ON_KEY) === '1' } catch { return false } }
const keepSoundOn = (on: boolean) => { try { localStorage.setItem(SOUND_ON_KEY, on ? '1' : '0') } catch { /* private mode: kept for this page only */ } }
const level = (value: unknown, fallback: number) => (typeof value === 'number' && value >= 0 && value <= 1 ? value : fallback)
const parseSound = (saved: unknown): MotionVolumes => {
  const s = (saved ?? {}) as Partial<MotionVolumes>
  return { master: level(s.master, 1), voice: level(s.voice, 1), sfx: level(s.sfx, 1) }
}

// The link section's sound buttons: one for the page's lifetime (its AudioContext is made at the first press and kept).
let buttons: SoundButtons | null = null
const linkButtons = () => (buttons ??= new SoundButtons(MOTION_ASSET_BASE))
/** voice_links.json (the link section's sound buttons); [] when R2 has none. */
export const readMotionVoiceLinks = () => linkButtons().list()

/**
 * The skill motion player (the reference player of the R2 export, as a hook): a hidden video element feeds the WebGL2
 * compositor, which draws the picture into a canvas the hook puts in `hostRef`; the SoundPlayer plays every sound of the
 * skill over it (the video's own audio track is silent). A newer load cancels an older one. The video starts muted
 * (autoplay), and iOS Safari loads no frame until play(), so a load always calls play() first. While held (the stage's
 * Project Moon notice is up) a load stops at its first frame and nothing plays; releasing the hold starts it.
 */
export function useSkillMotion() {
  const hostRef = useRef<HTMLDivElement | null>(null)
  const video = useRef<HTMLVideoElement | null>(null)
  const sounds = useRef<SoundPlayer | null>(null)
  const comp = useRef<LayerCompositor | null>(null)
  const meta = useRef<MotionMeta | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  // The stage out of view (a phone scrolled down to the skill card): no frame is drawn, so iOS Safari does not upload a
  // 1920×3240 video frame 60 times a second for nothing.
  const onScreen = useRef(true)
  const observer = useRef<IntersectionObserver | null>(null)
  const held = useRef(true)
  const token = useRef(0)
  // The wait after the video ended, while the sound tail runs on (one at a time).
  const tailTimer = useRef(0)
  const frame = useRef({ value: 0, listeners: new Set<() => void>() })
  // The frame on the canvas (the sound tail keeps the last one).
  const drawn = useRef(-1)
  const [status, setStatus] = useState<MotionStatus>('idle')
  const statusRef = useRef(status)
  statusRef.current = status
  const [error, setError] = useState<MotionError | null>(null)
  const [playing, setPlaying] = useState(false)
  const [muted, setMuted] = useState(true)
  const soundOn = useRef(false)
  const resuming = useRef(false)   // the page was left while the video played
  const [sound, saveSound] = useStored(SOUND_KEY, parseSound)
  const soundRef = useRef(sound)
  soundRef.current = sound
  const [frames, setFrames] = useState(0)
  const [hasAudio, setHasAudio] = useState(false)
  const [chapters, setChapters] = useState<MotionChapter[]>([])
  const [marks, setMarks] = useState<MotionMark[]>([])

  const frameStore = useRef<MotionFrameStore>({
    subscribe: listener => { frame.current.listeners.add(listener); return () => frame.current.listeners.delete(listener) },
    get: () => frame.current.value,
  }).current

  /** Plays; a browser that refuses the silent track outside a press plays without it, and the next press brings it back. */
  const playVideo = useCallback(() => {
    const v = video.current
    v?.play().catch(() => {
      if (v.muted) return
      v.muted = true
      v.play().catch(() => {})
    })
  }, [])

  const applySound = useCallback(() => {
    const s = soundRef.current, p = sounds.current
    p?.setVolume(s.master)
    p?.setVoiceVolume(s.voice)
    p?.setSfxVolume(s.sfx)
    buttons?.setVolume(s.master)
    buttons?.setVoiceVolume(s.voice)
  }, [])
  useEffect(applySound, [sound, applySound])

  /** Ends the wait of the sound tail: the sound stops and the video shows as stopped. Nothing to do when none is waiting. */
  const clearTail = useCallback(() => {
    if (!tailTimer.current) return
    window.clearTimeout(tailTimer.current)
    tailTimer.current = 0
    sounds.current?.stop()
    setPlaying(false)
  }, [])

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

  /** exact: the frame a frame report says the video hands over now; otherwise the frame of its current time. */
  const draw = useCallback((exact?: number) => {
    const v = video.current, m = meta.current
    if (!v || !m || !comp.current || !onScreen.current) return
    const last = m.frames - 1
    // The sound tail: the audio runs on past the last picture frame, where the video has no frame (Safari shows black).
    if (exact === undefined && v.currentTime >= m.frames / m.fps && drawn.current === last) { show(last); return }
    const n = exact ?? Math.min(last, Math.floor(v.currentTime * m.fps + 1e-3))
    comp.current.draw(v, n, exact !== undefined)
    drawn.current = n
    show(n)
  }, [show])

  useEffect(() => {
    const v = document.createElement('video')
    v.loop = true
    v.playsInline = true
    v.preload = 'auto'
    v.muted = true
    // It plays muted (the browser allows that without a press); saved on, the sound joins at once or at the first press.
    soundOn.current = readSoundOn()
    setMuted(!soundOn.current)
    v.crossOrigin = 'anonymous' // the R2 host allows the site: WebGL may read the frames
    video.current = v
    const player = new SoundPlayer()
    player.attach(v)
    sounds.current = player
    applySound()
    if (soundOn.current) {
      player.setMuted(false)
      if ((navigator as Navigator & { userActivation?: { hasBeenActive: boolean } }).userActivation?.hasBeenActive) v.muted = false
    }
    const wake = () => {
      if (!soundOn.current) return
      sounds.current?.unlock()
      v.muted = false
      if (resuming.current && !held.current) { resuming.current = false; playVideo() }
    }
    const redraw = () => draw()
    observer.current = new IntersectionObserver(([entry]) => {
      onScreen.current = entry.isIntersecting
      if (entry.isIntersecting) draw()
    })
    // The video's frame reports draw each new frame (none in the sound tail). Every display refresh while it plays also
    // checks on them: when none came for STALE_MS (Windows Chrome stopped sending them for this off-document video while it
    // played on, the canvas frozen mid-skill), the refresh draws the frame itself and asks again. Without the reports (old
    // Safari) it always does.
    const reports = 'requestVideoFrameCallback' in v
    let ticking = false, reportedAt = 0, pending = 0
    const report = (_: number, md: VideoFrameCallbackMetadata) => {
      reportedAt = performance.now()
      const m = meta.current
      // (While seeking the frame reported is the one before the seek: the controls already show where it is going.)
      if (m && !v.seeking && md.mediaTime < m.frames / m.fps) draw(Math.min(m.frames - 1, Math.round(md.mediaTime * m.fps)))
      if (!v.paused) pending = v.requestVideoFrameCallback(report)
    }
    const watch = () => {
      if (v.paused) { ticking = false; return }
      // (A stall: no frame is ready, nothing new to draw.)
      if (v.readyState >= 3 && (!reports || performance.now() - reportedAt > STALE_MS)) {
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
    // The pause that comes with the end of a video with a tail is not a stop: the last frame stays and the sound runs on.
    const onPause = () => { if (v.ended && meta.current?.tail) return; setPlaying(false); draw() }
    // The end of a video with a tail: the last frame stays, and after frames / fps + tail it plays again from the start.
    const onEnded = () => {
      const m = meta.current
      if (!m?.tail) return
      draw()
      show(m.frames - 1)
      window.clearTimeout(tailTimer.current)
      tailTimer.current = window.setTimeout(() => {
        tailTimer.current = 0
        v.currentTime = 0
        v.play().catch(() => setPlaying(false))
      }, Math.max(0, m.frames / m.fps + m.tail - v.duration) * 1000)
    }
    const onVisibility = () => {
      if (document.hidden) {
        resuming.current = !v.paused || Boolean(tailTimer.current)
        clearTail()
        v.pause()
      } else {
        draw()   // (the canvas keeps no drawing buffer: a page shown again gets its picture drawn again)
        if (resuming.current && !held.current) {
          resuming.current = false
          wake()
          playVideo()
        } else wake()
      }
    }
    v.addEventListener('play', onPlay)
    v.addEventListener('pause', onPause)
    v.addEventListener('ended', onEnded)
    v.addEventListener('seeked', redraw)
    document.addEventListener('visibilitychange', onVisibility)
    document.addEventListener('click', wake, true)
    document.addEventListener('touchend', wake, true)
    return () => {
      token.current++
      window.clearTimeout(tailTimer.current)
      tailTimer.current = 0
      v.removeEventListener('play', onPlay)
      v.removeEventListener('pause', onPause)
      v.removeEventListener('ended', onEnded)
      v.removeEventListener('seeked', redraw)
      document.removeEventListener('visibilitychange', onVisibility)
      document.removeEventListener('click', wake, true)
      document.removeEventListener('touchend', wake, true)
      if (reports) v.cancelVideoFrameCallback(pending)
      observer.current?.disconnect()
      v.pause()
      v.removeAttribute('src')
      v.load()
      player.dispose()
      sounds.current = null
      buttons?.stop()
      free()
    }
  }, [draw, show, free, applySound, clearTail, playVideo])

  /** Load one state (another skill or condition), from its first frame. */
  const load = useCallback(async (state: MotionState) => {
    const v = video.current
    if (!v) return
    const mine = ++token.current
    clearTail()
    show(0)
    setStatus('loading')
    setError(null)
    try {
      const response = await fetch(motionAssetUrl(state.meta))
      if (!response.ok) throw new Error(String(response.status))
      const full = await response.json() as MotionMeta & { phone?: PhoneVideo }
      if (mine !== token.current) return
      // The picture is three planes stacked in the video (Y, Cb, Cr, 1920×3240); one missing is a load failure.
      if (!full.basePlanes?.y || !full.basePlanes.cb || !full.basePlanes.cr) throw new Error('layers.json without the Y, Cb, Cr planes')
      // A phone takes the plain copy of the video when the data has one (the file sits next to the full one).
      const small = isPhone() ? phoneMeta(full) : null
      const m: MotionMeta = small ?? full
      v.pause()
      free()
      meta.current = null
      // A video with a tail does not loop by itself: the hook waits out the tail, then plays it again.
      v.loop = !m.tail
      v.src = motionAssetUrl(small ? state.video.replace(/[^/]+$/, small.video.file) : state.video)
      const loaded = new Promise<void>((resolve, reject) => {
        v.onloadeddata = () => resolve()
        v.onerror = () => reject(new Error('video'))
      })
      playVideo()
      await loaded
      if (mine !== token.current) return
      // From here a video error is the player's failure, not a failed load.
      v.onerror = () => {
        if (mine !== token.current) return
        clearTail()
        sounds.current?.stop()
        setError('load')
        setStatus('error')
      }
      // A canvas keeps its first GL context: a new element for every load.
      const canvas = document.createElement('canvas')
      canvas.className = 'block h-auto w-full'
      const base = motionAssetUrl(state.meta.slice(0, state.meta.lastIndexOf('/') + 1))
      try {
        comp.current = new LayerCompositor(canvas, m, file => base + file)
      } catch {
        v.pause()
        setError('webgl')
        setStatus('error')
        return
      }
      // (A frame the compositor decodes itself, ready after the draw that wanted it: playing, the next frame draws.)
      comp.current.onReady = () => { if (v.paused) draw() }
      canvasRef.current = canvas
      hostRef.current?.replaceChildren(canvas)
      observer.current?.disconnect()
      observer.current?.observe(canvas)
      meta.current = m
      drawn.current = -1
      const tracks = sounds.current?.load(MOTION_ASSET_BASE, m)
      setFrames(m.frames)
      setHasAudio(Boolean(m.audio))
      setChapters(m.chapters ?? [])
      setMarks(m.marks ?? [])
      // With the sound on the video waits for its tracks: started sooner, the first sounds would come in cut.
      if (soundOn.current && tracks) {
        v.pause()
        v.currentTime = 0
        draw()
        let timer = 0
        await Promise.race([tracks, new Promise(resolve => { timer = window.setTimeout(resolve, SOUND_WAIT_MS) })])
        window.clearTimeout(timer)
        if (mine !== token.current) return
      }
      v.currentTime = 0
      draw()
      setStatus('ready')
      if (!held.current) playVideo()
      else v.pause()
    } catch {
      if (mine !== token.current) return
      setError('load')
      setStatus('error')
    }
  }, [draw, show, free, clearTail])

  const togglePlay = useCallback(() => {
    const v = video.current
    if (!v || held.current) return
    if (tailTimer.current) clearTail()          // a pause in the tail (the video itself has ended)
    else if (v.paused || v.ended) v.play().catch(() => {})
    else v.pause()
  }, [clearTail])
  /** Hold or release playback; a release plays the loaded video (the notice's 확인 is the press that starts it). */
  const hold = useCallback((on: boolean) => {
    held.current = on
    const v = video.current
    if (!v) return
    if (on) { clearTail(); v.pause() }
    else if (meta.current && v.paused) playVideo()
  }, [clearTail, playVideo])
  /**
   * Go to a frame: the middle of its slot (a seek to the exact boundary may land on the previous frame). The controls show
   * it at once: the seek bar under a finger and repeated frame steps do not wait for the video to get there.
   */
  const seek = useCallback((n: number) => {
    const v = video.current, m = meta.current
    if (!v || !m) return
    const to = Math.max(0, Math.min(m.frames - 1, n))
    clearTail()
    v.pause()
    v.currentTime = (to + 0.5) / m.fps
    show(to)
  }, [show, clearTail])
  const step = useCallback((delta: number) => seek(frame.current.value + delta), [seek])
  /**
   * Sound on or off, inside the press: iOS lets Web Audio past the ringer switch only while a video with sound plays (the
   * silent track, unmuted) and starts an AudioContext only in a press.
   */
  const unmute = useCallback((on: boolean) => {
    const v = video.current
    if (!v) return
    v.muted = !on
    soundOn.current = on
    keepSoundOn(on)
    const fetching = sounds.current?.setMuted(!on)
    setMuted(!on)
    // Turned on with its files not fetched yet (off, nothing is): the video holds on the loading state, then plays with them.
    // (A video that is still loading, or failed, keeps its state: its own load waits for the sound.)
    if (fetching && statusRef.current === 'ready' && !held.current) {
      const mine = token.current
      clearTail()
      v.pause()
      setStatus('loading')
      let timer = 0
      void Promise.race([fetching.catch(() => {}), new Promise(resolve => { timer = window.setTimeout(resolve, SOUND_WAIT_MS) })]).then(() => {
        window.clearTimeout(timer)
        if (mine !== token.current) return
        setStatus('ready')
        if (!held.current && !document.hidden) playVideo()
      })
    } else if (on && v.paused && !held.current) v.play().catch(() => {})
  }, [clearTail, playVideo])
  const toggleMute = useCallback(() => {
    const v = video.current
    if (!v) return
    // Sound back on after the master went to 0: at the starting level, not silent.
    if (!soundOn.current && soundRef.current.master === 0) saveSound({ ...soundRef.current, master: 1 })
    unmute(!soundOn.current)
  }, [unmute, saveSound])
  /** A volume slider; the master above 0 turns the sound on. */
  const setVolume = useCallback((kind: keyof MotionVolumes, value: number) => {
    saveSound({ ...soundRef.current, [kind]: value })
    if (kind === 'master' && value > 0 && !soundOn.current) unmute(true)
  }, [saveSound, unmute])
  /** A link line of the link section, played inside the press; resolves when it ends or another press stopped it. */
  const playVoice = useCallback((link: VoiceLink) => {
    const b = linkButtons()
    b.setVolume(soundRef.current.master)
    b.setVoiceVolume(soundRef.current.voice)
    return b.play(link)
  }, [])
  const stopVoice = useCallback(() => buttons?.stop(), [])

  return { hostRef, status, error, playing, muted, volumes: sound, frames, hasAudio, chapters, marks, frameStore, load, togglePlay, hold, seek, step, toggleMute, setVolume, playVoice, stopVoice }
}

/** The frame being shown, for a component that draws it (the counter, the seek bar). */
export function useMotionFrame(store: MotionFrameStore): number {
  return useSyncExternalStore(store.subscribe, store.get, () => 0)
}

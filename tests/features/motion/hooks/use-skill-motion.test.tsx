import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, createElement } from 'react'
import type { Root } from 'react-dom/client'
import type { useSkillMotion as UseSkillMotion } from '@/features/motion/hooks/useSkillMotion'
import type { MotionState } from '@/features/motion/lib/catalog'

// The hook runs in Node with a thin DOM (react-dom needs a container and a few globals), the compositor and the sound player replaced by recorders.
const calls = vi.hoisted(() => ({ draws: [] as unknown[][], sound: {} as Record<string, ReturnType<typeof vi.fn>>, comps: [] as unknown[][] }))
vi.mock('@/features/motion/lib/compositor', () => ({
  LayerCompositor: class {
    onReady: (() => void) | null = null
    constructor(...args: unknown[]) { calls.comps.push(args) }
    draw(...args: unknown[]) { calls.draws.push(args) }
    dispose() {}
  },
}))
vi.mock('@/features/motion/lib/sounds', () => ({
  SoundPlayer: class {
    constructor() {
      for (const name of ['attach', 'dispose', 'unlock', 'load', 'stop', 'setMuted', 'setVolume', 'setVoiceVolume', 'setSfxVolume']) (this as Record<string, unknown>)[name] = (calls.sound[name] ??= vi.fn())
    }
  },
}))

class FakeVideo extends EventTarget {
  loop = false; playsInline = false; preload = ''; muted = false; crossOrigin = ''
  paused = true; ended = false; readyState = 4; duration = 0; currentTime = 0
  onloadeddata: (() => void) | null = null
  onerror: (() => void) | null = null
  plays = 0
  rejectPlay = false
  private source = ''
  set src(value: string) { this.source = value; queueMicrotask(() => this.onloadeddata?.()) }
  get src() { return this.source }
  play() {
    this.plays++
    if (this.rejectPlay) return Promise.reject(new Error('NotAllowed'))
    this.paused = false; this.ended = false
    this.dispatchEvent(new Event('play'))
    return Promise.resolve()
  }
  pause() { if (!this.paused) { this.paused = true; this.dispatchEvent(new Event('pause')) } }
  removeAttribute() {}
  load() {}
  /** The end of a video that does not loop: the browser pauses it (with `ended` already true), then fires `ended`. */
  finish() { this.paused = true; this.ended = true; this.dispatchEvent(new Event('pause')); this.dispatchEvent(new Event('ended')) }
}
class FakeCanvas { className = ''; width = 0; height = 0; getContext() { return null } }

const META = { version: 11, fps: 60, frames: 120, tile: { w: 1920, h: 1080 }, video: { file: 'layers.mp4', w: 1920, h: 3240 }, skill: { name: 's' }, layers: [], audio: { format: 3 },
  basePlanes: { y: { x: 0, y: 0, w: 1920, h: 1080 }, cb: { x: 0, y: 1080, w: 1920, h: 1080 }, cr: { x: 0, y: 2160, w: 1920, h: 1080 } }, sounds: [], soundPools: [] }
const STATE: MotionState = { state: 'v:base', name: 's', video: 'a/layers.mp4', meta: 'a/layers.json', label: 'base', bytes: 0 }

let useSkillMotion: typeof UseSkillMotion
let createRoot: typeof import('react-dom/client').createRoot
let root: Root
let video: FakeVideo
let store: Record<string, string>
let doc: EventTarget & { hidden: boolean }
let result: { current: ReturnType<typeof UseSkillMotion> }
let json: object

beforeAll(async () => {
  doc = Object.assign(new EventTarget(), { hidden: false, oninput: null, createElement: (tag: string) => tag === 'video' ? video : tag === 'canvas' ? new FakeCanvas() : { style: {}, setAttribute() {} } })
  vi.stubGlobal('document', doc)
  vi.stubGlobal('window', globalThis)
  vi.stubGlobal('HTMLIFrameElement', class {})
  ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  ;({ createRoot } = await import('react-dom/client'))
  ;({ useSkillMotion } = await import('@/features/motion/hooks/useSkillMotion'))
})

beforeEach(() => {
  vi.useFakeTimers()
  calls.draws.length = 0; calls.comps.length = 0; calls.sound = {}
  video = new FakeVideo(); video.duration = 2.5
  store = {}
  doc.hidden = false
  json = { ...META }
  vi.stubGlobal('localStorage', { getItem: (k: string) => store[k] ?? null, setItem: (k: string, v: string) => { store[k] = v } })
  vi.stubGlobal('IntersectionObserver', class { observe() {} disconnect() {} unobserve() {} })
  vi.stubGlobal('requestAnimationFrame', (cb: () => void) => setTimeout(cb, 16))
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200, json: async () => json })))
})
afterEach(async () => {
  await act(async () => { root?.unmount() })
  vi.useRealTimers()
})

async function mount() {
  const container = Object.assign(new EventTarget(), { nodeType: 1, ownerDocument: doc, textContent: '', tagName: 'DIV', appendChild() {}, removeChild() {} })
  result = { current: null as never }
  function Probe() { result.current = useSkillMotion(); return null }
  root = createRoot(container as unknown as Element)
  await act(async () => { root.render(createElement(Probe)) })
}
/** Loads the state and releases the hold, so the video plays. */
async function open() {
  await mount()
  await act(async () => { await result.current.load(STATE) })
  await act(async () => { result.current.hold(false) })
}
const advance = (ms: number) => act(async () => { vi.advanceTimersByTime(ms) })

describe('REQ-MOTION-028 the load check of the three Y, Cb, Cr planes', () => {
  it('REQ-MOTION-028 opens a layers.json with y, cb and cr, and builds the compositor from it', async () => {
    await mount()
    await act(async () => { await result.current.load(STATE) })
    expect(result.current.status).toBe('ready')
    expect(result.current.frames).toBe(120)
    expect(calls.comps).toHaveLength(1)
  })

  it.each(['y', 'cb', 'cr'])('REQ-MOTION-028 shows a load failure when the %s plane is missing', async plane => {
    const { [plane as 'y']: _gone, ...planes } = META.basePlanes
    json = { ...META, basePlanes: planes }
    await mount()
    await act(async () => { await result.current.load(STATE) })
    expect(result.current.status).toBe('error')
    expect(result.current.error).toBe('load')
    expect(calls.comps).toHaveLength(0)
  })
})

describe('REQ-MOTION-041 chapters and marks come out of the hook', () => {
  it('REQ-MOTION-041 returns the chapters and marks of the loaded layers.json, none before it and for a video without them', async () => {
    await mount()
    expect(result.current.chapters).toEqual([])
    expect(result.current.marks).toEqual([])
    const chapters = [{ f: 0, kind: 'skill', key: '<s:2021112>' }, { f: 60, kind: 'coin', key: '<coin:1>' }]
    const marks = [{ f: 70, kind: 'hit', targets: 7, damage: 7, critical: true, kill: false }, { f: 100, kind: 'voice' }]
    json = { ...META, chapters, marks }
    await act(async () => { await result.current.load(STATE) })
    expect(result.current.chapters).toEqual(chapters)
    expect(result.current.marks).toEqual(marks)
    json = { ...META }
    await act(async () => { await result.current.load(STATE) })
    expect(result.current.chapters).toEqual([])
  })
})

describe('REQ-MOTION-031 the sound settings have no critical-hit switch', () => {
  it('REQ-MOTION-031 starts at the game\'s full loudness, whatever an older page kept at half', async () => {
    store['motion-sound'] = JSON.stringify({ master: 0.5, voice: 1, sfx: 1 })
    await mount()
    expect(result.current.volumes).toEqual({ master: 1, voice: 1, sfx: 1 })
  })

  it('REQ-MOTION-031 returns no critical, hasCritical or setCritical, and drops the old saved switch', async () => {
    store['motion-sound-v2'] = JSON.stringify({ master: 0.3, voice: 0.8, sfx: 0.6, critical: false })
    await mount()
    expect(result.current.volumes).toEqual({ master: 0.3, voice: 0.8, sfx: 0.6 })
    for (const key of ['critical', 'hasCritical', 'setCritical']) expect(result.current).not.toHaveProperty(key)
    await act(async () => { result.current.setVolume('sfx', 0.4) })
    expect(JSON.parse(store['motion-sound-v2'])).toEqual({ master: 0.3, voice: 0.8, sfx: 0.4 })
    expect(calls.sound.setSfxVolume).toHaveBeenLastCalledWith(0.4)
  })
})

describe('REQ-MOTION-040 the sound tail keeps the last frame, then plays again', () => {
  it('REQ-MOTION-040 does not loop a video with a tail, and loops one without', async () => {
    json = { ...META, tail: 1.2 }
    await open()
    expect(video.loop).toBe(false)
    json = { ...META }
    await act(async () => { await result.current.load(STATE) })
    expect(video.loop).toBe(true)
  })

  it('REQ-MOTION-040 holds the last frame and the playing mark through the tail, then plays from the start after frames / fps + tail', async () => {
    json = { ...META, tail: 1.2 }              // 2 s of picture + 1.2 s of tail; the file's own length is 2.5 s: 0.7 s left to wait
    await open()
    expect(result.current.playing).toBe(true)
    video.currentTime = 2.5
    await act(async () => { video.finish() })
    expect(result.current.playing).toBe(true)
    expect(result.current.frameStore.get()).toBe(119)
    video.plays = 0
    await advance(600)
    expect(video.plays).toBe(0)
    expect(result.current.frameStore.get()).toBe(119)
    await advance(150)
    expect(video.currentTime).toBe(0)
    expect(video.plays).toBe(1)
    expect(result.current.playing).toBe(true)
  })

  it('REQ-MOTION-040 shows the video as stopped when the play that follows the tail is refused', async () => {
    json = { ...META, tail: 1.2 }
    await open()
    await act(async () => { video.finish() })
    video.rejectPlay = true
    await advance(800)
    expect(result.current.playing).toBe(false)
  })

  it('REQ-MOTION-040 waits no longer than the file when it is longer than frames / fps + tail', async () => {
    json = { ...META, tail: 0.2 }
    await open()
    await act(async () => { video.finish() })
    video.plays = 0
    await advance(1)
    expect(video.plays).toBe(1)
  })

  it('REQ-MOTION-040 lets the pause that comes with the end of a video with a tail pass, but stops at the viewer\'s pause during the wait', async () => {
    json = { ...META, tail: 1.2 }
    await open()
    await act(async () => { video.finish() })
    expect(result.current.playing).toBe(true)
    await act(async () => { result.current.togglePlay() })   // pause in the tail
    expect(result.current.playing).toBe(false)
    expect(calls.sound.stop).toHaveBeenCalled()
    video.plays = 0
    await advance(2000)
    expect(video.plays).toBe(0)
    await act(async () => { result.current.togglePlay() })   // play: from the start
    expect(video.plays).toBe(1)
  })

  it.each([
    ['a seek', (r: typeof result) => r.current.seek(30)],
    ['holding the stage', (r: typeof result) => r.current.hold(true)],
    ['a hidden tab', () => { doc.hidden = true; doc.dispatchEvent(new Event('visibilitychange')) }],
    ['another video', (r: typeof result) => { void r.current.load(STATE) }],
  ])('REQ-MOTION-040 stops the wait for %s', async (_name, act1) => {
    json = { ...META, tail: 1.2 }
    await open()
    await act(async () => { video.finish() })
    video.plays = 0
    await act(async () => { act1(result) })
    video.plays = 0
    await advance(2000)
    expect(video.plays).toBe(0)
  })

  it('REQ-MOTION-040 stops the wait when the page goes', async () => {
    json = { ...META, tail: 1.2 }
    await open()
    await act(async () => { video.finish() })
    video.plays = 0
    await act(async () => { root.unmount() })
    await advance(2000)
    expect(video.plays).toBe(0)
  })

  it('REQ-MOTION-040 starts no wait for a video without a tail: its pause is a stop', async () => {
    await open()
    await act(async () => { video.finish() })
    expect(result.current.playing).toBe(false)
    video.plays = 0
    await advance(5000)
    expect(video.plays).toBe(0)
  })
})

describe('REQ-MOTION-047 stalls and errors while watching', () => {
  it('REQ-MOTION-047 draws on the display refresh only while the video has a frame ready, not while it stalls', async () => {
    await open()
    await advance(200)
    const playing = calls.draws.length
    expect(playing).toBeGreaterThan(0)
    video.readyState = 2
    await advance(16)
    const before = calls.draws.length
    await advance(300)
    expect(calls.draws.length).toBe(before)
    video.readyState = 4
    await advance(100)
    expect(calls.draws.length).toBeGreaterThan(before)
  })

  it('REQ-MOTION-047 shows the retry screen when the video fails while it plays', async () => {
    await open()
    expect(result.current.status).toBe('ready')
    await act(async () => { video.onerror?.() })
    expect(result.current.status).toBe('error')
    expect(result.current.error).toBe('load')
  })

  it('REQ-MOTION-047 ignores an error of an older video after a newer one was loaded', async () => {
    await open()
    const stale = video.onerror
    await act(async () => { await result.current.load(STATE) })
    await act(async () => { stale?.() })
    expect(result.current.status).toBe('ready')
  })
})

describe('REQ-MOTION-025 the sound stays on', () => {
  it('REQ-MOTION-025 keeps the switch in the browser: on comes back after a new page, off stays off', async () => {
    store['motion-sound-on'] = '1'
    await mount()
    expect(result.current.muted).toBe(false)
    expect(calls.sound.setMuted).toHaveBeenLastCalledWith(false)
    await act(async () => { result.current.toggleMute() })
    expect(store['motion-sound-on']).toBe('0')
  })

  it('REQ-MOTION-053 plays on when the page comes back, if it was playing when it was left', async () => {
    await open()
    expect(video.paused).toBe(false)
    doc.hidden = true; doc.dispatchEvent(new Event('visibilitychange'))
    expect(video.paused).toBe(true)
    doc.hidden = false; doc.dispatchEvent(new Event('visibilitychange'))
    expect(video.paused).toBe(false)
  })

  it('REQ-MOTION-053 keeps a video stopped by the viewer stopped when the page comes back', async () => {
    await open()
    await act(async () => { result.current.togglePlay() })
    doc.hidden = true; doc.dispatchEvent(new Event('visibilitychange'))
    doc.hidden = false; doc.dispatchEvent(new Event('visibilitychange'))
    expect(video.paused).toBe(true)
  })

  it('REQ-MOTION-053 falls back to playing without the silent track when a browser refuses it, and takes it back at the next press', async () => {
    store['motion-sound-on'] = '1'
    await mount()
    let refused = 0
    const play = video.play.bind(video)
    video.play = () => (!video.muted && !refused++ ? Promise.reject(new Error('NotAllowed')) : play())
    video.muted = false
    await act(async () => { await result.current.load(STATE) })
    await act(async () => { result.current.hold(false) })
    expect(video.muted).toBe(true)
    expect(video.paused).toBe(false)
    doc.dispatchEvent(new Event('click'))
    expect(video.muted).toBe(false)
    expect(calls.sound.unlock).toHaveBeenCalled()
  })

  it('REQ-MOTION-054 with the sound on, starts the video from its first frame only when the tracks are ready', async () => {
    store['motion-sound-on'] = '1'
    await mount()
    await act(async () => { result.current.hold(false) })
    let ready = () => {}
    calls.sound.load.mockReturnValue(new Promise<void>(resolve => { ready = resolve }))
    let loading = Promise.resolve()
    await act(async () => { loading = result.current.load(STATE); await vi.advanceTimersByTimeAsync(0) })
    expect(video.paused).toBe(true)
    expect(result.current.status).toBe('loading')
    video.currentTime = 0.4
    await act(async () => { ready(); await loading })
    expect(video.currentTime).toBe(0)
    expect(video.paused).toBe(false)
    expect(result.current.status).toBe('ready')
  })

  it('REQ-MOTION-054 with the sound off, plays without waiting for the tracks', async () => {
    await mount()
    await act(async () => { result.current.hold(false) })
    calls.sound.load.mockReturnValue(new Promise<void>(() => {}))
    await act(async () => { await result.current.load(STATE) })
    expect(video.paused).toBe(false)
  })

  it('REQ-MOTION-054 gives up waiting for tracks that never come, and plays', async () => {
    store['motion-sound-on'] = '1'
    await mount()
    await act(async () => { result.current.hold(false) })
    calls.sound.load.mockReturnValue(new Promise<void>(() => {}))
    let loading = Promise.resolve()
    await act(async () => { loading = result.current.load(STATE); await vi.advanceTimersByTimeAsync(0) })
    expect(video.paused).toBe(true)
    await act(async () => { await vi.advanceTimersByTimeAsync(8000); await loading })
    expect(video.paused).toBe(false)
  })
})

describe('REQ-MOTION-058 the sound turned on waits for its files', () => {
  it('REQ-MOTION-058 stops the video on the loading state while the sound is fetched, then plays with it', async () => {
    await open()
    let done = () => {}
    calls.sound.setMuted.mockReturnValueOnce(new Promise<void>(r => { done = r }))
    await act(async () => { result.current.toggleMute() })
    expect(result.current.status).toBe('loading')
    expect(video.paused).toBe(true)
    await act(async () => { done() })
    expect(result.current.status).toBe('ready')
    expect(video.paused).toBe(false)
  })

  it('REQ-MOTION-058 plays on at once when the sound is already there', async () => {
    await open()
    await act(async () => { result.current.toggleMute() })
    expect(result.current.status).toBe('ready')
    expect(video.paused).toBe(false)
  })
})

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SoundPlayer, gainAt, type SoundCue, type SoundMeta } from '@/lib/motion/sounds'

// Web Audio and the video element as recorders: the tests read what the player scheduled, not what a speaker plays.
class Param {
  value = 1
  events: { kind: 'set' | 'ramp'; v: number; t: number }[] = []
  targets = 0
  setValueAtTime(v: number, t: number) { this.events.push({ kind: 'set', v, t }); this.value = v }
  linearRampToValueAtTime(v: number, t: number) { this.events.push({ kind: 'ramp', v, t }) }
  cancelScheduledValues() {}
  setTargetAtTime() { this.targets++ }
}
class Node {
  out: Node[] = []
  connect(to: Node) { this.out.push(to); return to }
  disconnect() { this.out = [] }
  channelCount = 2; channelCountMode = ''; channelInterpretation = ''
}
class Gain extends Node { gain = new Param() }
class Source extends Node {
  buffer: { duration: number } | null = null
  loop = false; loopStart = 0; loopEnd = 0
  started: [number, number][] = []
  stops: number[] = []
  onended: (() => void) | null = null
  start(when: number, offset: number) { this.started.push([when, offset]) }
  stop(t: number) { this.stops.push(t) }
}
let sources: Source[] = []
let gains: Gain[] = []
let durations: Record<string, number> = {}
class Ctx {
  currentTime = 10; state = 'running'; destination = new Node()
  createGain() { const g = new Gain(); gains.push(g); return g }
  createBufferSource() { const s = new Source(); sources.push(s); return s }
  createChannelSplitter() { return new Node() }
  createChannelMerger() { return new Node() }
  resume() { return Promise.resolve() }
  close() { return Promise.resolve() }
  decodeAudioData(data: { url: string }, ok: (b: { duration: number }) => void) { ok({ duration: durations[data.url] ?? 2 }) }
}
let ctx: Ctx
class Video extends EventTarget {
  currentTime = 0; paused = true; ended = false; seeking = false; readyState = 4
  requestVideoFrameCallback() { return 1 }
  cancelVideoFrameCallback() {}
  fire(type: string) { this.dispatchEvent(new Event(type)) }
}

const RULES = { version: 1, steal: { fade: 0.043 }, limiter: { release: 0.005, lookahead: 0.005, ceiling: 1, ceiling3D: 1 }, events: { 'event:/sfx/20220329/hit': { max: 8, d3: true } }, output: 4 }
const cue = (over: Partial<SoundCue> = {}): SoundCue => ({ start: 1, files: ['sfx/a.m4a'], seconds: 2, kind: 'sfx', mix: [[0, 1, 1]], ...over })
const meta = (sounds: SoundCue[], extra: Partial<SoundMeta> = {}): SoundMeta => ({ fps: 60, sounds, ...extra })
const rounded = (p: Param) => p.events.map(e => ({ ...e, t: Math.round(e.t * 1e6) / 1e6 }))
const stealed = (src: Source) => (src.out[0] as Gain).gain.events.some(e => e.kind === 'ramp' && e.v === 0)

/** The nodes of one started source: src -> steal gain -> splitter -> left, right -> merger -> bus. */
function chain(src: Source) {
  const steal = src.out[0] as Gain, [left, right] = steal.out[0].out as Gain[]
  return { steal, left: left.gain, right: right.gain, bus: left.out[0].out[0] as Gain }
}

let player: SoundPlayer, video: Video
async function setup(m: SoundMeta, rules: object = RULES, missing = '\0') {
  vi.stubGlobal('fetch', vi.fn(async (url: string) => url.endsWith('sound_rules.json')
    ? { ok: true, json: async () => rules }
    : { ok: !url.endsWith(missing), arrayBuffer: async () => ({ url: url.replace('https://r2/', '') }) }))
  player = new SoundPlayer()
  video = new Video()
  player.attach(video as unknown as HTMLVideoElement)
  player.setMuted(false)
  await player.load('https://r2/', m)
}
/** Plays from `at` seconds (the audio clock reads 10 s there) and lets the scheduler step once; the cues start within 0.3 s of it. */
function play(at = 0.8) {
  video.currentTime = at
  video.paused = false
  video.fire('play')
  vi.advanceTimersByTime(30)
}

beforeEach(() => {
  vi.useFakeTimers()
  sources = []; gains = []; durations = {}
  ctx = new Ctx()
  vi.stubGlobal('window', globalThis)
  vi.stubGlobal('AudioContext', function () { return ctx })
})
afterEach(() => { player?.dispose(); vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks() })

describe('REQ-MOTION-037 the level of a cue is its mix curve', () => {
  it('REQ-MOTION-037 reads the curve linearly between points and holds the first and last value outside them', () => {
    const mix: [number, number, number][] = [[60, 0.2, 0.4], [120, 0.6, 0.0]]
    expect(gainAt(mix, 0)).toEqual([0.2, 0.4])
    expect(gainAt(mix, 60)).toEqual([0.2, 0.4])
    const mid = gainAt(mix, 90)
    expect(mid[0]).toBeCloseTo(0.4); expect(mid[1]).toBeCloseTo(0.2)
    expect(gainAt(mix, 500)).toEqual([0.6, 0])
  })

  it('REQ-MOTION-037 puts the curve on a left and a right gain node at frame / fps seconds on the audio clock', async () => {
    await setup(meta([cue({ start: 1, mix: [[60, 0.5, 0.25], [90, 1, 0.5], [120, 0.1, 0.1]] })]))
    play()
    const { left, right } = chain(sources[0])
    // The video reads 0.8 s when the audio clock reads 10 s: frame 60 (1 s) is at 10.2, frame 120 (2 s) at 11.2.
    expect(rounded(left)).toEqual([{ kind: 'set', v: 0.5, t: 10.2 }, { kind: 'ramp', v: 1, t: 10.7 }, { kind: 'ramp', v: 0.1, t: 11.2 }])
    expect(right.events.map(e => e.v)).toEqual([0.25, 0.5, 0.1])
    expect(sources[0].started[0][0]).toBeCloseTo(10.2)
    expect(sources[0].started[0][1]).toBe(0)
  })

  it('REQ-MOTION-037 does not lower the effects while a voice sounds: no ducking, only the curves', async () => {
    await setup(meta([cue({ start: 1 }), cue({ start: 1, kind: 'voice', files: ['voices/v.m4a'], mix: [[0, 0.7, 0.7]] })]))
    play()
    expect(sources).toHaveLength(2)
    const [sfx, voice] = sources.map(chain)
    expect(sfx.left.events).toHaveLength(1)
    expect(sfx.left.events[0].v).toBe(1)
    expect(voice.left.events[0].v).toBe(0.7)
    expect(sfx.bus).not.toBe(voice.bus)
    expect(sfx.bus.gain.value).toBe(1)
    expect(voice.bus.gain.value).toBe(1)
    // Nothing is scheduled on any gain node but the cue curves (a duck would use setTargetAtTime).
    expect(gains.every(g => g.gain.targets === 0)).toBe(true)
  })

  it('REQ-MOTION-037 applies the effects and voice options on their buses, the curve itself untouched, and the page volume on the master', async () => {
    await setup(meta([cue({ start: 1 }), cue({ start: 1, kind: 'voice', files: ['voices/v.m4a'] })]))
    play()
    const [sfx, voice] = sources.map(chain)
    player.setSfxVolume(0.5); player.setVoiceVolume(0.25)
    expect(sfx.bus.gain.value).toBe(0.5)
    expect(voice.bus.gain.value).toBe(0.25)
    expect(sfx.left.events).toHaveLength(1)
    player.setVolume(0.25)
    // The rules' output gain (4) times the page volume.
    expect(gains.find(g => g.out[0] === ctx.destination)!.gain.value).toBe(1)
  })
})

describe('REQ-MOTION-038 a cue in its middle, a negative start, an end', () => {
  it('REQ-MOTION-038 starts from the value of the curve at the current position when playing from the middle of a cue', async () => {
    await setup(meta([cue({ start: 1, mix: [[60, 0, 0], [120, 1, 0.5], [180, 0, 0]] })]))
    play(1.5)                                       // frame 90: half way up
    const { left, right } = chain(sources[0])
    expect(sources[0].started).toEqual([[10, 0.5]])  // now, 0.5 s into the file
    expect(left.events[0]).toEqual({ kind: 'set', v: 0.5, t: 10 })
    expect(right.events[0].v).toBeCloseTo(0.25)
    expect(left.events[1]).toEqual({ kind: 'ramp', v: 1, t: 10.5 })
  })

  it('REQ-MOTION-038 starts from the curve value after a pause and play, and after a seek', async () => {
    durations['sfx/a.m4a'] = 4
    await setup(meta([cue({ start: 0, seconds: 4, mix: [[0, 0, 0], [240, 1, 1]] })]))
    play(0)
    video.paused = true; video.fire('pause')
    sources.length = 0
    ctx.currentTime = 12
    play(2)                                          // frame 120: half way
    expect(chain(sources[0]).left.events[0].v).toBeCloseTo(0.5)
    sources.length = 0
    video.seeking = true; video.fire('seeking'); video.seeking = false
    video.currentTime = 3; ctx.currentTime = 13; video.fire('seeked')
    vi.advanceTimersByTime(30)
    expect(chain(sources[0]).left.events[0].v).toBeCloseTo(0.75)
  })

  it('REQ-MOTION-038 skips the front of the file for a negative start and plays from video time 0', async () => {
    await setup(meta([cue({ start: -0.5 })]))
    play(0)
    expect(sources[0].started).toEqual([[10, 0.5]])
  })

  it('REQ-MOTION-038 stops at `end` on the audio clock with no fade of its own', async () => {
    await setup(meta([cue({ start: 1, end: 1.5, mix: [[60, 1, 1], [90, 1, 1]] })]))
    play()
    expect(sources[0].stops).toHaveLength(1)
    expect(sources[0].stops[0]).toBeCloseTo(10.7)
    expect(stealed(sources[0])).toBe(false)
  })

  it('REQ-MOTION-038 repeats a loop cue shorter than its span, from the file offset modulo its length when started late', async () => {
    durations['sfx/loop.m4a'] = 1
    await setup(meta([cue({ start: 1, end: 5, kind: 'loop', files: ['sfx/loop.m4a'], seconds: 4 })]))
    play(3.25)                                       // 2.25 s into the cue: 0.25 into the third round
    const src = sources[0]
    expect(src.loop).toBe(true)
    expect(src.loopEnd).toBe(1)
    expect(src.started[0][1]).toBeCloseTo(0.25)
    expect(src.stops[0]).toBeCloseTo(11.75)
  })
})

describe('REQ-MOTION-039 random files and cues on top of each other', () => {
  it('REQ-MOTION-039 loads every file of a cue, picks one at the same odds each play, and again when the loop wraps', async () => {
    const random = vi.spyOn(Math, 'random').mockReturnValue(0.1)
    await setup(meta([cue({ start: 1, files: ['sfx/a.m4a', 'sfx/b.m4a', 'sfx/c.m4a'] })]))
    const fetched = vi.mocked(fetch).mock.calls.map(c => String(c[0]))
    for (const f of ['a', 'b', 'c']) expect(fetched).toContain(`https://r2/sfx/${f}.m4a`)
    play()
    expect(player.log.map(l => l.file)).toEqual(['sfx/a.m4a'])
    random.mockReturnValue(0.9)
    video.currentTime = 2; vi.advanceTimersByTime(30)
    video.currentTime = 0.8; vi.advanceTimersByTime(30)    // the media time jumped back: the loop wrapped
    expect(player.log.at(-1)!.file).toBe('sfx/c.m4a')
  })

  it('REQ-MOTION-039 draws every pool again and plays only the cues of the drawn option', async () => {
    const pools = [{ id: 'p', kind: 'random', options: [{ weight: 1 }, { weight: 1 }] }]
    const random = vi.spyOn(Math, 'random').mockReturnValue(0.1)
    await setup(meta([cue({ pool: 'p', option: 0 }), cue({ pool: 'p', option: 1, files: ['sfx/b.m4a'] })], { soundPools: pools }))
    expect(player.wanted().map(c => c.option)).toEqual([0])
    random.mockReturnValue(0.9)
    player.pickAll()
    expect(player.wanted().map(c => c.option)).toEqual([1])
  })

  it('REQ-MOTION-039 plays seven cues of one event in the same frame, all of them, inside the event\'s limit', async () => {
    const hit = { start: 1, event: 'event:/SFX/20220329/Hit', d3: true, files: ['sfx/hit.m4a'], mix: [[60, 0.3, 0.2]] as [number, number, number][] }
    await setup(meta(Array.from({ length: 7 }, () => cue(hit))))
    play()
    expect(sources).toHaveLength(7)
    expect(player.log).toHaveLength(7)
    expect(player.log.every(l => l.stolen === 0)).toBe(true)
    expect(sources.every(s => s.stops.length === 0 && !stealed(s))).toBe(true)
    expect(new Set(sources.map(s => chain(s).bus)).size).toBe(1)
  })

  it('REQ-MOTION-039 steals the oldest instance, fading over the rules\' steal time, once the event\'s limit is reached', async () => {
    const rules = { ...RULES, events: { 'event:/sfx/20220329/hit': { max: 3, d3: true } } }
    const hit = (start: number) => cue({ start, event: 'event:/SFX/20220329/Hit', files: ['sfx/hit.m4a'] })
    await setup(meta([hit(1), hit(1.01), hit(1.02), hit(1.03)]), rules)
    play(0.9)
    expect(player.log.map(l => l.stolen)).toEqual([0, 0, 0, 1])
    expect(sources.filter(stealed)).toHaveLength(1)
    expect(stealed(sources[0])).toBe(true)
    const ramp = (sources[0].out[0] as Gain).gain.events.find(e => e.kind === 'ramp')!
    expect(ramp.t - 10.13).toBeCloseTo(0.043)
  })
})

describe('REQ-MOTION-040 the sound tail after the video ended', () => {
  it('REQ-MOTION-040 keeps scheduling cues after the video ended, on the running audio clock, and plays from the start again with files drawn anew', async () => {
    const random = vi.spyOn(Math, 'random').mockReturnValue(0.1)
    await setup(meta([cue({ start: 0.5, files: ['sfx/a.m4a', 'sfx/b.m4a'] }), cue({ start: 2.2, files: ['sfx/late.m4a'] })]))
    play(0.3)
    expect(player.log.map(l => l.start)).toEqual([0.5])
    // The video ends at 2 s (a pause, then ended); the clock goes on and the cue at 2.2 s sounds in the tail.
    video.currentTime = 2; video.paused = true; video.ended = true
    video.fire('pause'); video.fire('ended')
    ctx.currentTime = 12
    vi.advanceTimersByTime(30)
    expect(player.log.map(l => l.start)).toEqual([0.5, 2.2])
    // The page starts the video again: a new play.
    random.mockReturnValue(0.9)
    video.ended = false
    ctx.currentTime = 13.5
    play(0.3)
    expect(player.log.slice(2).map(l => [l.start, l.file])).toEqual([[0.5, 'sfx/b.m4a']])
  })

  it('REQ-MOTION-040 does not stop what sounds at the pause that comes with the end, but does at a seek', async () => {
    await setup(meta([cue({ start: 0.5 })]))
    play(0.3)
    video.currentTime = 2; video.ended = true; video.paused = true
    video.fire('pause')
    expect(stealed(sources[0])).toBe(false)
    video.ended = false; video.fire('seeking')
    expect(stealed(sources[0])).toBe(true)
  })

  it('REQ-MOTION-040 ends the tail with stop(): no cue is scheduled after it', async () => {
    await setup(meta([cue({ start: 2.2 }), cue({ start: 2.5 })]))
    play(1.95)
    expect(sources).toHaveLength(1)
    video.currentTime = 2; video.paused = true; video.ended = true
    video.fire('pause'); video.fire('ended')
    player.stop()
    ctx.currentTime = 10.4
    vi.advanceTimersByTime(30)
    expect(sources).toHaveLength(1)
  })
})

describe('REQ-MOTION-047 a video that stops for buffering', () => {
  it('REQ-MOTION-047 stops the sound at the stall, schedules nothing while the video cannot play on, and resumes from its position', async () => {
    await setup(meta([cue({ start: 0.5 }), cue({ start: 3 })]))
    play(0.3)
    video.currentTime = 1; ctx.currentTime = 10.7
    video.readyState = 2
    video.fire('waiting')
    expect(stealed(sources[0])).toBe(true)
    // The stall lasts 9 s of the audio clock; the cue at 3 s is not due, as the video is held at 1 s.
    ctx.currentTime = 20; vi.advanceTimersByTime(30)
    expect(sources).toHaveLength(1)
    video.readyState = 4; video.currentTime = 1.2; ctx.currentTime = 20.2
    video.fire('playing')
    vi.advanceTimersByTime(30)
    expect(sources).toHaveLength(2)                 // the cue in progress starts again from its middle
    expect(sources[1].started[0][1]).toBeCloseTo(0.7)
  })
})

describe('REQ-MOTION-047 a sound file that is not on R2', () => {
  it('REQ-MOTION-047 stays silent and never decodes the error page', async () => {
    const decode = vi.spyOn(Ctx.prototype, 'decodeAudioData')
    await setup(meta([cue({ files: ['sfx/gone.m4a'] }), cue({ files: ['sfx/here.m4a'] })]), RULES, 'gone.m4a')
    expect(decode.mock.calls.map(call => (call[0] as { url: string }).url)).toEqual(['sfx/here.m4a'])
    play()
    expect(sources).toHaveLength(1)
    decode.mockRestore()
  })
})

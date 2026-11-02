import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SoundPlayer, gainAt, limitCues, type PlayCue, type SoundCue, type SoundMeta } from '@/lib/motion/sounds'

// Web Audio and the video element as recorders: the tests read how the tracks are mixed and when they start, not what a speaker plays.
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
  buffer: { duration: number; url?: string; cues?: Source[] } | null = null
  loop = false; loopStart = 0; loopEnd = 0
  started: [number, number][] = []
  stops: number[] = []
  onended: (() => void) | null = null
  start(when: number, offset: number) { this.started.push([when, offset]) }
  stop(t: number) { this.stops.push(t) }
}
class Limiter extends Node {
  parameters = new Map([['ceiling', { value: 1 }], ['release', { value: 0.0052 }]])
  constructor(public ctx: object, _name: string, options: { parameterData?: { ceiling: number; release: number } }) {
    super()
    if (options.parameterData) { this.parameters.get('ceiling')!.value = options.parameterData.ceiling; this.parameters.get('release')!.value = options.parameterData.release }
    limiters.push(this)
  }
}
let sources: Source[] = []     // what plays: the tracks
let cues: Source[] = []        // what was mixed: the cues of every track
let tracks: Offline[] = []
let limiters: Limiter[] = []
let gains: Gain[] = []
let durations: Record<string, number> = {}
class Ctx {
  currentTime = 10; state = 'running'; destination = new Node()
  audioWorklet = { addModule: async () => {} }
  createGain() { const g = new Gain(); gains.push(g); return g }
  createBufferSource() { const s = new Source(); sources.push(s); return s }
  resume() { return Promise.resolve() }
  close() { return Promise.resolve() }
  decodeAudioData(data: { url: string }, ok: (b: { duration: number; url: string }) => void) { ok({ duration: durations[data.url] ?? 2, url: data.url }) }
}
class Offline {
  destination = new Node()
  audioWorklet = { addModule: async () => {} }
  made: Source[] = []
  constructor(public channels: number, public length: number, public sampleRate: number) { tracks.push(this) }
  createGain() { return new Gain() }
  createBufferSource() { const s = new Source(); this.made.push(s); cues.push(s); return s }
  createChannelSplitter() { return new Node() }
  createChannelMerger() { return new Node() }
  async startRendering() { return { duration: this.length / this.sampleRate, cues: this.made } }
}
let ctx: Ctx
class Video extends EventTarget {
  currentTime = 0; paused = true; ended = false; seeking = false; readyState = 4
  fire(type: string) { this.dispatchEvent(new Event(type)) }
}

const RULES = { version: 1, steal: { fade: 0.043 }, limiter: { release: 0.005, lookahead: 0.005, ceiling: 0.2648, ceiling3D: 0.6364 }, events: { 'event:/sfx/20220329/hit': { max: 8, d3: true } }, output: 4 }
const cue = (over: Partial<SoundCue> = {}): SoundCue => ({ start: 1, files: ['sfx/a.m4a'], seconds: 2, kind: 'sfx', mix: [[0, 1, 1]], ...over })
const voice = (over: Partial<SoundCue> = {}) => cue({ kind: 'voice', files: ['voices/v.m4a'], ...over })
const meta = (sounds: SoundCue[], extra: Partial<SoundMeta> = {}): SoundMeta => ({ fps: 60, sounds, ...extra })
const rounded = (p: Param) => p.events.map(e => ({ ...e, t: Math.round(e.t * 1e6) / 1e6 }))
const stealed = (src: Source) => chain(src).left.events.some(e => e.kind === 'ramp' && e.v === 0)

/** The nodes of one mixed cue: src -> splitter -> left, right -> merger -> what it goes to. */
function chain(src: Source) {
  const [left, right] = src.out[0].out as Gain[]
  return { left: left.gain, right: right.gain, to: left.out[0].out[0] }
}
const flush = () => vi.advanceTimersByTimeAsync(0)

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
  await flush()
}
/** Plays from at seconds (the audio clock reads 10 s there) and lets the player step once. */
function play(at = 0.8) {
  video.currentTime = at
  video.paused = false
  video.fire('play')
  video.fire('playing')
  vi.advanceTimersByTime(30)
}

beforeEach(() => {
  vi.useFakeTimers()
  sources = []; cues = []; tracks = []; limiters = []; gains = []; durations = {}
  ctx = new Ctx()
  vi.stubGlobal('window', globalThis)
  vi.stubGlobal('AudioContext', function () { return ctx })
  vi.stubGlobal('OfflineAudioContext', Offline)
  vi.stubGlobal('AudioWorkletNode', Limiter)
})
afterEach(() => { player?.dispose(); vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks() })

describe('REQ-MOTION-037 the level of a cue is its mix curve', () => {
  it('REQ-MOTION-037 reads the curve linearly between points and holds the first and last value outside them', () => {
    const mix: [number, number, number][] = [[60, 0.2, 0.4], [120, 0.6, 0.0]]
    expect([gainAt(mix, 0, 1), gainAt(mix, 0, 2)]).toEqual([0.2, 0.4])
    expect([gainAt(mix, 60, 1), gainAt(mix, 60, 2)]).toEqual([0.2, 0.4])
    const mid = [gainAt(mix, 90, 1), gainAt(mix, 90, 2)]
    expect(mid[0]).toBeCloseTo(0.4); expect(mid[1]).toBeCloseTo(0.2)
    expect([gainAt(mix, 500, 1), gainAt(mix, 500, 2)]).toEqual([0.6, 0])
  })

  it('REQ-MOTION-037 puts the curve on a left and a right gain node at frame / fps seconds of the track', async () => {
    await setup(meta([cue({ start: 1, mix: [[60, 0.5, 0.25], [90, 1, 0.5], [120, 0.1, 0.1]] })]))
    const { left, right } = chain(cues[0])
    expect(rounded(left)).toEqual([{ kind: 'set', v: 0.5, t: 1 }, { kind: 'ramp', v: 1, t: 1.5 }, { kind: 'ramp', v: 0.1, t: 2 }])
    expect(right.events.map(e => e.v)).toEqual([0.25, 0.5, 0.1])
    expect(cues[0].started).toEqual([[1, 0]])
  })

  it('REQ-MOTION-037 starts a curve that begins after the cue from its first value, and lowers nothing while a voice sounds', async () => {
    await setup(meta([cue({ start: 1 }), voice({ start: 1, mix: [[0, 0.7, 0.7]] })]))
    const [sfx, line] = tracks.map(t => chain(t.made[0]))
    expect(sfx.left.events).toHaveLength(1)
    expect(sfx.left.events[0].v).toBe(1)
    expect(line.left.events[0].v).toBe(0.7)
    expect(gains.every(g => g.gain.targets === 0)).toBe(true)
  })

  it('REQ-MOTION-037 moves the effects, voice and page volumes on the sounding tracks, with no new mix', async () => {
    await setup(meta([cue({ start: 1 }), voice({ start: 1 })]))
    play()
    const mixed = tracks.length
    const [sfx, line] = sources.map(s => s.out[0] as Gain)
    player.setSfxVolume(0.5); player.setVoiceVolume(0.25)
    expect(sfx.gain.value).toBe(0.5)
    expect(line.gain.value).toBe(0.25)
    player.setVolume(0.25)
    await flush()
    expect(tracks).toHaveLength(mixed)
    // The page volume is last, after the game's output gain (4).
    expect(gains.find(g => g.out[0] === ctx.destination)!.gain.value).toBe(0.25)
    expect(gains.some(g => g.gain.value === 4)).toBe(true)
  })
})

describe('REQ-MOTION-050 the voices and the effects are each one track', () => {
  it('REQ-MOTION-050 mixes every effect into one track and every voice into another, ahead of the play', async () => {
    await setup(meta([cue({ start: 1 }), cue({ start: 2 }), voice({ start: 1 }), voice({ start: 3 })]))
    expect(tracks).toHaveLength(2)
    expect(tracks.every(t => t.channels === 2 && t.sampleRate === 48000)).toBe(true)
    expect(tracks.map(t => t.made.length)).toEqual([2, 2])
    expect(tracks.map(t => t.length / 48000)).toEqual([4, 5])    // to the end of its last file
  })

  it('REQ-MOTION-050 starts both tracks at one instant and offset, so nothing slides between them', async () => {
    await setup(meta([cue({ start: 1 }), voice({ start: 1 })]))
    play(1.5)
    expect(sources).toHaveLength(2)
    expect(sources[0].started).toEqual(sources[1].started)
    expect(sources[0].started[0][0]).toBeCloseTo(10.02)
    expect(sources[0].started[0][1]).toBeCloseTo(1.52)
  })

  it('REQ-MOTION-050 mixes once when nothing in the data is random, and leaves out a kind with no cue', async () => {
    await setup(meta([cue({ start: 1 })]))
    play()
    video.currentTime = 2; vi.advanceTimersByTime(30)
    video.currentTime = 0.8; vi.advanceTimersByTime(30)
    await flush()
    expect(tracks).toHaveLength(1)
    expect(sources.at(-1)!.started).toHaveLength(1)
  })

  it('REQ-MOTION-050 limits the effects at the game ceilings in their track, the voices not at all, and the sum last at 0.977', async () => {
    await setup(meta([cue({ d3: false }), cue({ d3: true }), voice()]), { ...RULES, limiter: { ...RULES.limiter, release: 0.007 } })
    const inTrack = limiters.filter(l => l.ctx instanceof Offline), live = limiters.filter(l => l.ctx === ctx)
    expect(inTrack.map(l => [l.ctx === tracks[0], l.parameters.get('ceiling')!.value, l.parameters.get('release')!.value])).toEqual([[true, 0.2648, 0.007], [true, 0.6364, 0.007]])
    expect(live.map(l => [l.parameters.get('ceiling')!.value, l.parameters.get('release')!.value])).toEqual([[0.977, 0.007]])
    expect(chain(tracks[0].made[0]).to).toBe(inTrack[0])
    expect(chain(tracks[0].made[1]).to).toBe(inTrack[1])
    expect(chain(tracks[1].made[0]).to).toBe(tracks[1].destination)
  })
})

describe('REQ-MOTION-038 a place in the middle, a negative start, an end', () => {
  it('REQ-MOTION-038 plays the track from the video time after a pause and after a seek', async () => {
    durations['sfx/a.m4a'] = 4
    await setup(meta([cue({ start: 0, seconds: 4 })]))
    play(0)
    video.paused = true; video.fire('pause')
    expect(sources[0].stops).toHaveLength(1)
    ctx.currentTime = 12
    play(2)
    expect(sources[1].started[0][1]).toBeCloseTo(2.02)
    video.seeking = true; video.fire('seeking'); video.seeking = false
    video.currentTime = 3; ctx.currentTime = 13; video.fire('seeked')
    vi.advanceTimersByTime(30)
    expect(sources[2].started[0][1]).toBeCloseTo(3.02)
  })

  it('REQ-MOTION-038 skips the front of the file for a negative start and sounds from video time 0', async () => {
    await setup(meta([cue({ start: -0.5 })]))
    expect(cues[0].started).toEqual([[0, 0.5]])
  })

  it('REQ-MOTION-038 stops at end with no fade of its own', async () => {
    await setup(meta([cue({ start: 1, end: 1.5, mix: [[60, 1, 1], [90, 1, 1]] })]))
    expect(cues[0].stops).toEqual([1.5])
    expect(stealed(cues[0])).toBe(false)
  })

  it('REQ-MOTION-038 repeats a loop cue shorter than its span', async () => {
    durations['sfx/loop.m4a'] = 1
    await setup(meta([cue({ start: 1, end: 5, kind: 'loop', files: ['sfx/loop.m4a'], seconds: 4, mix: [[60, 1, 1], [300, 0, 0]] })]))
    expect(cues[0].loop).toBe(true)
    expect(cues[0].loopEnd).toBe(1)
    expect(cues[0].stops).toEqual([5])
  })
})

describe('REQ-MOTION-039 random files and cues on top of each other', () => {
  it('REQ-MOTION-039 loads every file of a cue, picks one at the same odds, and again for a later play when the loop wraps', async () => {
    const random = vi.spyOn(Math, 'random').mockReturnValue(0.1)
    await setup(meta([cue({ start: 1, files: ['sfx/a.m4a', 'sfx/b.m4a', 'sfx/c.m4a'] })]))
    const fetched = vi.mocked(fetch).mock.calls.map(c => String(c[0]))
    for (const f of ['a', 'b', 'c']) expect(fetched).toContain(`https://r2/sfx/${f}.m4a`)
    play()
    expect(player.wanted().map(c => c.file)).toEqual(['sfx/a.m4a'])
    random.mockReturnValue(0.9)
    const wrap = async () => { video.currentTime = 2; vi.advanceTimersByTime(30); video.currentTime = 0.8; vi.advanceTimersByTime(30); await flush() }
    await wrap()      // this play was mixed ahead; the one after it is drawn now
    await wrap()
    expect(player.wanted().map(c => c.file)).toEqual(['sfx/c.m4a'])
    expect(sources.at(-1)!.buffer!.cues![0].buffer!.url).toBe('sfx/c.m4a')
  })

  it('REQ-MOTION-039 draws every pool again and plays only the cues of the drawn option', async () => {
    const pools = [{ id: 'p', kind: 'random', options: [{ weight: 1 }, { weight: 1 }] }]
    const random = vi.spyOn(Math, 'random').mockReturnValue(0.1)
    await setup(meta([cue({ pool: 'p', option: 0 }), cue({ pool: 'p', option: 1, files: ['sfx/b.m4a'] })], { soundPools: pools }))
    expect(player.wanted().map(c => c.option)).toEqual([0])
    random.mockReturnValue(0.9)
    player.pickAll()
    await flush()
    player.pickAll()
    expect(player.wanted().map(c => c.option)).toEqual([1])
  })

  it('REQ-MOTION-039 mixes seven cues of one event in the same frame, all of them, inside the event\'s limit', async () => {
    const hit = { start: 1, event: 'event:/SFX/20220329/Hit', d3: true, files: ['sfx/hit.m4a'], mix: [[60, 0.3, 0.2]] as [number, number, number][] }
    await setup(meta(Array.from({ length: 7 }, () => cue(hit))))
    expect(cues).toHaveLength(7)
    expect(cues.every(s => s.stops.length === 0 && !stealed(s))).toBe(true)
    expect(new Set(cues.map(s => chain(s).to)).size).toBe(1)
  })

  it('REQ-MOTION-039 fades the oldest over 0.043 s once the event\'s limit is reached', async () => {
    const rules = { ...RULES, events: { 'event:/sfx/20220329/hit': { max: 3, d3: true } } }
    const hit = (start: number) => cue({ start, event: 'event:/SFX/20220329/Hit', files: ['sfx/hit.m4a'] })
    await setup(meta([hit(1), hit(1.01), hit(1.02), hit(1.03)]), rules)
    expect(cues.filter(stealed)).toHaveLength(1)
    expect(stealed(cues[0])).toBe(true)
    const left = chain(cues[0]).left.events, down = left.at(-1)!, before = left.at(-2)!
    expect([down.kind, down.v]).toEqual(['ramp', 0])
    expect(down.t - before.t).toBeCloseTo(0.043)
  })

  it('REQ-MOTION-039 sends a cue to the 3D limiter by its own d3, not by the rule of its event', async () => {
    await setup(meta([cue({ event: 'event:/SFX/20220329/Hit', d3: false }), cue({ event: 'event:/SFX/x', d3: true })]))
    const [plain, spatial] = cues.map(src => chain(src).to)
    expect(plain).not.toBe(spatial)
  })
})

describe('REQ-MOTION-040 the sound tail after the video ended', () => {
  it('REQ-MOTION-040 lets the track run past the end of the video, stops it at a seek', async () => {
    await setup(meta([cue({ start: 0.5 })]))
    play(0.3)
    video.currentTime = 2; video.ended = true; video.paused = true
    video.fire('pause'); video.fire('ended')
    expect(sources[0].stops).toHaveLength(0)
    video.ended = false; video.fire('seeking')
    expect(sources[0].stops).toHaveLength(1)
  })

  it('REQ-MOTION-040 ends the tail with stop(): nothing starts after it', async () => {
    await setup(meta([cue({ start: 2.2 })]))
    play(1.95)
    video.currentTime = 2; video.paused = true; video.ended = true
    video.fire('pause'); video.fire('ended')
    player.stop()
    ctx.currentTime = 10.4
    vi.advanceTimersByTime(30)
    expect(sources).toHaveLength(1)
  })

  it('REQ-MOTION-040 plays from the start again after the end', async () => {
    await setup(meta([cue({ start: 0.5 })]))
    play(0.3)
    video.currentTime = 2; video.paused = true; video.ended = true
    video.fire('pause'); video.fire('ended')
    video.ended = false
    ctx.currentTime = 13.5
    play(0)
    expect(sources).toHaveLength(2)
    expect(sources[1].started[0]).toEqual([expect.closeTo(13.52), expect.closeTo(0.02)])
  })
})

describe('REQ-MOTION-047 a video that stops for buffering', () => {
  it('REQ-MOTION-047 stops the sound at the stall, starts nothing while the video cannot play on, and resumes from its position', async () => {
    await setup(meta([cue({ start: 0.5 })]))
    play(0.3)
    video.currentTime = 1; ctx.currentTime = 10.7
    video.readyState = 2
    video.fire('waiting')
    expect(sources[0].stops).toHaveLength(1)
    ctx.currentTime = 20; vi.advanceTimersByTime(30)
    expect(sources).toHaveLength(1)
    video.readyState = 4; video.currentTime = 1.2; ctx.currentTime = 20.2
    video.fire('playing')
    vi.advanceTimersByTime(30)
    expect(sources).toHaveLength(2)
    expect(sources[1].started[0][1]).toBeCloseTo(1.22)
  })

  it('REQ-MOTION-047 joins when the mix is ready after the video started', async () => {
    let done = () => {}
    vi.spyOn(Offline.prototype, 'startRendering').mockImplementationOnce(function (this: Offline) { return new Promise(r => { done = () => r({ duration: 3, cues: this.made }) }) })
    vi.stubGlobal('fetch', vi.fn(async (url: string) => url.endsWith('sound_rules.json') ? { ok: true, json: async () => RULES } : { ok: true, arrayBuffer: async () => ({ url }) }))
    player = new SoundPlayer(); video = new Video()
    player.attach(video as unknown as HTMLVideoElement)
    player.setMuted(false)
    const loading = player.load('https://r2/', meta([cue({ start: 0.5 })]))
    await flush()
    play(0.3)
    expect(sources).toHaveLength(0)
    done()
    await loading
    vi.advanceTimersByTime(30)
    expect(sources).toHaveLength(1)
  })
})

describe('REQ-MOTION-051 play rules an edge keeps as missing', () => {
  it('REQ-MOTION-051 asks again past the cache, so the sound never goes on without the output and the limits', async () => {
    const urls: string[] = []
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      urls.push(url)
      if (url.endsWith('/sound_rules.json')) return { ok: false, status: 404 }
      return url.includes('sound_rules.json') ? { ok: true, json: async () => RULES } : { ok: true, arrayBuffer: async () => ({ url }) }
    }))
    player = new SoundPlayer(); video = new Video()
    player.attach(video as unknown as HTMLVideoElement)
    await player.load('https://r2/', meta([cue()]))
    expect(urls.filter(u => u.includes('sound_rules.json'))).toHaveLength(2)
    expect(gains.some(g => g.gain.value === 4)).toBe(true)
    expect(limiters.filter(l => l.ctx instanceof Offline)).toHaveLength(2)
  })
})

describe('REQ-MOTION-047 a sound file that is not on R2', () => {
  it('REQ-MOTION-047 stays silent and never decodes the error page', async () => {
    const decode = vi.spyOn(Ctx.prototype, 'decodeAudioData')
    await setup(meta([cue({ files: ['sfx/gone.m4a'] }), cue({ files: ['sfx/here.m4a'] })]), RULES, 'gone.m4a')
    expect(decode.mock.calls.map(call => (call[0] as unknown as { url: string }).url)).toEqual(['sfx/here.m4a'])
    expect(cues).toHaveLength(1)
    decode.mockRestore()
  })
})

describe('REQ-MOTION-039 the limit of an event', () => {
  const rules = { events: { 'event:/sfx/20220329/hit': { max: 8 } } }
  const hit = (start: number, file = 'f'): PlayCue => ({ ...cue({ start, event: 'event:/SFX/20220329/Hit' }), file })

  it('REQ-MOTION-039 cuts the oldest when a later start goes over, each cue for itself', () => {
    const first = Array.from({ length: 7 }, () => hit(1)), second = Array.from({ length: 7 }, () => hit(1.1))
    const out = limitCues([...first, ...second], rules, () => 1)
    expect(out).toHaveLength(14)
    expect(first.slice(0, 6).every(c => c.cut === 1.1)).toBe(true)
    expect(first[6].cut).toBeUndefined()
  })

  it('REQ-MOTION-039 leaves out starts of one frame beyond the limit, without cutting the others', () => {
    const cues = Array.from({ length: 10 }, () => hit(1))
    expect(limitCues(cues, rules, () => 1)).toHaveLength(8)
    expect(cues.every(c => c.cut === undefined)).toBe(true)
  })

  it('REQ-MOTION-039 leaves a cue alone once its file has ended, and events with no limit', () => {
    expect(limitCues(Array.from({ length: 12 }, (_, k) => hit(k)), rules, () => 0.5)).toHaveLength(12)
    expect(limitCues(Array.from({ length: 12 }, () => ({ ...cue({ start: 1, event: 'event:/x' }), file: 'f' })), rules, () => 1)).toHaveLength(12)
  })
})

describe('REQ-MOTION-049 the sound follows the picture', () => {
  beforeEach(() => { vi.stubGlobal('performance', { now: () => 0 }) })

  class Framed extends Video {
    report: ((now: number, md: { mediaTime: number; expectedDisplayTime: number }) => void) | null = null
    requestVideoFrameCallback(f: NonNullable<Framed['report']>) { this.report = f; return 1 }
    cancelVideoFrameCallback() { this.report = null }
  }
  async function framed(m: SoundMeta) {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => url.endsWith('sound_rules.json') ? { ok: true, json: async () => RULES } : { ok: true, arrayBuffer: async () => ({ url }) }))
    player = new SoundPlayer()
    const v = new Framed()
    player.attach(v as unknown as HTMLVideoElement)
    player.setMuted(false)
    await player.load('https://r2/', m)
    return v
  }

  it('REQ-MOTION-049 starts no sound before the first picture is reported, and lays the clock on that frame', async () => {
    const v = await framed(meta([cue({ start: 1 })]))
    v.currentTime = 0.8; v.paused = false
    v.fire('play'); v.fire('playing')
    vi.advanceTimersByTime(60)
    expect(sources).toHaveLength(0)
    // The first frame, 0.9 s of video, is on screen 0.03 s from now.
    v.report!(0, { mediaTime: 0.9, expectedDisplayTime: 30 })
    vi.advanceTimersByTime(30)
    expect(sources).toHaveLength(1)
    expect(sources[0].started[0][0]).toBeCloseTo(10.03, 3)
    expect(sources[0].started[0][1]).toBeCloseTo(0.9, 3)
  })

  it('REQ-MOTION-049 moves the track to the picture when the video has really fallen behind', async () => {
    const v = await framed(meta([cue({ start: 0.5 })]))
    v.currentTime = 0.4; v.paused = false
    v.fire('playing')
    v.report!(0, { mediaTime: 0.4, expectedDisplayTime: 0 })
    vi.advanceTimersByTime(30)
    expect(sources).toHaveLength(1)
    ctx.currentTime = 11.6
    v.report!(0, { mediaTime: 1.8, expectedDisplayTime: 0 })   // 0.2 s behind the audio clock
    expect(sources[0].stops).toHaveLength(1)
    expect(sources[1].started[0][1]).toBeCloseTo(1.82, 3)
  })

  it('REQ-MOTION-049 leaves the track alone through the jitter of frame reports', async () => {
    const v = await framed(meta([cue({ start: 0.5 })]))
    v.currentTime = 0.4; v.paused = false
    v.fire('playing')
    v.report!(0, { mediaTime: 0.4, expectedDisplayTime: 0 })
    vi.advanceTimersByTime(30)
    ctx.currentTime = 10.05
    v.report!(0, { mediaTime: 0.46, expectedDisplayTime: 0 })   // 0.01 s off the clock
    vi.advanceTimersByTime(30)
    expect(sources).toHaveLength(1)
    expect(sources[0].stops).toHaveLength(0)
  })
})

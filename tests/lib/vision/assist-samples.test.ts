import { expect, it, vi } from 'vitest'
import { parseSampleMeta, readSampleConsent, SAMPLES_STORAGE_KEY, takeDailySample } from '@/lib/vision/assist-samples'
import { checkRateLimit } from '@/lib/rate-limit'

const memory = () => {
  const items = new Map<string, string>()
  return { getItem: (key: string) => items.get(key) ?? null, setItem: (key: string, value: string) => { items.set(key, value) } }
}

it('stays off until chosen', () => {
  expect(readSampleConsent(memory())).toBeNull()
  expect(readSampleConsent({ getItem: key => key === SAMPLES_STORAGE_KEY ? 'on' : null })).toBe(true)
  expect(readSampleConsent({ getItem: () => 'off' })).toBe(false)
  expect(readSampleConsent({ getItem: () => { throw new Error('blocked') } })).toBeNull()
})

it('allows 30 samples per local day and starts over the next day', () => {
  const storage = memory()
  const day = new Date(2026, 8, 25, 23, 0)
  for (let index = 0; index < 30; index++) expect(takeDailySample(storage, day)).toBe(true)
  expect(takeDailySample(storage, day)).toBe(false)
  expect(takeDailySample(storage, new Date(2026, 8, 26, 0, 1))).toBe(true)
  expect(takeDailySample({ getItem: () => null, setItem: () => { throw new Error('full') } }, day)).toBe(false)
})

const valid = { reason: 'popup-unresolved', scene: { label: 'gift_acquired', confidence: 0.4 }, mode: 'balanced',
  detection: { gifts: true, themes: false, events: true }, inference: { provider: 'webgpu', adapter: 'nvidia' }, ocr: null,
  width: 2560, height: 1440, dpr: 1.25, userAgent: 'Chrome', build: null, floor: 3, candidates: ['9001'], clientAt: 1_790_000_000_000 }

it('keeps known metadata fields only and rejects malformed samples', () => {
  expect(parseSampleMeta({ ...valid, email: 'x@y.z', detection: { ...valid.detection, extra: true } })).toEqual(valid)
  expect(parseSampleMeta({ ...valid, scene: null, inference: null, floor: null })).toMatchObject({ scene: null, inference: null, floor: null })
  for (const change of [{ reason: 'other' }, { width: 0 }, { width: 1.5 }, { dpr: Infinity }, { floor: '3' }, { scene: { label: 'x', confidence: 2 } },
    { detection: { gifts: true } }, { candidates: Array(21).fill('1') }, { userAgent: 'x'.repeat(401) }, { ocr: { engine: 'paddle' } }])
    expect(parseSampleMeta({ ...valid, ...change })).toBeNull()
  expect(parseSampleMeta(null)).toBeNull()
  expect(parseSampleMeta([valid])).toBeNull()
})

it('limits sample posts to 30 a day per key', () => {
  for (let index = 0; index < 30; index++) expect(checkRateLimit('assist-samples:test', 'sample').allowed).toBe(true)
  expect(checkRateLimit('assist-samples:test', 'sample').allowed).toBe(false)
})

it('keeps a fusion folder in the browser: discarded when read in full, sent with the next frames when not', async () => {
  const { AssistSampleRecorder } = await import('@/lib/vision/assist-samples')
  const bitmaps: { closed: boolean }[] = []
  const bitmap = () => { const b = { width: 1280, height: 720, closed: false, close() { b.closed = true } }; bitmaps.push(b); return b }
  let clock = 0
  vi.spyOn(performance, 'now').mockImplementation(() => (clock += 400))
  vi.stubGlobal('createImageBitmap', async () => bitmap())
  vi.stubGlobal('window', { localStorage: memory() })
  vi.stubGlobal('OffscreenCanvas', class { getContext() { return { transferFromImageBitmap() {} } } async convertToBlob() { return new Blob(['j'], { type: 'image/jpeg' }) } })
  const posts: FormData[] = []
  vi.stubGlobal('fetch', async (_url: string, init: { body: FormData }) => { posts.push(init.body); return new Response(null) })
  const frame = { displayWidth: 1920, displayHeight: 1080, clone: () => ({ close() {} }) } as unknown as VideoFrame
  const settle = () => new Promise(resolve => setTimeout(resolve, 0))
  const recorder = new AssistSampleRecorder(() => ({ scene: null, mode: 'quality', detection: { gifts: true, themes: true, events: true }, inference: null, ocr: null, dpr: 1, userAgent: 't', build: null, floor: 1 }))

  await recorder.keepFrame({} as ImageBitmapSource, 1920, 1080)
  await recorder.keepFrame({} as ImageBitmapSource, 1920, 1080)
  recorder.closeFolder(null)
  expect(bitmaps.slice(0, 2).every(b => b.closed)).toBe(true)
  expect(posts).toHaveLength(0)

  await recorder.keepFrame({} as ImageBitmapSource, 1920, 1080)
  recorder.markNext()
  recorder.offer(frame); await settle(); await settle()
  recorder.closeFolder({ reason: 'fusion-materials', candidates: ['9108'] })
  for (let i = 0; i < 3; i++) { recorder.offer(frame); await settle(); await settle() }
  await settle()
  expect(posts).toHaveLength(1)
  expect(posts[0].getAll('frame')).toHaveLength(5)
  expect(JSON.parse(String(posts[0].get('meta')))).toMatchObject({ reason: 'fusion-materials', candidates: ['9108'] })
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})
it('sends at most six scenes of a fusion folder plus the frames after it', async () => {
  const { AssistSampleRecorder } = await import('@/lib/vision/assist-samples')
  let clock = 0
  vi.spyOn(performance, 'now').mockImplementation(() => (clock += 400))
  vi.stubGlobal('createImageBitmap', async () => ({ width: 1280, height: 720, close() {} }))
  vi.stubGlobal('window', { localStorage: memory() })
  vi.stubGlobal('OffscreenCanvas', class { getContext() { return { transferFromImageBitmap() {} } } async convertToBlob() { return new Blob(['j'], { type: 'image/jpeg' }) } })
  const posts: FormData[] = []
  vi.stubGlobal('fetch', async (_url: string, init: { body: FormData }) => { posts.push(init.body); return new Response(null) })
  const frame = { displayWidth: 1920, displayHeight: 1080, clone: () => ({ close() {} }) } as unknown as VideoFrame
  const settle = () => new Promise(resolve => setTimeout(resolve, 0))
  const recorder = new AssistSampleRecorder(() => ({ scene: null, mode: 'quality', detection: { gifts: true, themes: true, events: true }, inference: null, ocr: null, dpr: 1, userAgent: 't', build: null, floor: 1 }))
  for (let i = 0; i < 9; i++) await recorder.keepFrame({} as ImageBitmapSource, 1920, 1080)
  recorder.closeFolder({ reason: 'fusion-dialogless', candidates: [] })
  for (let i = 0; i < 3; i++) { recorder.offer(frame); await settle(); await settle() }
  await settle()
  expect(posts[0].getAll('frame')).toHaveLength(9)
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

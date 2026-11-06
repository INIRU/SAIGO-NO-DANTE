import { expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { AssistSampleRecorder, parseSampleMeta, readSampleConsent, SAMPLE_CONSENT, SAMPLE_DAILY_LIMIT, sampleExpiresAt, SAMPLES_STORAGE_KEY, screenChanged, takeDailySample, type SampleMeta } from '@/features/assist/lib/assist-samples'
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

it('allows a limited number of samples per local day and starts over the next day', () => {
  const storage = memory()
  const day = new Date(2026, 8, 25, 23, 0)
  for (let index = 0; index < SAMPLE_DAILY_LIMIT; index++) expect(takeDailySample(storage, day)).toBe(true)
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
  // The game language tells English and Japanese samples apart (older samples have none).
  expect(parseSampleMeta({ ...valid, language: 'ja' })).toEqual({ ...valid, language: 'ja' })
  for (const change of [{ reason: 'other' }, { width: 0 }, { width: 1.5 }, { dpr: Infinity }, { floor: '3' }, { scene: { label: 'x', confidence: 2 } },
    { detection: { gifts: true } }, { candidates: Array(21).fill('1') }, { userAgent: 'x'.repeat(401) }, { ocr: { engine: 'paddle' } }, { language: 'fr' }])
    expect(parseSampleMeta({ ...valid, ...change })).toBeNull()
  expect(parseSampleMeta(null)).toBeNull()
  // REQ-ASSIST-069: the read diagnosis of a failed fusion is a short string or absent.
  expect(parseSampleMeta({ ...valid, diagnosis: 'v1;d=1' })).toEqual({ ...valid, diagnosis: 'v1;d=1' })
  for (const diagnosis of ['x'.repeat(601), 5, null, { v: 1 }]) expect(parseSampleMeta({ ...valid, diagnosis })).toBeNull()
  expect(parseSampleMeta([valid])).toBeNull()
})

it('limits sample posts to 30 a day per key', () => {
  for (let index = 0; index < 30; index++) expect(checkRateLimit('assist-samples:test', 'sample').allowed).toBe(true)
  expect(checkRateLimit('assist-samples:test', 'sample').allowed).toBe(false)
})

function recorderHarness() {
  let clock = 0
  let shade = 0
  vi.spyOn(performance, 'now').mockImplementation(() => (clock += 400))
  vi.stubGlobal('window', { localStorage: memory() })
  vi.stubGlobal('createImageBitmap', async () => ({ width: 1280, height: 720, close() {} }))
  vi.stubGlobal('OffscreenCanvas', class {
    getContext(kind: string) {
      return kind === '2d' ? { drawImage() {}, getImageData: () => ({ data: new Uint8ClampedArray(64 * 36 * 4).fill(shade) }) } : { transferFromImageBitmap() {} }
    }
    async convertToBlob() { return new Blob(['frame' + shade], { type: 'image/jpeg' }) }
  })
  const uploads: { reason: string; frames: string[] }[] = []
  const metas: SampleMeta[] = []
  const recorder = new AssistSampleRecorder(() => ({ scene: null, mode: 'quality', detection: { gifts: true, themes: true, events: true },
    inference: null, ocr: null, dpr: 1, userAgent: 't', build: null, floor: 1 }), async (meta, frames) => {
    metas.push(meta)
    uploads.push({ reason: meta.reason, frames: await Promise.all(frames.map(frame => frame.text())) })
  })
  const frame = { displayWidth: 1920, displayHeight: 1080, clone: () => ({ displayWidth: 1920, displayHeight: 1080, close() {} }) } as unknown as VideoFrame
  const offer = async (next: number) => {
    shade = next
    recorder.offer(frame)
    for (let i = 0; i < 4; i++) await new Promise(resolve => setTimeout(resolve, 0))
  }
  return { recorder, uploads, metas, offer }
}

it('tells a changed screen from a still one', () => {
  const still = new Uint8Array(64 * 36).fill(80)
  const cursor = still.slice(); cursor[5] = 200
  const popup = still.slice(); popup.fill(200, 0, 40)
  expect(screenChanged(null, still)).toBe(true)
  expect(screenChanged(still, still.slice())).toBe(false)
  expect(screenChanged(still, cursor)).toBe(false)
  expect(screenChanged(still, popup)).toBe(true)
})

it('discards the frame group of an action that was read', async () => {
  const { recorder, uploads, offer } = recorderHarness()
  recorder.begin('popup:1')
  await offer(40); await offer(80)
  recorder.end('popup:1', null)
  for (const shade of [120, 160, 200, 240]) await offer(shade)
  expect(uploads).toEqual([])
  vi.unstubAllGlobals(); vi.restoreAllMocks()
})

it('uploads the whole group of a failed action with the frames just before and after it', async () => {
  const { recorder, uploads, offer, metas } = recorderHarness()
  await offer(40)
  recorder.begin('fusion')
  await offer(80); await offer(80); await offer(120)
  recorder.end('fusion', { reason: 'fusion-materials', candidates: ['9108'], diagnosis: 'v1;d=0;n=2/3' })
  await offer(160); await offer(200)
  expect(uploads).toEqual([])
  await offer(240)
  // REQ-ASSIST-069: the diagnosis given with the failure travels in the sample's metadata.
  expect(metas.at(-1)).toMatchObject({ reason: 'fusion-materials', candidates: ['9108'], diagnosis: 'v1;d=0;n=2/3' })
  expect(uploads).toEqual([{ reason: 'fusion-materials', frames: ['frame40', 'frame80', 'frame120', 'frame160', 'frame200', 'frame240'] }])
  vi.unstubAllGlobals(); vi.restoreAllMocks()
})

const root = (file: string) => readFileSync(resolve(__dirname, '../../../..', file), 'utf8')

it('REQ-ASSIST-062 asks again under the training consent and marks the samples sent under it', async () => {
  expect(SAMPLES_STORAGE_KEY).toBe('limbus-assist-samples-v3')
  // A choice made under the earlier text (180 days, then deleted) does not carry over.
  expect(readSampleConsent({ getItem: key => key === 'limbus-assist-samples-v2' ? 'on' : null })).toBeNull()
  const { recorder, metas, offer } = recorderHarness()
  await offer(40)
  recorder.end('sale', { reason: 'sale-unresolved' })
  await offer(80); await offer(120); await offer(160)
  expect(metas.map(meta => meta.consent)).toEqual([SAMPLE_CONSENT])
  expect(SAMPLE_CONSENT).toBe(3)
  vi.unstubAllGlobals(); vi.restoreAllMocks()
  expect(parseSampleMeta({ ...valid, consent: 3 })).toEqual({ ...valid, consent: 3 })
  expect(parseSampleMeta(valid)).not.toHaveProperty('consent')
  for (const consent of ['3', 0, 2.5, 1000]) expect(parseSampleMeta({ ...valid, consent })).toBeNull()
})

it('REQ-ASSIST-062 the consent text says the frames train the recognizer, warns about whole-screen sharing and promises no deletion date, in every language', () => {
  const words = { ko: ['학습', '전체 화면'], en: ['train', 'entire screen'], ja: ['学習', '画面全体'] }
  for (const [lang, expected] of Object.entries(words)) {
    const hint: string = JSON.parse(root(`messages/${lang}.json`)).planner.run.samplesHint
    for (const word of expected) expect(hint, lang).toContain(word)
    expect(hint, lang).not.toMatch(/180/)
  }
})

it('REQ-ASSIST-063 only samples from before the training consent expire, 180 days after they were received', () => {
  const received = '2026-09-28T07:47:00.000Z'
  expect(sampleExpiresAt({ created_at: received, meta: {} })).toBe(Date.parse('2027-03-27T07:47:00.000Z'))
  expect(sampleExpiresAt({ created_at: received, meta: { consent: 2 } })).toBe(Date.parse('2027-03-27T07:47:00.000Z'))
  expect(sampleExpiresAt({ created_at: received, meta: { consent: 3 } })).toBeNull()
  expect(sampleExpiresAt({ created_at: received, meta: null })).toBe(Date.parse('2027-03-27T07:47:00.000Z'))
  // The server picks the same rows: no consent version in the metadata, older than the same period.
  const route = root('app/api/assist/samples/route.ts')
  expect(route).toMatch(/\.is\('meta->consent', null\)/)
  expect(route).toContain('SAMPLE_KEEP_MS')
})

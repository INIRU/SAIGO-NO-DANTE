import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DungeonGL } from '@/features/story/lib/dungeon-gl'

// A fake WebGL2: every method answers with a truthy object, and the calls that make textures are counted.
function fakeGl() {
  const calls = { createTexture: 0, deleteTexture: 0 }
  const gl = new Proxy({}, {
    get: (_t, prop: string) => {
      if (prop === 'createTexture') return () => { calls.createTexture++; return {} }
      if (prop === 'deleteTexture') return () => { calls.deleteTexture++ }
      return () => ({})
    },
  })
  return { gl, calls }
}

type Deferred<T> = { promise: Promise<T>; resolve: (v: T) => void }
const deferred = <T,>(): Deferred<T> => { let resolve!: (v: T) => void; const promise = new Promise<T>(r => { resolve = r }); return { promise, resolve } }
const settle = () => new Promise(r => setTimeout(r, 0))

/** Smallest font file the metric reader accepts: a header, a head table and a hhea table. */
function fontFile() {
  const buf = new ArrayBuffer(100)
  const v = new DataView(buf)
  v.setUint16(4, 2)
  for (const [i, tag, offset] of [[0, 'head', 44], [1, 'hhea', 70]] as const) {
    const o = 12 + 16 * i
    for (let c = 0; c < 4; c++) v.setUint8(o + c, tag.charCodeAt(c))
    v.setUint32(o + 8, offset)
  }
  v.setUint16(44 + 18, 1000)
  v.setInt16(70 + 4, 900)
  v.setInt16(70 + 6, -200)
  return buf
}

let added: string[]
let deleted: string[]
let faces: string[]
let bitmapClosed: number
let pending: { fetches: Deferred<unknown>[] }

beforeEach(() => {
  added = []; deleted = []; faces = []; bitmapClosed = 0
  pending = { fetches: [] }
  vi.stubGlobal('window', { matchMedia: () => ({ matches: false }) })
  vi.stubGlobal('ImageData', class {})
  vi.stubGlobal('document', { fonts: { add: (f: { family: string }) => added.push(f.family), delete: (f: { family: string }) => deleted.push(f.family) } })
  vi.stubGlobal('FontFace', class {
    constructor(public family: string) { faces.push(family) }
    load() { return Promise.resolve(this) }
  })
  vi.stubGlobal('createImageBitmap', async () => ({ width: 2, height: 2, close: () => { bitmapClosed++ } }))
  vi.stubGlobal('fetch', () => { const d = deferred<unknown>(); pending.fetches.push(d); return d.promise })
})
afterEach(() => vi.unstubAllGlobals())

function make() {
  const { gl, calls } = fakeGl()
  const canvas = { getContext: () => gl } as unknown as HTMLCanvasElement
  const dgl = new DungeonGL(canvas)
  return { dgl: dgl as unknown as { get(url: string): unknown; font(url: string): unknown; webFont(url: string): unknown; onLoad: () => void; destroy(): void }, calls }
}

describe('DungeonGL after destroy()', () => {
  it('closes a picture that arrives after destroy() and makes no texture', async () => {
    const { dgl, calls } = make()
    dgl.get('a.png')
    dgl.destroy()
    const before = calls.createTexture
    pending.fetches[0].resolve({ ok: true, blob: async () => ({}) })
    await settle()

    expect(bitmapClosed).toBe(1)
    expect(calls.createTexture).toBe(before)
  })

  it('still makes the texture of a picture that arrives before destroy()', async () => {
    const { dgl, calls } = make()
    const onLoad = vi.fn()
    dgl.onLoad = onLoad
    dgl.get('a.png')
    const before = calls.createTexture
    pending.fetches[0].resolve({ ok: true, blob: async () => ({}) })
    await settle()

    expect(calls.createTexture).toBe(before + 1)
    expect(onLoad).toHaveBeenCalledTimes(1)
  })

  it('does not register a font file that finishes loading after destroy()', async () => {
    const { dgl } = make()
    dgl.font('a.ttf')
    dgl.destroy()
    pending.fetches[0].resolve({ arrayBuffer: async () => fontFile() })
    await settle()

    expect(added).toEqual([])
  })

  it('does not register a web font that finishes loading after destroy()', async () => {
    const { dgl } = make()
    dgl.webFont('a.woff2')
    dgl.destroy()
    await settle()

    expect(added).toEqual([])
  })

  it('removes the fonts it registered from document.fonts on destroy()', async () => {
    const { dgl } = make()
    dgl.font('a.ttf')
    dgl.webFont('b.woff2')
    pending.fetches[0].resolve({ arrayBuffer: async () => fontFile() })
    await settle()
    expect(added).toHaveLength(2)

    dgl.destroy()
    expect(deleted.sort()).toEqual([...added].sort())
  })

  it('gives two instances font names that never meet', () => {
    const first = make().dgl
    const second = make().dgl
    first.webFont('a.woff2')
    second.webFont('a.woff2')

    expect(faces).toHaveLength(2)
    expect(new Set(faces).size).toBe(2)
  })
})

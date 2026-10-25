import { test, expect, type Page } from '@playwright/test'
import { buildSync } from 'esbuild'
import { resolve } from 'node:path'
import type { LayerSetMeta } from '../lib/motion/compositor'

test.use({ channel: 'chrome' })

// The compositor as the browser runs it, on the real GPU path (WebGL2), without the page around it.
const bundle = buildSync({ entryPoints: [resolve(__dirname, '../lib/motion/compositor.ts')], bundle: true, format: 'iife', globalName: 'MotionCompositor', write: false }).outputFiles[0].text

type Tile = { x: number; y: number; w: number; h: number; rgb: [number, number, number] }

/** Draws `meta` from a canvas painted with `tiles` (WebGL reads a canvas like a video frame) and returns the middle pixel, 0..1. */
async function compose(page: Page, meta: LayerSetMeta, tiles: Tile[], on: boolean[], frame = 0): Promise<number[]> {
  return page.evaluate(({ meta, tiles, on, frame }) => {
    const source = document.createElement('canvas')
    source.width = meta.video.w
    source.height = meta.video.h
    const ctx = source.getContext('2d')!
    ctx.fillStyle = 'rgb(0,0,0)'
    ctx.fillRect(0, 0, source.width, source.height)
    for (const t of tiles) { ctx.fillStyle = `rgb(${t.rgb.join(',')})`; ctx.fillRect(t.x, t.y, t.w, t.h) }
    const { LayerCompositor } = (window as unknown as { MotionCompositor: typeof import('../lib/motion/compositor') }).MotionCompositor
    const comp = new LayerCompositor(document.createElement('canvas'), meta)
    on.forEach((value, k) => { comp.on[k] = value })
    comp.draw(source as unknown as HTMLVideoElement, frame)
    const px = new Uint8Array(4)
    comp.gl.readPixels(meta.tile.w >> 1, meta.tile.h >> 1, 1, 1, comp.gl.RGBA, comp.gl.UNSIGNED_BYTE, px)
    return [px[0] / 255, px[1] / 255, px[2] / 255]
  }, { meta, tiles, on, frame })
}

const near = (got: number[], want: number[]) => got.forEach((value, i) => expect(Math.abs(value - want[i]), `channel ${i}: ${got} vs ${want}`).toBeLessThanOrEqual(3 / 255))
const clamp = (v: number) => Math.min(1, Math.max(0, v))
const grey = (v: number): [number, number, number] => [v, v, v]

// Version 7: 8×8 canvas from a 16×16 video; Y, Cb, Cr planes in three quarters, the layer's Y/Co/Cg tiles inside the fourth.
const v7 = (layers: LayerSetMeta['layers']): LayerSetMeta => ({
  version: 7, baseAllOn: true, skill: { name: 't' }, fps: 60, frames: 10, tile: { w: 8, h: 8 }, video: { file: 'layers.mp4', w: 16, h: 16 },
  base: { x: 0, y: 0, w: 8, h: 8 },
  basePlanes: { y: { x: 0, y: 0, w: 8, h: 8 }, cb: { x: 8, y: 0, w: 8, h: 8 }, cr: { x: 0, y: 8, w: 8, h: 8 } },
  layers,
})
const LAYER = { id: 'buff', label: 'buff', ycocg: { y: { x: 8, y: 8, w: 4, h: 4 }, co: { x: 12, y: 8, w: 4, h: 4 }, cg: { x: 8, y: 12, w: 4, h: 4 } }, visible: [[5, 6]] as [number, number][] }
const Y = 128, CB = 153, CR = 102, LY = 153, LCO = 140, LCG = 115
const planes: Tile[] = [{ x: 0, y: 0, w: 8, h: 8, rgb: grey(Y) }, { x: 8, y: 0, w: 8, h: 8, rgb: grey(CB) }, { x: 0, y: 8, w: 8, h: 8, rgb: grey(CR) }]
const layerTiles: Tile[] = [{ x: 8, y: 8, w: 4, h: 4, rgb: grey(LY) }, { x: 12, y: 8, w: 4, h: 4, rgb: grey(LCO) }, { x: 8, y: 12, w: 4, h: 4, rgb: grey(LCG) }]
const [y, cb, cr] = [Y / 255, CB / 255, CR / 255]
const base = [y + 1.5748 * (cr - 0.5), y - 0.1873 * (cb - 0.5) - 0.4681 * (cr - 0.5), y + 1.8556 * (cb - 0.5)]
const v = [LY, LCO, LCG].map(n => { const e = (n / 255) * 2 - 1; return Math.sign(e) * e * e })
const withoutLayer = [base[0] - (v[0] + v[1] - v[2]), base[1] - (v[0] + v[2]), base[2] - (v[0] - v[1] - v[2])]

test.beforeEach(async ({ page }) => {
  await page.setContent('<!doctype html><html><body></body></html>')
  await page.addScriptTag({ content: bundle })
})

test('REQ-MOTION-028 version 7 draws the Y·Cb·Cr planes as the Unity picture when every layer is on', async ({ page }) => {
  near(await compose(page, v7([LAYER]), [...planes, ...layerTiles], [true]), base.map(clamp))
})

test('REQ-MOTION-028 version 7 takes a switched-off layer out, whatever its visible frames say', async ({ page }) => {
  near(await compose(page, v7([LAYER]), [...planes, ...layerTiles], [false], 0), withoutLayer.map(clamp))
})

test('REQ-MOTION-028 version 7 leaves an empty layer alone even when switched off', async ({ page }) => {
  near(await compose(page, v7([{ id: 'none', label: 'none', empty: true }]), planes, [false]), base.map(clamp))
})

test('REQ-MOTION-028 version 4·5 still adds the switched-on layers in their visible frames', async ({ page }) => {
  const meta: LayerSetMeta = {
    skill: { name: 't' }, fps: 60, frames: 10, tile: { w: 8, h: 8 }, video: { file: 'layers.mp4', w: 16, h: 8 },
    base: { x: 0, y: 0 }, layers: [{ id: 'buff', label: 'buff', delta: { x: 8, y: 0 }, visible: [[5, 6]] }],
  }
  const tiles: Tile[] = [{ x: 0, y: 0, w: 8, h: 8, rgb: [100, 120, 140] }, { x: 8, y: 0, w: 8, h: 8, rgb: [153, 128, 102] }]
  const d = [153, 128, 102].map(n => { const e = (n / 255) * 2 - 1; return Math.sign(e) * e * e })
  const plain = [100 / 255, 120 / 255, 140 / 255]
  near(await compose(page, meta, tiles, [true], 5), plain.map((c, i) => clamp(c + d[i])))
  near(await compose(page, meta, tiles, [true], 0), plain)
  near(await compose(page, meta, tiles, [false], 5), plain)
})

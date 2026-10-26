import { test, expect, type Page } from '@playwright/test'
import { buildSync } from 'esbuild'
import { resolve } from 'node:path'
import type { LayerSetMeta } from '../lib/motion/compositor'

test.use({ channel: 'chrome' })

// The compositor as the browser runs it, on the real GPU path (WebGL2), without the page around it.
const bundle = buildSync({ entryPoints: [resolve(__dirname, '../lib/motion/compositor.ts')], bundle: true, format: 'iife', globalName: 'MotionCompositor', write: false }).outputFiles[0].text

type Tile = { x: number; y: number; w: number; h: number; rgb: [number, number, number] }

/** Draws `meta` from a canvas painted with `tiles` (WebGL reads a canvas like a video frame) and returns the middle pixel, 0..1. */
async function compose(page: Page, meta: LayerSetMeta, tiles: Tile[]): Promise<number[]> {
  return page.evaluate(({ meta, tiles }) => {
    const source = document.createElement('canvas')
    source.width = meta.video.w
    source.height = meta.video.h
    const ctx = source.getContext('2d')!
    ctx.fillStyle = 'rgb(0,0,0)'
    ctx.fillRect(0, 0, source.width, source.height)
    for (const t of tiles) { ctx.fillStyle = `rgb(${t.rgb.join(',')})`; ctx.fillRect(t.x, t.y, t.w, t.h) }
    const { LayerCompositor } = (window as unknown as { MotionCompositor: typeof import('../lib/motion/compositor') }).MotionCompositor
    const comp = new LayerCompositor(document.createElement('canvas'), meta)
    comp.draw(source as unknown as HTMLVideoElement)
    const px = new Uint8Array(4)
    comp.gl.readPixels(meta.tile.w >> 1, meta.tile.h >> 1, 1, 1, comp.gl.RGBA, comp.gl.UNSIGNED_BYTE, px)
    return [px[0] / 255, px[1] / 255, px[2] / 255]
  }, { meta, tiles })
}

const near = (got: number[], want: number[]) => got.forEach((value, i) => expect(Math.abs(value - want[i]), `channel ${i}: ${got} vs ${want}`).toBeLessThanOrEqual(3 / 255))
const clamp = (v: number) => Math.min(1, Math.max(0, v))
const grey = (v: number): [number, number, number] => [v, v, v]

// Version 9: 8×8 canvas from a 16×16 video, the Y, Cb and Cr planes in three quarters (the fourth holds the frame code).
const meta: LayerSetMeta = {
  version: 9, fps: 60, frames: 10, tile: { w: 8, h: 8 }, video: { file: 'layers.mp4', w: 16, h: 16 },
  basePlanes: { y: { x: 0, y: 0, w: 8, h: 8 }, cb: { x: 8, y: 0, w: 8, h: 8 }, cr: { x: 0, y: 8, w: 8, h: 8 } },
}
const Y = 128, CB = 153, CR = 102
const planes: Tile[] = [{ x: 0, y: 0, w: 8, h: 8, rgb: grey(Y) }, { x: 8, y: 0, w: 8, h: 8, rgb: grey(CB) }, { x: 0, y: 8, w: 8, h: 8, rgb: grey(CR) }, { x: 8, y: 8, w: 8, h: 8, rgb: grey(255) }]
const [y, cb, cr] = [Y / 255, CB / 255, CR / 255]
const picture = [y + 1.5748 * (cr - 0.5), y - 0.1873 * (cb - 0.5) - 0.4681 * (cr - 0.5), y + 1.8556 * (cb - 0.5)]

test.beforeEach(async ({ page }) => {
  await page.setContent('<!doctype html><html><body></body></html>')
  await page.addScriptTag({ content: bundle })
})

test('REQ-MOTION-028 version 9 draws the Y·Cb·Cr planes as the Unity picture (BT.709 full range)', async ({ page }) => {
  near(await compose(page, meta, planes), picture.map(clamp))
})

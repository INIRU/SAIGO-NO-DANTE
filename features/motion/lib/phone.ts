// A phone plays the smaller copy of a video when its layers.json lists one (`phone`): the same Y, Cb, Cr planes, every size scaled.
// The full video is 1920×3240 at 60 fps, more than a phone decodes and uploads to the GPU smoothly; its screen shows about 1200 px across.
import type { LayerSetMeta, Rect } from './compositor'

export type PhoneVideo = { file: string; w: number; h: number }

/** A small touch screen (the short side under 600 CSS px: a tablet keeps the full video). `?video=phone` / `?video=full` in the address decides it by hand. */
export function isPhone(): boolean {
  if (typeof window === 'undefined') return false
  const asked = new URLSearchParams(window.location?.search ?? '').get('video')
  if (asked === 'phone' || asked === 'full') return asked === 'phone'
  return !!window.matchMedia?.('(pointer: coarse)').matches && Math.min(window.screen.width, window.screen.height) < 600
}

/** The layers.json of the phone copy: null when there is none, or when the video has layers (their tiles are not scaled here). */
export function phoneMeta<M extends LayerSetMeta & { phone?: PhoneVideo; layers?: unknown[] }>(m: M): M | null {
  const p = m.phone, planes = m.basePlanes
  if (!p || !planes || m.layers?.length || m.chroma || m.frameCode) return null
  const s = p.w / m.video.w
  const scale = (r: Rect): Rect => ({ x: Math.round(r.x * s), y: Math.round(r.y * s), w: Math.round((r.w ?? m.tile.w) * s), h: Math.round((r.h ?? m.tile.h) * s) })
  return {
    ...m,
    tile: { w: Math.round(m.tile.w * s), h: Math.round(m.tile.h * s) },
    video: { file: p.file, w: p.w, h: p.h },
    basePlanes: { y: scale(planes.y), ...(planes.cb && { cb: scale(planes.cb) }), ...(planes.cr && { cr: scale(planes.cr) }) },
  }
}

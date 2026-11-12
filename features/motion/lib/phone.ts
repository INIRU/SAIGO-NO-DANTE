// A phone plays the plain copy of a video when its layers.json lists one (`phone`): an ordinary colour video at the picture's size.
// The full video stacks the Y, Cb, Cr planes (1920×3240 at 60 fps): three times the pixels to decode and to upload to the GPU every
// frame, more than a phone does smoothly. The plain copy has half the colour resolution (4:2:0), which a phone's screen does not show.
import type { LayerSetMeta } from './compositor'

export type PhoneVideo = { file: string; w: number; h: number }

/** A small touch screen (the short side under 600 CSS px: a tablet keeps the full video). `?video=phone` / `?video=full` in the address decides it by hand. */
export function isPhone(): boolean {
  if (typeof window === 'undefined') return false
  const asked = new URLSearchParams(window.location?.search ?? '').get('video')
  if (asked === 'phone' || asked === 'full') return asked === 'phone'
  return !!window.matchMedia?.('(pointer: coarse)').matches && Math.min(window.screen.width, window.screen.height) < 600
}

/** The layers.json of the phone copy, drawn as one colour picture: null when there is none, or when the video has layers (they need the planes). */
export function phoneMeta<M extends LayerSetMeta & { phone?: PhoneVideo; layers?: unknown[] }>(m: M): M | null {
  const p = m.phone
  if (!p || m.layers?.length || m.chroma || m.frameCode) return null
  return { ...m, tile: { w: p.w, h: p.h }, video: { file: p.file, w: p.w, h: p.h }, base: { x: 0, y: 0, w: p.w, h: p.h }, basePlanes: undefined }
}

// The stage map camera as the game moves it.
// [ScrollView]StageMap is the 3000 x 1350 panel; its Content is anchored at the viewport's top-left with pivot (0, 0),
// so the content's anchored position is minus the viewport's top-left corner in map pixels (y from the bottom). The
// camera centre used here is the viewport's centre. Map tiles are 2048 px drawn every 2028 px (map cols*2028+20 wide).

import type { CameraSetting } from '@/lib/story-map'

export const STRIDE = 2028

export interface Cam { x: number; y: number }

function entry(list: CameraSetting['y'], key: number) {
  const e = list.find(([from, to]) => key >= from && key <= to)
  return e ? { lo: e[2], hi: e[3] } : null
}

/** [UIPanel]StageMapUIPanel's size: the scroll viewport in map pixels. */
export const VIEWPORT = { w: 3000, h: 1350 }

const contentOf = (c: Cam) => ({ x: -(c.x - VIEWPORT.w / 2), y: -(c.y + VIEWPORT.h / 2) })
const camOf = (x: number, y: number): Cam => ({ x: -x + VIEWPORT.w / 2, y: -y - VIEWPORT.h / 2 })

/** Moves the camera from `cur` towards `to` the way the game clamps it. */
export function clampCamera(to: Cam, cur: Cam, map: { w: number; h: number }, setting: CameraSetting): Cam {
  const t = contentOf(to), c = contentOf(cur)
  if (!setting.x.length && !setting.y.length) {
    // No boundarySetting: Unity's clamped ScrollRect keeps the viewport on the map; a map smaller than the viewport
    // stays at the top-left where the content is anchored.
    const x = Math.min(0, Math.max(t.x, -Math.max(0, map.w - VIEWPORT.w)))
    const y = Math.min(-Math.min(VIEWPORT.h, map.h), Math.max(t.y, -map.h))
    return camOf(x, y)
  }
  // The row and column come from where the content is now: |y| / 2028 and |x| / 2028.
  const row = Math.abs(Math.trunc(c.y / STRIDE))
  const col = Math.abs(Math.trunc(c.x / STRIDE))
  // Defaults: x [-content width, 0], y [-content height, -1350].
  let minX = -map.w, maxX = 0, minY = -map.h, maxY = -1350
  // UpdateData: an x range starts one viewport width (+1) right of its min, a y range one pixel above its min.
  const ex = entry(setting.x, row)
  if (ex) { minX = VIEWPORT.w + 1 + ex.lo; maxX = ex.hi }
  const ey = entry(setting.y, col)
  if (ey) { minY = ey.lo + 1; maxY = ey.hi }
  // A neighbouring column with another height range is closed while the target is outside that range.
  const next = entry(setting.y, col + 1)
  if (ey && next && (next.lo !== ey.lo || next.hi !== ey.hi) && (t.y < next.lo + 1 || next.hi < t.y)) minX = col * -STRIDE + 1
  const prev = entry(setting.y, col - 1)
  if (ey && prev && (prev.lo !== ey.lo || prev.hi !== ey.hi) && (t.y < prev.lo + 1 || prev.hi < t.y)) maxX = ~(col * STRIDE)
  const x = t.x >= minX && t.x <= maxX ? t.x : t.x < minX ? minX : maxX
  const y = t.y >= minY && t.y <= maxY ? t.y : t.y < minY ? minY : maxY
  return camOf(x, y)
}

/** Visible map height in map pixels for a screen of w x h. [Canvas]RatioMainUI's CanvasScaler: reference 3000 x 1350,
 * match width, so the canvas is 3000 wide and 3000 h / w high; the map (stageMapPosZ in front of the canvas plane, the
 * perspective Main Camera) shows the canvas height plus 0.30925 per unit of posZ (read in the running game: 1920 x
 * 1009, chapter 0 posZ -2000: stages 0-1 and 0-3, 1489 map px apart, 1570 screen px apart, so 958 map px high). */
export function visibleHeight(posZ: number, w: number, h: number) {
  return (3000 * h) / w + 0.30925 * posZ
}

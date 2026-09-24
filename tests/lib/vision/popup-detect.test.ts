import { expect, it } from 'vitest'
import { detectGiftPopupLabel, popupCaptureAction, popupLabelColor, popupPriority, popupQuality, POPUP_SETTLE_MS,
  samePopupEpisode, type PopupObservation } from '../../../lib/vision/popup-detect'

function frame(width = 480, height = 270): ImageData {
  return { width, height, data: new Uint8ClampedArray(width * height * 4) } as ImageData
}
function rect(image: ImageData, x: number, y: number, width: number, height: number, rgb: [number, number, number]) {
  for (let row = y; row < y + height; row++) for (let column = x; column < x + width; column++) {
    const at = (row * image.width + column) * 4
    image.data.set([...rgb, 255], at)
  }
}

it('finds a popup name plate after translation while ignoring small card text', () => {
  const image = frame()
  rect(image, 220, 40, 21, 7, [30, 90, 190])
  rect(image, 122, 152, 64, 30, [30, 90, 190])
  expect(detectGiftPopupLabel(image)).toEqual({ x: 122, y: 152, width: 64, height: 30 })
  const shifted = frame()
  rect(shifted, 55, 90, 64, 30, [50, 190, 210])
  expect(detectGiftPopupLabel(shifted)).toEqual({ x: 55, y: 90, width: 64, height: 30 })
})

it('abstains when no saturated solid popup name plate is visible', () => {
  const image = frame()
  rect(image, 122, 152, 64, 30, [90, 90, 90])
  expect(detectGiftPopupLabel(image)).toBeNull()
})

it('keeps a fading, scaling popup together but separates another hue or position', () => {
  const first = frame()
  const next = frame()
  rect(first, 122, 152, 64, 30, [126, 1, 193])
  rect(next, 168, 146, 40, 20, [77, 0, 114])
  const firstBox = detectGiftPopupLabel(first)!
  const nextBox = detectGiftPopupLabel(next)!
  const original = { signature: '0'.repeat(64), color: popupLabelColor(first, firstBox), box: firstBox, at: 0 }
  const fading = { signature: '1'.repeat(26) + '0'.repeat(38), color: popupLabelColor(next, nextBox), box: nextBox, at: 33 }
  expect(samePopupEpisode(original, fading)).toBe(true)
  expect(popupQuality(fading)).toBeLessThan(popupQuality(original) * 0.5)
  expect(samePopupEpisode(original, { ...fading, color: [8, 70, 189] })).toBe(false)
  expect(samePopupEpisode(original, { ...fading, box: { ...nextBox, x: 300 } })).toBe(false)
})

it('starts a new popup after a visible gap unless the settled plate is unchanged', () => {
  const box = { x: 121, y: 152, width: 65, height: 30 }
  const shown = { signature: '0'.repeat(64), color: [8, 72, 200] as [number, number, number], box, at: 0 }
  expect(samePopupEpisode(shown, { ...shown, signature: '1'.repeat(20) + '0'.repeat(44), at: 150 })).toBe(false)
  expect(samePopupEpisode(shown, { ...shown, box: { ...box, width: 45, height: 21 }, at: 150 })).toBe(false)
  expect(samePopupEpisode(shown, { ...shown, signature: '1'.repeat(4) + '0'.repeat(60), at: 150 })).toBe(true)
})

it('upgrades one pending frame, allows a single comparable retry, and stops after that', () => {
  const base = { at: 200, attempts: 1, capturedQuality: 1000, capturedAt: 50 }
  expect(popupCaptureAction({ ...base, quality: 400, attempts: 0, queuedQuality: null })).toBe('enqueue')
  expect(popupCaptureAction({ ...base, quality: 1030, queuedQuality: 1000 })).toBe('replace')
  expect(popupCaptureAction({ ...base, quality: 1010, queuedQuality: 1000, capturedAt: 150 })).toBe('skip')
  expect(popupCaptureAction({ ...base, quality: 1010, queuedQuality: 1000 })).toBe('enqueue')
  expect(popupCaptureAction({ ...base, quality: 1010, queuedQuality: 1000, attempts: 2 })).toBe('skip')
  expect(popupCaptureAction({ ...base, quality: 980, queuedQuality: null })).toBe('enqueue')
  expect(popupCaptureAction({ ...base, quality: 700, queuedQuality: null })).toBe('skip')
  expect(popupCaptureAction({ ...base, quality: 1000, at: 100, queuedQuality: null })).toBe('skip')
  expect(popupCaptureAction({ ...base, quality: 2000, attempts: 2, queuedQuality: null })).toBe('skip')
})

it('ranks plate-shaped first attempts ahead of retries and other shapes', () => {
  const plate = { x: 0, y: 0, width: 65, height: 31 }
  const cursor = { x: 0, y: 0, width: 33, height: 13 }
  expect(popupPriority(plate, false)).toBeGreaterThan(popupPriority(plate, true))
  expect(popupPriority(plate, true)).toBeGreaterThan(popupPriority(cursor, false))
  expect(popupPriority(cursor, false)).toBeGreaterThan(popupPriority(cursor, true))
})

// Consecutive 60fps samples of six quick acquisition popups, downscaled to 480x270:
// "x,y,width,height,r,g,b,signature" per detected frame and "-" where no plate was detected.
const QUICK_POPUPS: [number, string][] = [
  [1458, '- - - 122,152,64,30,159,255,12,88be5fbdbe0c1000 121,152,65,30,156,255,12,0a3e5fbd36041000 121,152,65,30,156,255,12,0a3e5fbd36041000 132,150,60,29,147,253,12,03093a5e3f3e0c10 160,148,45,21,112,186,9,828abe7f3e1e0010 - - - -'],
  [1473, '- - - 168,146,40,20,77,0,114,44c0fee24414020c 140,150,55,26,114,0,168,82e0c504a5020a0c 127,151,62,29,126,0,193,80e2c78485020a0c 125,151,63,30,126,0,193,86e2c50485020a0c 123,151,64,31,126,0,193,01be854494130e08 122,151,65,31,130,0,198,81be8404b4120e0c 122,151,65,31,130,0,202,81bec404948a080c 121,151,65,31,130,0,202,80be0544a41a8e08 121,151,65,32,130,0,202,0080e2c594170e08 121,151,65,31,127,0,201,80be0544a41a8e08 121,151,65,32,130,0,202,0080e2c594170e08 121,151,65,32,130,0,202,0080e2c594170e08 121,151,65,31,130,0,202,80be0544a41a8e08 132,151,60,28,119,0,185,a1fec5048502080c 160,148,44,22,92,0,136,80c2eec580120a0c - - - -'],
  [1499, '- - - 140,150,54,26,8,63,172,83a0c78484800406 127,151,62,29,8,70,190,80f6c38684880604 125,152,63,29,8,70,190,ffe0c48488004606 124,152,63,29,6,72,195,bfc0c48488000500 123,152,63,30,6,72,195,ffe0c78480800402 122,152,64,30,7,74,198,ffc0c68480000606 121,152,65,30,8,72,200,ffe0c28688804606 121,152,65,30,8,72,200,ffe0c28688804606 121,152,65,30,8,72,200,ffe0c28688804606 121,152,65,30,8,72,200,ffe0c28688804606 121,152,65,30,8,72,200,ffe0c28688804606 121,152,65,30,8,72,200,ffe0c28688804606 121,152,65,30,8,72,200,ffe0c28688804606 133,151,58,27,10,67,178,ffa0c28088000606 161,148,43,21,11,52,127,c0ffe2c486880607 - - - -'],
  [1587, '- - - 123,152,63,30,5,73,197,40f0844c4c493705 122,152,64,30,7,74,198,40f4004c4d493f05 122,152,64,30,6,74,198,40d4004c4d493705 122,152,64,30,6,74,198,40d4004c4d493705 133,151,58,27,11,66,178,c0d400484b491303 160,148,44,21,9,53,135,0040e4444c4d2703 194,145,24,12,17,38,81,c0f0c4c4c4c93707 - - -'],
  [1603, '- - - 167,147,40,20,38,134,141,000e2e0e081c1c1c 139,150,56,26,39,178,190,002c0e0a9e0e1e1c 128,151,61,29,34,196,212,002e4f8a9a0c1c1c 125,151,63,30,38,202,218,06281e0e9a0e1e1e 124,151,63,30,38,203,222,002c5f0e9a0e1e1c 122,152,65,30,37,204,223,100e0e88061e1e1c 122,152,64,30,35,204,222,3e064e88861e1e1c 121,152,65,30,37,204,223,1a0e068c061e1e1c 121,152,65,30,37,204,223,1a0e068c061e1e1c 121,152,65,30,37,204,223,1a0e068c061e1e1c 121,152,65,30,37,204,223,1a0e068c061e1e1c 121,152,65,30,37,204,223,1a0e068c061e1e1c 121,152,65,30,37,204,223,1a0e068c061e1e1c 121,152,65,30,37,204,223,1a0e068c061e1e1c 121,152,65,30,37,204,223,1a0e068c061e1e1c 121,152,65,30,37,204,223,1a0e068c061e1e1c 133,151,58,28,35,188,207,002e4f0a9a0c1c1c 160,148,44,21,33,142,148,000a1e0e0c0e1c1c - - - -'],
  [1632, '- - - 167,147,41,20,160,138,42,00000e0c7cfe5858 126,151,64,30,231,196,51,0406060a7e7e1c58 125,151,64,31,236,201,53,00040e0a5cde9858 123,151,65,31,239,205,50,0006060a4efe1c58 122,151,65,32,243,208,51,000406085cde5c58 122,151,65,32,242,208,48,00040e085cde1a58 121,151,65,32,243,209,48,0004060c4cde5c5c 121,151,65,32,243,209,48,0004060c4cde5c5c 121,151,65,32,243,209,48,0004060c4cde5c5c 121,151,65,32,243,209,48,0004060c4cde5c5c 121,151,65,32,243,209,48,0004060c4cde5c5c 121,151,65,32,243,209,48,0004060c4cde5c5c 121,151,65,32,243,209,48,0004060c4cde5c5c 132,150,60,29,218,190,49,00040e0e5cde1c5c 159,148,46,21,166,147,45,8486843e7e3e4d58 - - -'],
]

function quickPopupFrames() {
  return QUICK_POPUPS.flatMap(([start, frames], popup) => frames.split(' ').map((item, offset) => {
    const at = (start + offset) * 1000 / 60
    if (item === '-') return { popup, at, observation: null }
    const [x, y, width, height, red, green, blue, hex] = item.split(',')
    const observation: PopupObservation = { box: { x: +x, y: +y, width: +width, height: +height },
      color: [+red, +green, +blue], signature: BigInt(`0x${hex}`).toString(2).padStart(64, '0'), at }
    return { popup, at, observation }
  }))
}

it.each([[1, 0], [2, 0], [2, 1], [3, 0], [3, 2]])('tracks six quick popups as six episodes with sample step %i and phase %i', (step, phase) => {
  const frames = quickPopupFrames().filter(({ at }) => Math.round(at * 60 / 1000 - phase) % step === 0)
  const episodes = new Map<number, Set<number>>()
  const best = new Map<number, number>()
  const peak = new Map<number, number>()
  let previous: PopupObservation | null = null
  let episode = 0
  let pending: { quality: number; firstAt: number; capturedAt: number; sent: boolean } | null = null
  for (const { popup, at, observation } of frames) {
    if (!observation) {
      if (pending) pending.sent = true
      if (previous && at - previous.at > 400) previous = null
      continue
    }
    const same = previous !== null && samePopupEpisode(previous, observation)
    if (!same) {
      episode++
      pending = null
    }
    previous = observation
    episodes.set(popup, (episodes.get(popup) ?? new Set()).add(episode))
    const quality = popupQuality(observation)
    peak.set(popup, Math.max(peak.get(popup) ?? 0, quality))
    if (pending?.sent) continue
    const action = popupCaptureAction({ quality, at, attempts: pending ? 1 : 0, capturedQuality: pending?.quality ?? 0,
      capturedAt: pending?.capturedAt ?? 0, queuedQuality: pending ? pending.quality : null })
    // A second enqueue is the retry frame; the first frame's selection is what this checks.
    if (action === 'enqueue' && !pending) pending = { quality, firstAt: at, capturedAt: at, sent: false }
    else if (action === 'replace' && pending) Object.assign(pending, { quality, capturedAt: at })
    if (pending) {
      best.set(popup, pending.quality)
      if (at >= pending.firstAt + POPUP_SETTLE_MS) pending.sent = true
    }
  }
  expect(episode).toBe(6)
  for (let popup = 0; popup < 6; popup++) {
    expect(episodes.get(popup)?.size).toBe(1)
    expect(best.get(popup)! / peak.get(popup)!).toBeGreaterThanOrEqual(0.95)
  }
})

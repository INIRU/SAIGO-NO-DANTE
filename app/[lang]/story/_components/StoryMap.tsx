'use client'

import { local } from '@/features/story/hooks/useTurnedTouchScroll'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { StoryNode, StorySubchapter } from '@/lib/story-map'
import { STRIDE, VIEWPORT, clampCamera, visibleHeight, type Cam } from './story-camera'
import StoryFx, { type FxView } from './StoryFx'

// Sizes in map pixels, measured on the game's chapter 0 map (stageIconSlotScale 0.5, 786 map px on screen).
const NODE = 137
const CARD_W = 354
const CARD_H = 168
const CARD_GAP = 100 // node centre → card edge
const ARROW_W = 47
const ARROW_H = 27
const ARROW_GAP = 70
const TRAIN_W = 104
const TRAIN_H = 179

// Zooming scales by _zoomCurve over 1 s; moving goes every
// frame by pos += (target - pos) * elapsed until elapsed reaches 1 s. _zoomCurve keys from the [UIPanel]StageMapUIPanel
// prefab (sharedassets2): [time, value, inSlope, outSlope].
const ZOOM_CURVE: [number, number, number, number][] = [[0, 0, 0, 0], [0.3319, 0.5802, 1.499, 1.499], [1, 1, 0, 0]]

/** Unity AnimationCurve.Evaluate for unweighted keys (cubic Hermite). */
function evalCurve(t: number) {
  if (t <= 0) return ZOOM_CURVE[0][1]
  for (let i = 0; i < ZOOM_CURVE.length - 1; i++) {
    const [t0, v0, , o0] = ZOOM_CURVE[i], [t1, v1, i1] = ZOOM_CURVE[i + 1]
    if (t > t1) continue
    const dt = t1 - t0, s = (t - t0) / dt, s2 = s * s, s3 = s2 * s
    return (2 * s3 - 3 * s2 + 1) * v0 + (s3 - 2 * s2 + s) * o0 * dt + (-2 * s3 + 3 * s2) * v1 + (s3 - s2) * i1 * dt
  }
  return ZOOM_CURVE[ZOOM_CURVE.length - 1][1]
}

/** Node icon and card tag by stage type. GUESS for DUNGEON / RPG / PROJECT_GS (the sword). */
// StageIconUISlot._textFrameColor by STAGEMAP_STAGENODE_TYPE (prefab StageIconUISlot_a1c5-5_Renewal): the colour the
// title band (StageNode_title) is tinted with. NORMAL 0, STORY 1, the rest 2-6.
const BAND_COLOR: Record<string, string> = { NORMAL: '#6d0000', STORY: '#9e6739' }
const BAND_OTHER = '#6b0000'

// The node by type: IntStringPairs_*StageNodeClearState, cleared (Green), Legacy atlas, [sprite w, h]. The node image
// ([Image]NodeIcon, 279.8 x 287.4 units = NODE map px) keeps the sprite's proportions (GUESS: preserveAspect), so the
// dungeon disc is flat.
const NODE_SPRITE: Record<string, [string, number, number]> = {
  DUNGEON: ['node-dungeon', 249, 117], RPG: ['node-rpg', 303, 316], PROJECT_GS: ['node-gs', 228, 234],
}
const NODE_UNITS = 279.8
// StageIconUISlot.UpdateNodeLayout: the type icon's size and position (PairVector2_NodeStageTypeIconSize / Position),
// the first pair for DUNGEON (a big dome standing on the disc, its own colours), the second for the rest (dark).
const ICON_LAYOUT = { dungeon: { w: 267.59, h: 275.65, y: 90 }, other: { w: 143.6, h: 147.92, y: 7 } }

/** Where a picked stage sits on screen once zoomed (from the left, from the bottom). Measured on the game's chapter 0
 * (zoom 1.4, pivot 0.35 / 0.55 / 0.4): x 0.25; y 0.37 with the card above, 0.67 with it below. GUESS: other subchapters
 * scale these by their own pivot values. */
function zoomAnchor(node: StoryNode, pivot: [number, number, number]) {
  return node.upper
    ? { x: 0.25 * pivot[0] / 0.35, y: 0.37 * pivot[2] / 0.4 }
    : { x: 0.25 * pivot[0] / 0.35, y: 0.67 * pivot[1] / 0.55 }
}

/** Focusing a stage: the content goes to (-x + ratio.x * viewport w, -y - ratio.y * viewport h), so the stage
 * stands at that point of the 3000 x 1350 viewport: _upperNodeViewportPositionRatio (0.35, 0.55) for a stage whose card
 * is above it, _lowerNodeViewportPositionRatio (0.35, 0.4) otherwise (the chapter setting's pivot carries the same
 * values). In camera-centre terms: x + (0.5 - 0.35) * 3000, y + (ratio y - 0.5) * 1350 (checked on chapter 0 in the
 * running game at 1920 x 1009). */
function focusCam(node: StoryNode, pivot: [number, number, number]): Cam {
  return { x: node.x + (0.5 - pivot[0]) * VIEWPORT.w, y: node.y + ((node.upper ? pivot[1] : pivot[2]) - 0.5) * VIEWPORT.h }
}

const LOADING = { ko: '지도를 불러오는 중', en: 'Loading the map', ja: 'マップを読み込み中' }

export default function StoryMap({ sub, base, lang, selected, zoomed, spoiler, onSelect, onDragStart }: {
  sub: StorySubchapter
  base: string
  lang: 'ko' | 'en' | 'ja'
  selected: number | null
  /** The picked stage's panel is open: the camera zooms to it as the game does */
  zoomed: boolean
  onSelect: (id: number) => void
  onDragStart: () => void
  /** The reader's progress is before this chapter: every stage shows the spoiler picture and ??? */
  spoiler: boolean
}) {
  const viewRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState<{ w: number; h: number } | null>(null)
  // mapSizeRow / mapSizeColoumn can be smaller than the map drawn (110: 1 x 2 while its tiles and 10-5 reach 2 x 4):
  // the map covers every tile and node, or the line and the far stages fall outside it.
  const rows = Math.max(sub.map.rows, ...sub.map.tiles.map(([r]) => r + 1), ...sub.nodes.map(n => Math.floor(n.y / STRIDE) + 1))
  const cols = Math.max(sub.map.cols, ...sub.map.tiles.map(([, c]) => c + 1), ...sub.nodes.map(n => Math.floor(n.x / STRIDE) + 1))
  const map = { w: cols * STRIDE + 20, h: rows * STRIDE + 20 }
  // VIEWER: a window taller than the game's shapes (a phone held upright) would show more than the map is high, with
  // black above and below; the view then shows the map's whole height instead
  const viewH = Math.min(size ? visibleHeight(sub.camera.posZ, size.w, size.h) : 1350, map.h)
  // UI pieces are on the map: they scale with the subchapter's stageIconSlotScale (sizes above are at 0.5).
  const ui = sub.camera.iconScale / 0.5
  // The camera shown lives in a ref and is written straight to the layers' transform each frame (a drag re-rendering
  // the whole map with React stuttered on phones); React re-renders only when the tiles in view change (tilesKey).
  const live = useRef<{ cam: Cam; zoom: number } | null>(null)
  const [, setTilesKey] = useState('')
  // StoryFx draws the tiles on the GPU once it runs (onGround): the <img> tiles below are only the fallback
  const [gpuGround, setGpuGround] = useState(false)
  // Map tiles loaded so far: until the first ones come in, the map would be black with empty cards (USER 2026-11-09)
  const [painted, setPainted] = useState(0)
  const tilesLayer = useRef<HTMLDivElement>(null)
  const nodesLayer = useRef<HTMLDivElement>(null)
  // VIEWER: two fingers zoom the map (the game has no pinch): a factor on every zoom, 0.6 .. 2.5
  const pinchZ = useRef(1)
  const unitAt = (z: number) => (size ? size.h / viewH * z * pinchZ.current : 0)
  const cam = live.current?.cam ?? null
  const unit = live.current ? unitAt(live.current.zoom) : 0

  // The camera, in two layers (USER 2026-11-08: the zoom in and out on a stage kept dragging the camera elsewhere):
  // - flat: the map camera at zoom 1, always inside the game's clamp; a drag or a scroll moves it (clamped from itself);
  // - stage: the camera on the picked stage at zoomInScale (StartFocus with zoom: placed on the stage, not clamped);
  // - k: how far in, 0 the map .. 1 the stage. What is shown is the two blended by k, the zoom 1 .. zoomInScale by k.
  // The zoom follows _zoomCurve over 1 s; a drag shifts both cameras, so the finger is followed at any k.
  const flat = useRef<Cam | null>(null)
  const stage = useRef<Cam | null>(null)
  const k = useRef(0)
  const anim = useRef<{ k0: number; k1: number; f0: Cam; f1: Cam | null; s0: Cam | null; s1: Cam | null; t0: number } | null>(null)
  const frame = useRef(0)
  useEffect(() => () => cancelAnimationFrame(frame.current), [])
  const lerp = (a: Cam, b: Cam, t: number): Cam => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t })
  const show = () => {
    const f = flat.current
    if (!f) return
    const s = stage.current ?? f, t = k.current
    live.current = { cam: lerp(f, s, t), zoom: 1 + (sub.camera.zoom - 1) * t }
    paint()
  }
  const transformOf = (c: Cam, u: number) => (size ? `translate(${size.w / 2 - c.x * u}px, ${size.h / 2 - (map.h - c.y) * u}px) scale(${u})` : '')
  // Touch devices (phones): half-size tiles unless zoomed in (map/<id>/h, 1024px: a 2048px tile is 16 MB decoded and
  // iPhone Safari ran out of memory), and half a tile of margin around the screen instead of one
  const touch = useRef(false)
  useEffect(() => { touch.current = window.matchMedia('(pointer: coarse)').matches }, [])
  /** The tiles mounted now: React draws these; paint changes them */
  const shown = useRef<{ key: string; list: [number, number][]; dir: string; nodes: Set<number> | null }>({ key: '', list: [], dir: '', nodes: null })
  /** While the camera flies (a group button, a stage picked far away): the tiles of where it starts and where it ends,
   * held for the flight (each tile met on the way decoded at once crashed iPhone Safari) */
  const flight = useRef<[number, number][] | null>(null)
  /** The map tiles on screen and a margin around (a big map's 2048px tiles all at once run a phone out of memory) */
  const tilesInView = (c: Cam, u: number): [number, number][] => {
    if (!size || !u) return []
    const m = touch.current ? STRIDE / 2 : STRIDE
    const hw = size.w / 2 / u + m, hh = size.h / 2 / u + m
    return sub.map.tiles.filter(([r, col]) => {
      const y0 = map.h - ((rows - 1 - r) * STRIDE + sub.map.tile) // the tile's bottom, from the map's bottom
      return col * STRIDE + sub.map.tile > c.x - hw && col * STRIDE < c.x + hw && y0 + sub.map.tile > c.y - hh && y0 < c.y + hh
    })
  }
  const paint = () => {
    const v = live.current
    if (!v || !size) return
    const u = unitAt(v.zoom), tr = transformOf(v.cam, u)
    if (tilesLayer.current) tilesLayer.current.style.transform = tr
    if (nodesLayer.current) nodesLayer.current.style.transform = tr
    fxView.current = { size, cam: v.cam, unit: u, mapH: map.h, sync: fxView.current?.sync }
    fxView.current.sync?.()
    // phones: the tile picture by its size on screen, at an assumed 1.5 device pixels per CSS pixel (sharp enough, a
    // ninth of the full tiles' memory zoomed out): a quarter (512) or a half (1024) until pinched in
    const sz = u * 1.5
    const dir = !touch.current ? '' : sz < 0.3 ? 'q/' : sz < 0.6 ? 'h/' : ''
    const list = flight.current ?? tilesInView(v.cam, u)
    // the stage cards near the screen too (a map's every card picture decoded at once added up on phones); a flight
    // keeps them all
    const hw = size.w / u, hh = size.h / u
    const nodes = flight.current ? null : new Set(sub.nodes.filter(n => Math.abs(n.x - v.cam.x) < hw && Math.abs(n.y - v.cam.y) < hh).map(n => n.id))
    const key = dir + list.map(([r, col]) => `${r}_${col}`).join(',') + '|' + (nodes ? [...nodes].join(',') : 'all')
    if (key !== shown.current.key) {
      shown.current = { key, list, dir, nodes }
      setTilesKey(key)
    }
  }
  useEffect(() => { paint() }, [size?.w, size?.h]) // eslint-disable-line react-hooks/exhaustive-deps
  // ?debug in the address: a small box with the map tiles held now (no typing needed on a phone). The line is kept in
  // localStorage each second, and the box first shows the one the last visit left (what it held before a crash)
  useEffect(() => {
    if (!new URLSearchParams(location.search).has('debug')) return
    const box = document.createElement('div')
    box.style.cssText = 'position:fixed;left:4px;bottom:4px;z-index:200;max-width:60%;padding:4px 6px;background:#000c;color:#e8b030;font:11px/1.35 monospace;white-space:pre-wrap;pointer-events:none'
    let last = ''
    try { last = localStorage.getItem('story-map-debug') ?? '' } catch { /* private mode */ }
    document.body.appendChild(box)
    const timer = window.setInterval(() => {
      const fx = document.documentElement.dataset.fxRenderer || 'none'
      const now = `${sub.id} fx:${fx} tiles ${shown.current.list.length} ${shown.current.dir || 'full'} imgs ${document.querySelectorAll('img').length} ${new Date().toLocaleTimeString()}`
      try { localStorage.setItem('story-map-debug', now) } catch { /* private mode */ }
      box.textContent = (last ? `last: ${last}\n` : '') + `now: ${now}`
    }, 1000)
    return () => { window.clearInterval(timer); box.remove() }
  }, [sub.id])

  useLayoutEffect(() => {
    const el = viewRef.current
    if (!el) return
    const measure = () => setSize({ w: el.clientWidth, h: el.clientHeight })
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  /** The game's clamp at zoom 1, from a camera inside it. */
  const clamp = (to: Cam, from: Cam | null) => (size ? clampCamera(to, from ?? to, map, sub.camera) : to)
  /** The camera on a picked stage at zoomInScale, the stage at its anchor on screen. */
  const stageCam = (node: StoryNode): Cam | null => {
    const z = sub.camera.zoom, a = zoomAnchor(node, sub.camera.pivot), u = unitAt(z)
    return size && u ? { x: node.x - (a.x - 0.5) * size.w / u, y: node.y - (a.y - 0.5) * size.h / u } : null
  }

  /** Animate k to k1 (and the map camera / the stage camera to new places, when given) over 1 s along _zoomCurve. */
  const animate = (k1: number, f1: Cam | null, s1: Cam | null) => {
    cancelAnimationFrame(frame.current)
    if (!flat.current) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      k.current = k1
      if (f1) flat.current = f1
      if (s1) stage.current = s1
      anim.current = null
      show()
      return
    }
    // from the map (k 0) the stage camera starts where it ends: only the zoom and the map camera move
    if (s1 && (k.current < 1e-3 || !stage.current)) stage.current = s1
    anim.current = { k0: k.current, k1, f0: flat.current, f1, s0: stage.current, s1, t0: performance.now() }
    {
      const ef = f1 ?? flat.current, es = s1 ?? stage.current ?? ef, ez = 1 + (sub.camera.zoom - 1) * k1
      const from = live.current ? tilesInView(live.current.cam, unitAt(live.current.zoom)) : []
      const to = tilesInView(lerp(ef, es, k1), unitAt(ez))
      flight.current = [...new Map([...from, ...to].map(t => [`${t[0]}_${t[1]}`, t] as const)).values()]
    }
    const step = (now: number) => {
      const a = anim.current
      if (!a) return
      const t = Math.min((now - a.t0) / 1000, 1), e = evalCurve(t)
      k.current = t >= 1 ? a.k1 : a.k0 + (a.k1 - a.k0) * e
      // the map camera moves through the clamp from where it is (a long move crosses the map's columns one by one)
      if (a.f1 && flat.current) flat.current = t >= 1 ? a.f1 : clamp(lerp(a.f0, a.f1, e), flat.current)
      if (a.s1 && a.s0) stage.current = t >= 1 ? a.s1 : lerp(a.s0, a.s1, e)
      show()
      if (t < 1) frame.current = requestAnimationFrame(step)
      else { anim.current = null; flight.current = null; paint() }
    }
    frame.current = requestAnimationFrame(step)
  }

  // A picked stage: the map camera goes to it (StartFocus: _upper / _lowerNodeViewportPositionRatio), and with its panel
  // open the view zooms in on it; the panel closed, the view zooms back out to the map camera where it is.
  useEffect(() => {
    if (!size) return
    const node = sub.nodes.find(n => n.id === selected)
    if (!node) return
    // clamped from the target itself: the map camera's place for this stage does not depend on the way there
    const home = clamp(focusCam(node, sub.camera.pivot), null)
    if (!flat.current) {
      flat.current = home
      k.current = 0
      show()
      return
    }
    if (zoomed) animate(1, home, stageCam(node))
    // closing the panel keeps the map camera where it is (the stage, or where a drag took it); a stage picked from a
    // group button at the map's zoom moves the map camera to it
    else animate(0, k.current > 1e-3 ? null : home, null)
  }, [selected, zoomed, size?.w, size?.h]) // eslint-disable-line react-hooks/exhaustive-deps

  /** Move the view by a map distance: both cameras shift by it (the map camera inside the clamp). */
  const pan = (dx: number, dy: number) => {
    const f = flat.current
    if (!f) return
    const to = clamp({ x: f.x + dx, y: f.y + dy }, f)
    // what the clamp held back of the move is held back for the stage camera too, so the two stay in step
    const mx = to.x - f.x, my = to.y - f.y
    flat.current = to
    if (stage.current) stage.current = { x: stage.current.x + mx, y: stage.current.y + my }
    // a running zoom keeps going; only its camera moves stop (the finger owns the cameras now)
    if (anim.current) { anim.current.f1 = null; anim.current.s1 = null }
    show()
  }

  const drag = useRef<{ x: number; y: number; moved: boolean } | null>(null)
  const fingers = useRef(new Map<number, [number, number]>())
  const pinch = useRef<{ d0: number; z0: number } | null>(null)
  const spread = () => { const [a, b] = [...fingers.current.values()]; return Math.hypot(a[0] - b[0], a[1] - b[1]) }
  const onPointerDown = (e: React.PointerEvent) => {
    if (!cam) return
    const [x, y] = local(e.clientX, e.clientY)
    // a new touch's first finger: fingers of an earlier one that lifted off the map (over a card, the panel) and were
    // never seen leaving are dropped, or the next single finger was taken for the second of a pinch
    if (e.isPrimary) { fingers.current.clear(); pinch.current = null }
    fingers.current.set(e.pointerId, [x, y])
    if (fingers.current.size === 2) {
      // a second finger: a pinch, no pan; a stage's panel closes as on a drag
      pinch.current = { d0: spread() || 1, z0: pinchZ.current }
      if (drag.current) drag.current.moved = true
      if (zoomed) onDragStart()
      return
    }
    drag.current = { x, y, moved: false }
  }
  const onPointerMove = (e: React.PointerEvent) => {
    const [x, y] = local(e.clientX, e.clientY)
    if (fingers.current.has(e.pointerId)) fingers.current.set(e.pointerId, [x, y])
    const p = pinch.current
    if (p && fingers.current.size === 2) {
      pinchZ.current = Math.min(2.5, Math.max(0.6, p.z0 * spread() / p.d0))
      show()
      return
    }
    const d = drag.current
    const unit = live.current ? unitAt(live.current.zoom) : 0
    if (!d || !unit) return
    const dx = x - d.x, dy = y - d.y
    if (!d.moved && Math.hypot(dx, dy) < 4) return
    if (!d.moved) {
      d.moved = true
      viewRef.current?.setPointerCapture(e.pointerId)
      onDragStart()
    }
    d.x = x
    d.y = y
    // screen px to map px at the zoom shown now (screen y is down, map y up)
    pan(-dx / unit, dy / unit)
  }
  const endDrag = (e: React.PointerEvent) => {
    fingers.current.delete(e.pointerId)
    if (pinch.current) {
      // the finger left on the screen goes on panning from where it is, without a jump
      if (fingers.current.size === 1) { const [x, y] = [...fingers.current.values()][0]; drag.current = { x, y, moved: true }; return }
      pinch.current = null
    }
    if (drag.current?.moved) viewRef.current?.releasePointerCapture(e.pointerId)
    // A click that did not drag reaches the node / card buttons.
    setTimeout(() => { drag.current = null }, 0)
  }
  const onWheel = (e: WheelEvent) => {
    if (!cam || !unit || !size) return
    // not passive (below): a ctrl + wheel would also zoom the whole page
    e.preventDefault()
    // a scroll closes a stage's panel like a drag
    if (zoomed) onDragStart()
    // a sideways scroll (or shift + wheel) moves the map
    if (!e.ctrlKey && (e.deltaX || e.shiftKey)) { pan((e.deltaX || e.deltaY) / unit, 0); return }
    // VIEWER (USER 2026-11-09: PC could not zoom): the wheel (and a touchpad pinch, ctrl + wheel) zooms as two fingers do,
    // keeping the map point under the cursor in place
    const dy = e.deltaY * (e.deltaMode === 1 ? 40 : e.deltaMode === 2 ? size.h : 1)
    const z = Math.min(2.5, Math.max(0.6, pinchZ.current * Math.exp(-dy * (e.ctrlKey ? 0.01 : 0.0015))))
    if (z === pinchZ.current) return
    const [x, y] = local(e.clientX, e.clientY)
    const u1 = unit / pinchZ.current * z, gain = 1 / unit - 1 / u1
    pinchZ.current = z
    pan((x - size.w / 2) * gain, -(y - size.h / 2) * gain)
  }
  const wheel = useRef(onWheel)
  wheel.current = onWheel
  useEffect(() => {
    const el = viewRef.current, h = (e: WheelEvent) => wheel.current(e)
    el?.addEventListener('wheel', h, { passive: false })
    return () => el?.removeEventListener('wheel', h)
  }, [])
  const pick = (id: number) => { if (!drag.current?.moved) onSelect(id) }

  const ny = (n: StoryNode) => map.h - n.y
  const order = [...sub.nodes].sort((a, b) => a.id - b.id)
  const current = order.find(n => n.id === selected)
  // Stages after the furthest one picked here are not reached yet: the game's spoiler picture and ??? (USER 2026-11-09:
  // it was lost when the chapter-level spoiler came in). Picking a hidden stage reveals it and every stage before it.
  const at = order.findIndex(n => n.id === selected)
  const [reach, setReach] = useState(at)
  if (at > reach) setReach(at)
  const layer = cam && size ? transformOf(cam, unit) : undefined
  const line = order.map(n => `${n.x},${ny(n)}`).join(' ')
  // StoryFx draws in its own WebGL canvas every frame: it reads the camera from here (paint keeps it current)
  const fxView = useRef<FxView | null>(null)
  if (cam && size) fxView.current = { size, cam, unit, mapH: map.h, sync: fxView.current?.sync }

  return (
    <div
      ref={viewRef}
      className="relative h-full w-full cursor-grab touch-none select-none overflow-hidden bg-black active:cursor-grabbing"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
    >
      {/* While the first tiles load: the chapter's picture, blurred and dark, and the loading mark */}
      {painted < Math.min(2, sub.map.tiles.length) && (
        <div role="status" className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-4">
          {sub.coverImg && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={`${base}/cover/${sub.id}.webp`} alt="" aria-hidden className="absolute inset-0 h-full w-full object-cover blur-xl brightness-[.35]" />
          )}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`${base}/ui/train.webp`} alt="" aria-hidden className="relative h-16 w-auto motion-safe:animate-pulse" />
          <p className="relative font-[family-name:var(--font-heading)] text-[1rem] text-[#d8ccb6] [text-shadow:0_1px_6px_#000]">{LOADING[lang]}</p>
        </div>
      )}
      {layer && (
        <div ref={tilesLayer} className="absolute left-0 top-0 origin-top-left" style={{ width: map.w, height: map.h, transform: layer }}>
          {/* Beyond the tiles stays black, as in the game where the camera may look past the map's edge. */}
          {!gpuGround && shown.current.list.map(([r, c]) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={`${r}_${c}`} src={`${base}/map/${sub.map.id ?? sub.id}/${shown.current.dir}${r}_${c}.webp`} alt="" draggable={false} decoding="async" onLoad={() => setPainted(n => n + 1)}
              // <id>_<row>_<col>: row 0 is the bottom of the map, like the node positions
              className="absolute max-w-none" style={{ left: c * STRIDE, top: (rows - 1 - r) * STRIDE, width: sub.map.tile, height: sub.map.tile }} />
          ))}
        </div>
      )}
      {/* The chapter's map effect between the tiles and the stages, as the game spawns it under the map content */}
      {layer && <StoryFx effectId={sub.map.id ?? sub.id} base={base} rows={rows} cols={cols} tiles={sub.map.tiles} mapId={sub.map.id ?? sub.id} view={fxView} at={sub.effectAt} onGround={setGpuGround} />}
      {layer && (
        <div ref={nodesLayer} className="absolute left-0 top-0 origin-top-left" style={{ width: map.w, height: map.h, transform: layer }}>
          <svg className="pointer-events-none absolute left-0 top-0" width={map.w} height={map.h} aria-hidden>
            <defs>
              <filter id="story-line-glow" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation={6 * ui} /></filter>
            </defs>
            <polyline points={line} fill="none" stroke="#ff8a00" strokeOpacity={0.9} strokeWidth={22 * ui} filter="url(#story-line-glow)" strokeLinejoin="round" className="story-line-glow" />
            <polyline points={line} fill="none" stroke="#ffd23a" strokeWidth={7 * ui} strokeLinejoin="round" />
          </svg>
          {order.filter(n => !shown.current.nodes || shown.current.nodes.has(n.id) || n.id === selected).map(n => <StageNode key={n.id} node={n} y={ny(n)} ui={ui} base={base} lang={lang} selected={n.id === selected}
            hidden={spoiler || order.indexOf(n) > reach} onPick={pick} />)}
          {current && (
            // One bus for the whole map: it rides to the picked stage.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={`${base}/ui/train.webp`} alt="" draggable={false} className="story-bus pointer-events-none absolute max-w-none"
              style={{ left: 0, top: 0, transform: `translate(${current.x - TRAIN_W * ui / 2}px, ${ny(current) + 28 * ui - TRAIN_H * ui}px)`, width: TRAIN_W * ui, height: TRAIN_H * ui }} />
          )}
        </div>
      )}
    </div>
  )
}

function StageNode({ node, y, ui, base, lang, selected, hidden, onPick }: {
  node: StoryNode; y: number; ui: number; base: string; lang: 'ko' | 'en' | 'ja'; selected: boolean; hidden: boolean; onPick: (id: number) => void
}) {
  const [nodeImg, sw, sh] = NODE_SPRITE[node.type] ?? ['node', 223, 228]
  const k = NODE * ui / NODE_UNITS  // map px per prefab unit
  const fit = Math.min(279.8 / sw, 287.4 / sh)
  const nodeW = sw * fit * k, nodeH = sh * fit * k
  const dungeon = node.type === 'DUNGEON'
  const il = dungeon ? ICON_LAYOUT.dungeon : ICON_LAYOUT.other
  const iconBox = { left: nodeW / 2 - il.w * k / 2, top: nodeH / 2 - il.y * k - il.h * k / 2, width: il.w * k, height: il.h * k }
  const iconMask = `url(${base}/ui/s/${node.icon}.webp)`
  const cw = CARD_W * ui, ch = CARD_H * ui
  const cardTop = node.upper ? y - CARD_GAP * ui - ch : y + CARD_GAP * ui
  const arrowTop = node.upper ? y - ARROW_GAP * ui - ARROW_H * ui : y + ARROW_GAP * ui
  const title = hidden ? '???' : node.title?.[lang] ?? node.title?.ko ?? ''
  const glow = selected ? `drop-shadow(0 0 ${7 * ui}px #ff9a00) drop-shadow(0 0 ${2 * ui}px #ffb000)` : undefined
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`${base}/ui/arrow.webp`} alt="" draggable={false} className="pointer-events-none absolute max-w-none"
        style={{ left: node.x - ARROW_W * ui / 2, top: arrowTop, width: ARROW_W * ui, height: ARROW_H * ui, transform: node.upper ? undefined : 'scaleY(-1)' }} />
      <button type="button" onClick={() => onPick(node.id)} aria-label={`${node.label} ${title}`} aria-pressed={selected}
        className="absolute block transition-[filter] duration-300" style={{ left: node.x - nodeW / 2, top: y - nodeH / 2, width: nodeW, height: nodeH, filter: glow }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`${base}/ui/${nodeImg}.webp`} alt="" draggable={false} className="absolute inset-0 h-full w-full max-w-none" />
        {/* The icon of the node's type from the subchapter's StageNodeTypeSpritePairs: on a dungeon in its own colours,
            else tinted with the cleared colour of PairColor_NodeClearState (near black) over the green. */}
        {dungeon ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={`${base}/ui/s/${node.icon}.webp`} alt="" draggable={false} className="absolute max-w-none object-contain" style={iconBox} />
        ) : (
          <span className="absolute bg-[#0b2a06]/90"
            style={{ ...iconBox, maskImage: iconMask, WebkitMaskImage: iconMask, maskSize: 'contain', WebkitMaskSize: 'contain', maskRepeat: 'no-repeat', WebkitMaskRepeat: 'no-repeat', maskPosition: 'center', WebkitMaskPosition: 'center' }} />
        )}
      </button>
      <button type="button" onClick={() => onPick(node.id)} tabIndex={-1}
        className="absolute block text-left transition-[filter] duration-300" style={{ left: node.x - cw / 2, top: cardTop, width: cw, height: ch, filter: glow }}>
        {/* [Mask]: the picture and the title band are clipped to the card's window. */}
        <span className="absolute overflow-hidden bg-[var(--bg-card)]" style={{ left: 13 * ui, top: 13 * ui, right: 13 * ui, bottom: 11 * ui }}>
          {(hidden || node.cg) && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={hidden ? `${base}/ui/spoiler.webp` : `${base}/cg/${node.id}.webp`} alt="" draggable={false} loading="lazy" className="h-full w-full max-w-none object-cover" />
          )}
          {/* TextBgFrame: StageNode_title tinted by the node type, 100 px wider than the window it sits in, so the
              window cuts off its faded ends and the band is solid under the title. */}
          <span aria-hidden className="absolute -left-[8%] w-[116%]"
            style={{ top: 106 * ui, height: 28 * ui, backgroundColor: BAND_COLOR[node.type] ?? BAND_OTHER, maskImage: `url(${base}/ui/title-band.webp)`, WebkitMaskImage: `url(${base}/ui/title-band.webp)`, maskMode: 'luminance', maskSize: '100% 100%', WebkitMaskSize: '100% 100%' }} />
        </span>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`${base}/ui/frame.webp`} alt="" draggable={false} className="pointer-events-none absolute inset-0 h-full w-full max-w-none" />
        <span className="absolute flex items-center whitespace-nowrap text-[#f3e4cb]"
          style={{ left: 16 * ui, width: 323 * ui, top: 119 * ui, height: 28 * ui, paddingLeft: 10 * ui, paddingRight: 10 * ui, gap: 8 * ui }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`${base}/ui/s/${node.tag}.webp`} alt="" draggable={false} className="max-w-none object-contain" style={{ width: 33 * ui, height: 24 * ui }} />
          <span className="font-[family-name:var(--font-title)] leading-none" style={{ fontSize: 26 * ui }}>{node.label}</span>
          {/* [Mask]StageTitle: right-aligned in its own window (line-height above 1 keeps the letter tops) */}
          <span className="ml-auto min-w-0 overflow-hidden text-right font-[family-name:var(--font-heading)] leading-[1.5]" style={{ fontSize: 21 * ui }}>{title}</span>
        </span>
      </button>
    </>
  )
}

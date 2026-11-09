'use client'

import { useEffect, useRef } from 'react'

/** Where the map is on screen: the same numbers StoryMap uses for its layer transform. */
export interface FxView { size: { w: number; h: number }; cam: { x: number; y: number }; unit: number; mapH: number
  /** Set by StoryFx: places and draws the canvas now. StoryMap calls it when it moves its own layers, so the GPU
   * picture and the stage cards move in the same frame (the canvas waited for its own 30 fps tick and trailed). */
  sync?: () => void }

// The stage map drawn on the GPU (PixiJS, WebGPU where the browser has it, else WebGL): the map tiles, and over them the
// chapter's effect (MainUI.StageMapBackgroundManager: the prefab StageMapEffect_<subchapter>_<stage>,
// pipeline/story_map_fx.py) played by the game's particle runtime (lib/story-fx). The prefab's positions are map pixels
// from the map centre (DATA: the 4-54 portal at node 10454 minus the centre, off by 1 px in x and 12 in y). GUESS: the
// viewer shows a map whose stages are all cleared, so the highest stage's prefab.
// The tiles were <img>s that iPhone Safari decoded and kept as it liked, and it ran out of memory while the map moved
// (USER 2026-11-09): here each tile is a texture loaded one at a time and unloaded as soon as it leaves the screen.
const STRIDE = 2028, TILE = 2048

export default function StoryFx({ effectId, base, rows, cols, tiles, mapId, view, at, onGround }: {
  effectId: number; base: string; rows: number; cols: number; tiles: [number, number][]; mapId: number
  view: React.RefObject<FxView | null>
  /** StageMapBackgroundManager.CreateMapEffect: the effect's anchor in map pixels from the bottom left when the chapter
   * sets one (main-stage-map-setting effectPosition), else the map's centre */
  at?: [number, number]
  /** The canvas draws the tiles from now on (true), or could not start (false): StoryMap drops or keeps its <img>s */
  onGround?: (on: boolean) => void
}) {
  const host = useRef<HTMLDivElement>(null)
  const ground = useRef(onGround)
  // the map's view carries a way to draw now (FxView.sync); it calls through to the canvas once it runs
  const syncRef = useRef<() => void>(() => {})
  if (view.current) view.current.sync = syncRef.current
  ground.current = onGround

  useEffect(() => {
    let stop = false
    let cleanup = () => {}
    let syncNow: (() => void) | null = null
    syncRef.current = () => syncNow?.()
    ;(async () => {
      const PIXI = await import('pixi.js')
      // the site's CSP has no 'unsafe-eval': PixiJS then needs its eval-free shader and uniform code paths
      // @ts-expect-error -- the package's exports map gives this entry no types
      await import('pixi.js/unsafe-eval')
      if (stop || !host.current) return
      const index = await fetch(`${base}/fx/index.json`).then(r => (r.ok ? r.json() : null), () => null)
      const stages: number[] | undefined = index?.[String(effectId)]
      const { FxLayer } = await import('@/lib/story-fx/layer')
      // phones draw the map without its effect (USER 2026-11-09: they ran out of memory); ?fx in the address shows it
      const phone = window.matchMedia('(pointer: coarse)').matches && !new URLSearchParams(location.search).has('fx')
      const layer = stages?.length && !phone ? await FxLayer.load(`${base}/fx/${effectId}_${Math.max(...stages)}/`, 1) : null
      // no effect, no canvas: the map is the <img> tiles alone (the browser composites them in step with the cards; a
      // GPU canvas came a frame late on iPhone and stuttered, USER 2026-11-09)
      if (!layer) return
      if (stop || !host.current) return
      const app = new PIXI.Application()
      // touch devices: one pixel per CSS pixel, no MSAA (a full-screen layer at 3x density stutters on phones)
      const touch = window.matchMedia('(pointer: coarse)').matches
      try {
        // ?webgl in the address forces WebGL (to compare the two on a device). WebGPU where the browser has it (iOS 26
        // Safari, Chrome; USER 2026-11-09), else WebGL: the layer's shaders then take their WGSL twins (lib/story-fx/wgsl.ts)
        await app.init({ backgroundAlpha: 0, resizeTo: host.current, antialias: !touch, preference: new URLSearchParams(location.search).has('webgl') ? 'webgl' : 'webgpu', autoDensity: true, resolution: touch ? 1 : Math.min(window.devicePixelRatio || 1, 2) })
      } catch {
        ground.current?.(false)
        return
      }
      const renderer = (app.renderer as { name?: string }).name ?? ''
      if (layer) layer.gpu = renderer === 'webgpu'
      // which one it got, for checks on a device (html[data-fx-renderer])
      document.documentElement.dataset.fxRenderer = renderer
      if (stop || !host.current) { app.destroy(true); return }
      // touch devices: 30 fps (PixiJS Ticker maxFPS) leaves the phone time for the drag
      if (touch) app.ticker.maxFPS = 30
      host.current.appendChild(app.canvas)
      app.canvas.style.position = 'absolute'
      app.canvas.style.inset = '0'

      const world = new PIXI.Container()
      const tilesLayer = new PIXI.Container()
      const root = new PIXI.Container()
      const ax = at ? at[0] : (cols * STRIDE) / 2, ay = at ? at[1] : (rows * STRIDE) / 2
      root.position.set(ax, view.current ? view.current.mapH - ay : 0)
      if (layer) root.addChild(layer.back, layer.front)
      // the tiles here are only for the Vortex's picture of the map (scene below), never drawn on screen
      tilesLayer.visible = false
      world.addChild(tilesLayer, root)
      app.stage.addChild(world)

      // The tiles on screen and a margin (half a tile on phones). Phones take the half-size ones (map/<id>/h) unless
      // zoomed in. One load at a time: a tile no longer wanted when its turn comes is skipped (a camera flight across
      // the map asked for each tile on the way); a tile off screen is unloaded at once (its GPU memory freed).
      const loaded = new Map<string, InstanceType<typeof PIXI.Sprite>>() // url -> sprite
      let wanted = new Map<string, [number, number]>() // url -> tile
      let busy = false, covered = document.documentElement.hasAttribute('data-story-cover')
      const pump = async () => {
        if (busy) return
        busy = true
        while (!stop) {
          const next = [...wanted.keys()].find(u => !loaded.has(u))
          if (!next) break
          // mipmaps: a tile drawn smaller than its picture shimmered on the GPU (an <img> is filtered by the browser)
          const tex = await PIXI.Assets.load<InstanceType<typeof PIXI.Texture>>({ src: next, data: { autoGenerateMipmaps: true } }).catch(() => null)
          if (stop) break
          if (!tex) { wanted.delete(next); continue }
          const rc = wanted.get(next)
          if (!rc) { void PIXI.Assets.unload(next); continue }
          const sp = new PIXI.Sprite(tex)
          sp.position.set(rc[1] * STRIDE, (rows - 1 - rc[0]) * STRIDE)
          sp.width = TILE
          sp.height = TILE
          tilesLayer.addChild(sp)
          loaded.set(next, sp)
        }
        busy = false
      }
      const want = (v: FxView) => {
        const next = new Map<string, [number, number]>()
        if (!covered) {
          // the tile picture nearest its size on screen (canvas pixels per map pixel; phones draw at resolution 1):
          // a quarter (512) or a half (1024) on phones, as the GPU draws them without mipmaps
          const s = v.unit * app.renderer.resolution
          const dir = !touch ? '' : s < 0.3 ? 'q/' : s < 0.6 ? 'h/' : ''
          const m = touch ? STRIDE / 2 : STRIDE
          const hw = v.size.w / 2 / v.unit + m, hh = v.size.h / 2 / v.unit + m
          for (const [r, c] of tiles) {
            const y0 = v.mapH - ((rows - 1 - r) * STRIDE + TILE) // the tile's bottom, from the map's bottom
            if (c * STRIDE + TILE > v.cam.x - hw && c * STRIDE < v.cam.x + hw && y0 + TILE > v.cam.y - hh && y0 < v.cam.y + hh)
              next.set(`${base}/map/${mapId}/${dir}${r}_${c}.webp`, [r, c])
          }
        }
        wanted = next
        for (const [u, sp] of loaded) if (!next.has(u)) { sp.destroy(); loaded.delete(u); void PIXI.Assets.unload(u) }
        void pump()
      }

      // FX_Grp_Vortex bends the picture behind it: the tiles drawn into a screen-sized texture first
      const needsScene = !!layer && Object.values<any>(layer.fx.materials).some(m => m?.shader?.endsWith('FX_Grp_Vortex'))
      let scene: InstanceType<typeof PIXI.RenderTexture> | null = null
      if (layer && needsScene) {
        scene = PIXI.RenderTexture.create({ width: app.screen.width, height: app.screen.height })
        layer.scene = scene
      }
      if (layer) layer.solo(layer.fx.effects[0].name, 1e9)
      const units = () => ({ self: { x: 0, y: 0, dir: 1 }, target: { x: 0, y: 0, dir: 1 } })
      const start = performance.now()
      let lastKey = ''
      const place = (v: FxView) => {
        world.position.set(v.size.w / 2 - v.cam.x * v.unit, v.size.h / 2 - (v.mapH - v.cam.y) * v.unit)
        world.scale.set(v.unit)
        root.position.y = v.mapH - ay
        // the wanted tiles change only when the view does
        const key = `${Math.round(v.cam.x)},${Math.round(v.cam.y)},${v.unit.toFixed(4)},${v.size.w},${v.size.h}`
        if (key !== lastKey && scene) { lastKey = key; want(v) }
      }
      // for checks on a device: window.__storyMapState() lists the tiles wanted / on the GPU
      ;(window as unknown as { __storyMapState?: () => unknown }).__storyMapState = () => ({ wanted: [...wanted.keys()].map(u => u.split('/map/')[1]), loaded: [...loaded.keys()].map(u => u.split('/map/')[1]), busy, covered, lastKey })
      syncNow = () => { const v = view.current; if (v && !covered) { place(v); app.renderer.render(app.stage) } }
      const tick = () => {
        const v = view.current
        if (!v) return
        place(v)
        if (!layer) return
        if (scene) {
          if (scene.width !== app.screen.width || scene.height !== app.screen.height) scene.resize(app.screen.width, app.screen.height)
          // gl_FragCoord is in device pixels
          layer.view = [app.renderer.width, app.renderer.height]
          root.visible = false
          tilesLayer.visible = true
          app.renderer.render({ container: world, target: scene, clear: true })
          tilesLayer.visible = false
          root.visible = true
        }
        const T = (performance.now() - start) / 1000
        layer.update(T, units)
        layer.setTime(T)
      }
      app.ticker.add(tick)
      // the first tiles now, not at the ticker's first frame
      syncNow()
      // A full-screen view over the map (the dungeon interior) pauses the map and frees its tiles: nothing of it shows
      const cover = (e: Event) => {
        covered = !!(e as CustomEvent<boolean>).detail
        lastKey = ''
        if (covered) { if (view.current) want(view.current); app.ticker.stop() } else app.ticker.start()
      }
      window.addEventListener('story-cover', cover)
      if (covered) app.ticker.stop()
      cleanup = () => {
        syncNow = null
        window.removeEventListener('story-cover', cover)
        app.ticker.remove(tick)
        for (const [u, sp] of loaded) { sp.destroy(); void PIXI.Assets.unload(u) }
        loaded.clear()
        layer?.clear()
        scene?.destroy(true)
        app.destroy(true, { children: true })
        ground.current?.(false)
      }
    })()
    return () => { stop = true; cleanup() }
  }, [effectId, base, rows, cols, mapId]) // eslint-disable-line react-hooks/exhaustive-deps

  return <div ref={host} aria-hidden className="pointer-events-none absolute inset-0" />
}

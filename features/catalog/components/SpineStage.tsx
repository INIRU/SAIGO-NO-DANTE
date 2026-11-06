'use client'

// Plays one form of an identity (an SD figure or a full illustration) from the Spine packs in Storage.
// The drawing rules come from the extractor's preview (limbus-asset-extractor, scripts/spine); each one fixes a defect
// that was found by eye there, so keep them when editing.
// The skeletons are Spine 4.0.64: the runtime must stay on 4.0 (4.1 and later do not read them).
import { useEffect, useRef, useState, type RefObject } from 'react'
import * as spine from '@esotericsoftware/spine-webgl'
import { STORAGE_BASE } from '@/lib/constants/game'
import { skinSetsOf, type IdentitySpine, type ImageLayer, type SpineForm, type SpineLayer } from '@/features/catalog/lib/spine-pack'

/** Draws single frames on request, for saving pictures of the figure. */
export interface SpineStageHandle {
  /** Seconds one loop of the playing animation takes. */
  duration(): number
  /**
   * Draws the frame `time` seconds into the loop (the frame on screen when unset) and stops playing until `release`.
   * The canvas only holds the frame until the browser paints again: copy it before awaiting anything.
   */
  draw(time?: number): HTMLCanvasElement
  release(): void
}

interface Props {
  pack: Pick<IdentitySpine, 'base' | 'skeletons'>
  /** A new form is a new stage: remount with a key rather than changing this. */
  form: SpineForm
  /** The skin worn in each skin set of the figure, in skinSetsOf order. Unset: the prefab's start skins. */
  skins?: (string | null)[]
  /** The animation the figure plays. Unset: the prefab's start animation. */
  animation?: string
  /** Holds the frame (reduced motion, or a larger copy is playing). */
  paused?: boolean
  /** How a viewer looks at the figure: zoom (1 = fitted) and a shift in CSS pixels. */
  view?: { zoom: number; x: number; y: number }
  /** Where a figure sits in its box: feet on the bottom edge (on a page) or in the middle (in a viewer). */
  anchor?: 'bottom' | 'center'
  handle?: RefObject<SpineStageHandle | null>
  label?: string
  className?: string
  /** WebGL is missing or a file did not load: nothing will be drawn. */
  onError?: () => void
}

type Rig = SpineLayer & {
  skeleton: spine.Skeleton
  state: spine.AnimationState
  data: spine.SkeletonData
  /** the skin worn per skin set; null = none */
  worn: (string | null)[]
}
type Still = ImageLayer & { texture: spine.GLTexture; color: spine.Color; host?: spine.Bone | null }

const UI_SCALE = 100 // Unity UI: 100 pixels per unit
const FPS = 30 // enough for an idle loop, at half the work of drawing on every screen refresh

/**
 * A texture page with the colour under its fully transparent texels cleared. The pages a pack marks as not
 * premultiplied do store premultiplied colour, but carry stray colour where alpha is 0. Drawn premultiplied that shows
 * as bright streaks; drawn straight it leaks into the edge of each piece as a hairline (10816, at the mouth).
 */
function cleanPage(context: spine.ManagedWebGLRenderingContext, image: HTMLImageElement | ImageBitmap) {
  const canvas = document.createElement('canvas')
  canvas.width = image.width
  canvas.height = image.height
  const pen = canvas.getContext('2d', { willReadFrequently: true })!
  pen.drawImage(image, 0, 0)
  const pixels = pen.getImageData(0, 0, canvas.width, canvas.height)
  const data = pixels.data
  for (let i = 3; i < data.length; i += 4) if (data[i] === 0) data[i - 3] = data[i - 2] = data[i - 1] = 0
  return new spine.GLTexture(context, pixels as unknown as ImageBitmap)
}

/** Skins of different sets are worn together (head + weapon). */
function wear(rig: Rig) {
  const skins = rig.worn.flatMap(name => (name && rig.data.findSkin(name)) || [])
  if (skins.length > 1) {
    const mix = new spine.Skin(skins.map(skin => skin.name).join('+'))
    for (const skin of skins) mix.addSkin(skin)
    rig.skeleton.setSkin(mix)
  } else {
    rig.skeleton.setSkin(skins[0] ?? rig.data.findSkin('default') ?? rig.data.skins[0] ?? null)
  }
  rig.skeleton.setSlotsToSetupPose()
}

/**
 * The area the skeleton covers, in its own units. Only what is visible counts (a slot faded to nothing, such as an
 * effect waiting for an attack, would leave the figure small in a mostly empty box), and every skin and animation is
 * measured, so the figure keeps its size and stays inside the canvas when another one is picked.
 */
function measure(rig: Rig) {
  const probe = new spine.Skeleton(rig.data)
  const points: number[] = []
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
  for (const skin of [rig.skeleton.skin, ...rig.data.skins]) {
    if (!skin) continue
    probe.setSkin(skin)
    for (const animation of rig.data.animations.length ? rig.data.animations : [null]) {
      for (let step = 0; step <= 24; step++) {
        probe.setToSetupPose()
        if (animation) animation.apply(probe, 0, (Math.max(animation.duration, 0.001) * step) / 24, false, [], 1, spine.MixBlend.setup, spine.MixDirection.mixIn)
        probe.updateWorldTransform()
        for (const slot of probe.drawOrder) {
          const attachment = slot.getAttachment()
          if (!slot.bone.active || slot.color.a < 0.02) continue
          let count = 0
          if (attachment instanceof spine.RegionAttachment) {
            if (attachment.color.a < 0.02) continue
            count = 8
            attachment.computeWorldVertices(slot.bone, points, 0, 2)
          } else if (attachment instanceof spine.MeshAttachment) {
            if (attachment.color.a < 0.02) continue
            count = attachment.worldVerticesLength
            attachment.computeWorldVertices(slot, 0, count, points, 0, 2)
          }
          for (let i = 0; i < count; i += 2) {
            x0 = Math.min(x0, points[i]); x1 = Math.max(x1, points[i])
            y0 = Math.min(y0, points[i + 1]); y1 = Math.max(y1, points[i + 1])
          }
        }
      }
    }
  }
  return isFinite(x0) ? { x: x0, y: y0, w: x1 - x0, h: y1 - y0 } : null
}

export default function SpineStage({ pack, form, skins, animation, paused = false, view, anchor = 'bottom', handle, label, className, onError }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const live = useRef({ skins, animation, paused, view, anchor, onError })
  useEffect(() => { live.current = { skins, animation, paused, view, anchor, onError } })
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    // An SD figure stands on the page (transparent); a full illustration fills its 16:9 frame.
    const figure = !form.frame
    let context: spine.ManagedWebGLRenderingContext
    let renderer: spine.SceneRenderer
    try {
      context = new spine.ManagedWebGLRenderingContext(canvas, { alpha: figure, premultipliedAlpha: true })
      if (!context.gl) throw new Error('WebGL is not available')
      renderer = new spine.SceneRenderer(canvas, context)
    } catch {
      live.current.onError?.()
      return
    }
    const gl = context.gl
    const root = `${STORAGE_BASE}/${pack.base}`
    let stopped = false
    let raf = 0
    let timer: ReturnType<typeof setTimeout> | undefined
    let visible = true
    const observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting })
    observer.observe(canvas)

    // One loader per layer; all of them are released on unmount (their textures live in video memory).
    const loaders = form.layers.map(layer => {
      if (layer.kind === 'image') {
        const loader = new spine.AssetManager(context, root)
        loader.loadTexture(layer.file)
        return loader
      }
      const files = pack.skeletons[layer.dir]
      const loader = files.premultiplied
        ? new spine.AssetManager(context, root + files.path)
        : new spine.AssetManagerBase(image => cleanPage(context, image), root + files.path)
      loader.loadText(files.skeleton)
      loader.loadTextureAtlas(files.atlas)
      return loader
    })

    let drawn: (Rig | Still)[] = []
    let bounds = { x: -300, y: -300, w: 600, h: 600 }
    let clip = false

    const begin = () => {
      if (stopped) return
      if (loaders.some(loader => loader.hasErrors())) { live.current.onError?.(); return }
      // A timer, not an animation frame: loading must also finish in a background tab.
      if (!loaders.every(loader => loader.isLoadingComplete())) { timer = setTimeout(begin, 50); return }

      drawn = form.layers.map((layer, index) => {
        const loader = loaders[index]
        if (layer.kind === 'image') {
          const tint = layer.tint ?? [1, 1, 1]
          return { ...layer, texture: loader.require(layer.file) as spine.GLTexture, color: new spine.Color(tint[0], tint[1], tint[2], layer.alpha ?? 1) }
        }
        const files = pack.skeletons[layer.dir]
        const data = new spine.SkeletonJson(new spine.AtlasAttachmentLoader(loader.require(files.atlas))).readSkeletonData(loader.require(files.skeleton))
        const skeleton = new spine.Skeleton(data)
        const state = new spine.AnimationState(new spine.AnimationStateData(data))
        const start = (layer.animation && data.findAnimation(layer.animation)) || data.animations[0]
        if (start) state.setAnimation(0, start.name, layer.loop !== false)
        if (layer.timeScale) state.timeScale = layer.timeScale
        const unit = layer.source === 'animation' ? UI_SCALE : 1 // SD prefabs are in world units
        skeleton.x = layer.x * unit
        skeleton.y = layer.y * unit
        skeleton.scaleX = layer.scaleX * UI_SCALE * (layer.flipX ? -1 : 1)
        skeleton.scaleY = layer.scaleY * UI_SCALE
        if (layer.alpha !== undefined) skeleton.color.a = layer.alpha
        const rig: Rig = { ...layer, data, skeleton, state, worn: skinSetsOf(files, layer.skin).map(set => set.start) }
        wear(rig)
        return rig
      })

      const rigs = drawn.filter((item): item is Rig => item.kind === 'spine')
      if (rigs.length === 0) { live.current.onError?.(); return }
      const main = rigs.reduce((a, b) => (b.data.slots.length > a.data.slots.length ? b : a))
      const area = form.safe ?? form.frame
      if (area) {
        bounds = { x: area.x - area.w / 2, y: area.y - area.h / 2, w: area.w, h: area.h }
        clip = true
      } else {
        const box = measure(main)
        if (box) {
          bounds = {
            x: main.skeleton.x + box.x * main.skeleton.scaleX,
            y: main.skeleton.y + box.y * main.skeleton.scaleY,
            w: box.w * Math.abs(main.skeleton.scaleX),
            h: box.h * main.skeleton.scaleY,
          }
        }
      }

      /** Draws every layer as it stands, `dt` seconds on. */
      const paint = (dt: number) => {
        const dpr = Math.min(window.devicePixelRatio || 1, 2)
        const w = Math.round(canvas.clientWidth * dpr)
        const h = Math.round(canvas.clientHeight * dpr)
        if (w === 0 || h === 0) return
        if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h }
        gl.viewport(0, 0, w, h)
        gl.clearColor(0, 0, 0, figure ? 0 : 1)
        gl.clear(gl.COLOR_BUFFER_BIT)
        const look = figure ? live.current.view : undefined
        const zoom = (Math.max(bounds.w / w, bounds.h / h) * (clip ? 1 : 1.08)) / (look?.zoom ?? 1)
        const camera = renderer.camera
        camera.viewportWidth = w * zoom
        camera.viewportHeight = h * zoom
        camera.position.x = bounds.x + bounds.w / 2 - (look?.x ?? 0) * dpr * zoom
        camera.position.y = (figure && live.current.anchor === 'bottom' ? bounds.y + camera.viewportHeight * 0.48 : bounds.y + bounds.h / 2) + (look?.y ?? 0) * dpr * zoom
        camera.update()
        if (clip) {
          gl.enable(gl.SCISSOR_TEST)
          gl.scissor(Math.round(w / 2 - bounds.w / zoom / 2), Math.round(h / 2 - bounds.h / zoom / 2), Math.round(bounds.w / zoom), Math.round(bounds.h / zoom))
        }
        renderer.begin()
        for (const item of drawn) {
          if (item.kind === 'spine') {
            item.state.update(dt)
            item.state.apply(item.skeleton)
            item.skeleton.updateWorldTransform()
            renderer.drawSkeleton(item.skeleton, true) // every page holds premultiplied colour (see cleanPage)
            continue
          }
          if (item.shader && item.skip) continue
          // Stills are not premultiplied.
          renderer.batcher.setBlendMode(gl.SRC_ALPHA, gl.ONE, item.blend === 'add' ? gl.ONE : gl.ONE_MINUS_SRC_ALPHA)
          let cx = item.x, cy = item.y, width = item.w, height = item.h, turn = item.rotation ?? 0
          if (item.bone && item.host === undefined) item.host = rigs.find(rig => rig.dir === item.bone!.dir)?.skeleton.findBone(item.bone.name) ?? null
          if (item.host && item.local) {
            const bone = item.host
            const local = item.local
            cx = bone.a * local.x + bone.b * local.y + bone.worldX
            cy = bone.c * local.x + bone.d * local.y + bone.worldY
            width = local.w * Math.hypot(bone.a, bone.c)
            height = local.h * Math.hypot(bone.b, bone.d)
            turn = local.rotation + (Math.atan2(bone.c, bone.a) * 180) / Math.PI
          }
          if (Math.abs(turn) > 0.05) renderer.drawTextureRotated(item.texture, cx - width / 2, cy - height / 2, width, height, width / 2, height / 2, turn, item.color)
          else renderer.drawTexture(item.texture, cx - width / 2, cy - height / 2, width, height, item.color)
        }
        renderer.end()
        gl.disable(gl.SCISSOR_TEST)
      }

      let last = 0
      let frozen = false // a single frame was asked for through the handle
      let held = '' // what the paused frame was drawn as
      let chosen = '' // the skins prop last put on
      let playing = main.state.getCurrent(0)?.animation?.name
      /** Puts the skins and the animation the props ask for on the figure. True when something changed. */
      const follow = () => {
        const { skins, animation } = live.current
        let changed = false
        if (skins && skins.join() !== chosen) {
          chosen = skins.join()
          main.worn = main.worn.map((skin, n) => (n < skins.length ? skins[n] : skin))
          wear(main)
          changed = true
        }
        if (animation && animation !== playing && main.data.findAnimation(animation)) {
          playing = animation
          main.state.setAnimation(0, animation, main.loop !== false)
          changed = true
        }
        return changed
      }

      if (handle) {
        handle.current = {
          duration: () => main.state.getCurrent(0)?.animation?.duration ?? 0,
          draw: time => {
            frozen = true
            follow()
            if (time !== undefined) {
              for (const rig of rigs) {
                const track = rig.state.getCurrent(0)
                if (track) track.trackTime = time
              }
            }
            paint(0)
            return canvas
          },
          release: () => { frozen = false; last = 0; held = '' },
        }
      }
      setReady(true)

      const frame = (now: number) => {
        if (stopped) return
        raf = requestAnimationFrame(frame)
        if (frozen || !visible || document.hidden) { last = 0; return }
        if (last && now - last < 1000 / FPS - 2) return
        const dt = last ? Math.min((now - last) / 1000, 0.1) : 0
        last = now
        if (follow()) held = ''
        const { paused: still, view } = live.current
        const look = `${canvas.clientWidth}x${canvas.clientHeight}:${view?.zoom}:${view?.x}:${view?.y}`
        if (still && held === look) return
        held = still ? look : ''
        paint(still ? 0 : dt)
      }
      raf = requestAnimationFrame(frame)
    }
    begin()

    return () => {
      stopped = true
      cancelAnimationFrame(raf)
      clearTimeout(timer)
      observer.disconnect()
      if (handle) handle.current = null
      for (const loader of loaders) loader.dispose()
      renderer.dispose()
    }
  }, [pack, form, handle])

  return (
    <canvas
      ref={canvasRef}
      role="img"
      aria-label={label}
      className={className}
      style={{ opacity: ready ? 1 : 0, transition: 'opacity 0.3s ease' }}
    />
  )
}

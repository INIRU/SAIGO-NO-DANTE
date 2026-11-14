// The Spine packs the extractor uploads under `${STORAGE_BASE}/spine/` (limbus-asset-extractor, scripts/spine).
// spine/manifest.json names the current pack file of each kind; every other file carries a content hash in its path.

export type SpinePackKind = 'idle' | 'illust'

/** spine/manifest.json: the only file that is ever replaced. */
export interface SpineManifest {
  updatedAt: string
  runtime: '4.0'
  /** pack kind → path of its pack file, relative to `${STORAGE_BASE}/spine/` */
  packs: Partial<Record<SpinePackKind, string>>
}

export interface SpineSkeleton {
  /** folder of this skeleton's files, relative to the pack's `base`; ends in `/`, includes a content hash */
  path: string
  skeleton: string
  atlas: string
  pages: string[]
  /** pass to drawSkeleton: almost every atlas is premultiplied */
  premultiplied: boolean
  animations: string[]
  skins: string[]
  /** skins of one set replace each other; skins of different sets are worn together (head + weapon) */
  skinSets?: { key: string; skins: string[] }[]
  width: number
  height: number
  bytes: number
}

export interface SpineLayer {
  kind: 'spine'
  dir: string
  x: number
  y: number
  scaleX: number
  scaleY: number
  animation: string | null
  loop: boolean
  skin: string | null
  timeScale?: number
  flipX?: boolean
  alpha?: number
  off?: true
  /** 'graphic': x, y in canvas pixels, scale × 100. 'animation' (SD): world units, multiply x, y and scale by the same number */
  source: 'graphic' | 'animation'
}

export interface ImageLayer {
  kind: 'image'
  /** relative to the pack's `base` */
  file: string
  object: string
  x: number
  y: number
  w: number
  h: number
  rotation?: number
  alpha?: number
  tint?: [number, number, number]
  off?: true
  /** drawn by a game shader this player cannot reproduce; only `blend` is known */
  shader?: string | true
  blend?: 'add'
  /** would paint a solid block or grey blot if drawn plainly: leave out */
  skip?: true
  /** hangs on a bone of the skeleton `dir`; `local` is in that bone's space */
  bone?: { dir: string; name: string }
  local?: { x: number; y: number; w: number; h: number; rotation: number }
}

interface Rect { x: number; y: number; w: number; h: number }

interface SpineScene {
  id: number | null
  /** full illustrations only: the 1536×864 canvas, centre 0,0 */
  frame?: Rect
  /** the part of the frame to show (frame less 1.4% per side) */
  safe?: Rect
  layers: (SpineLayer | ImageLayer)[]
}

export interface SpinePack {
  pack: SpinePackKind
  spine: string
  /** relative to `${STORAGE_BASE}/`, e.g. "spine/illust/" */
  base: string
  skeletons: Record<string, SpineSkeleton>
  /** prefab folder → its layers in drawing order */
  scenes: Record<string, SpineScene>
  /** game id → prefab folders, base form first */
  identities: Record<string, string[]>
}

/** One thing to play: an SD figure (a single skeleton) or a full illustration (its `frame` and every layer in it). */
export interface SpineForm {
  prefab: string
  frame?: Rect
  safe?: Rect
  layers: (SpineLayer | ImageLayer)[]
}

/** What one identity page needs from a pack. */
export interface IdentitySpine {
  base: string
  skeletons: Record<string, SpineSkeleton>
  forms: SpineForm[]
}

/** A skin set as a prefab starts it. `start` is the skin worn at first; null means the set starts bare. */
interface SkinSet {
  key: string
  skins: string[]
  start: string | null
}

/**
 * The skin sets of a skeleton and what each wears at the start. The prefab's start skin picks its set and the other
 * sets start bare; when it names no skin of any set, the first set wears its first skin. A pack without sets has its
 * named skins as one set.
 */
export function skinSetsOf(skeleton: SpineSkeleton, startSkin: string | null): SkinSet[] {
  const named = skeleton.skins.filter(name => name !== 'default')
  const sets = skeleton.skinSets ?? (named.length ? [{ key: '', skins: named }] : [])
  const first = startSkin && skeleton.skins.includes(startSkin) ? startSkin : null
  const home = sets.findIndex(set => first !== null && set.skins.includes(first))
  return sets.map((set, n) => ({ ...set, start: n === home ? first : home < 0 && n === 0 ? set.skins[0] : null }))
}

/**
 * The animations a figure can be switched between: those of a skeleton that has several. One named `all` plays the
 * others together (10508), so there is nothing to pick.
 */
export function motionsOf(skeleton: SpineSkeleton): string[] {
  return skeleton.animations.length > 1 && !skeleton.animations.includes('all') ? skeleton.animations : []
}

/** A name from the game data as a tab label: as the data spells it, with spaces for underscores. */
export function dataLabel(name: string): string {
  return name.replace(/_/g, ' ').trim()
}

/**
 * A form's tab label: its prefab name without the id, the sinner and "Appearance" around it. Two forms of one prefab
 * are told apart by their skeleton names instead.
 */
export function formLabel(form: SpineForm, forms: SpineForm[]): string {
  const rig = form.layers.find((layer): layer is SpineLayer => layer.kind === 'spine')
  if (rig && forms.some(other => other !== form && other.prefab === form.prefab)) return dataLabel(rig.dir.replace(/^(\d+_)+/, ''))
  return dataLabel(form.prefab.replace(/^\d+_[^_]+_/, '').replace(/Appearance$/, '')) || form.prefab
}

/** One form per prefab; an SD prefab holding two skeletons gives one form per skeleton (they are never stacked). */
function formsOf(pack: SpinePack, gameId: string): SpineForm[] {
  const forms: SpineForm[] = []
  for (const prefab of pack.identities[gameId] ?? []) {
    const scene = pack.scenes[prefab]
    if (!scene) continue
    const rigs = scene.layers.filter((layer): layer is SpineLayer => layer.kind === 'spine')
    if (!scene.frame) {
      // SD: `off` only orders them (the game switches a skeleton on itself)
      for (const rig of [...rigs].sort((a, b) => Number(!!a.off) - Number(!!b.off))) forms.push({ prefab, layers: [rig] })
      continue
    }
    const anyOn = rigs.some(rig => !rig.off)
    forms.push({ prefab, frame: scene.frame, safe: scene.safe, layers: scene.layers.filter(layer => !layer.off || (layer.kind === 'spine' && !anyOn)) })
  }
  return forms
}

/** Cuts a pack down to one identity: its forms and only the skeletons they draw. Null when the pack does not hold it. */
export function identitySpine(pack: SpinePack | null, gameId: string | number | null | undefined): IdentitySpine | null {
  if (!pack || gameId == null) return null
  const forms = formsOf(pack, String(gameId))
  if (forms.length === 0) return null
  const skeletons: Record<string, SpineSkeleton> = {}
  for (const form of forms) {
    for (const layer of form.layers) if (layer.kind === 'spine') skeletons[layer.dir] = pack.skeletons[layer.dir]
  }
  return { base: pack.base, skeletons, forms }
}

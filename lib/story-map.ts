import { cacheLife, cacheTag } from 'next/cache'
import { STORAGE_BASE } from '@/lib/constants/game'
import { CACHE_TAGS } from '@/lib/constants/cache-tags'
export { storageName } from '@/lib/storage-name'
import type { CameraSetting } from '@/app/[lang]/story/_components/story-camera'

/** The story map export (Limbus Assets pipeline/story_map.py) in Storage; NEXT_PUBLIC_STORY_MAP_BASE points a dev server at a local copy. */
export const STORY_MAP_BASE = process.env.NEXT_PUBLIC_STORY_MAP_BASE || `${STORAGE_BASE}/story-map`
/** The base the browser gets: a local dev copy as a path on the same site, so a tunnel or another device can load it */
export const STORY_MAP_PAGE_BASE = STORY_MAP_BASE.replace(/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/, '')

export type Texts = Partial<Record<'ko' | 'en' | 'ja', string>>

export interface StoryUnit { id: number; count: number; level: number | null; hidden?: boolean }

export interface StoryNode {
  id: number
  stage: number
  /** Map pixels from the bottom-left of the tile grid */
  x: number
  y: number
  /** The card sits above the node */
  upper: boolean
  type: string
  /** StageNodeTypeSpritePairs sprite names (story-map/ui/s/<name>.webp): the icon on the node and the card's tag */
  icon: string
  tag: string
  label: string
  title: Texts | null
  cg: boolean
  /** A DUNGEON node: the id of its interior (story-map/dungeon/<id>.json) */
  dungeon?: number
  /** The dungeon's entry (static-data dungeon): recommended level, Enkephalin modules to enter, EX, floors, picture */
  dungeonInfo?: { recommended: number | null; stamina: number | null; ex: Texts[]; floors: number; illust?: boolean }
  battle?: {
    level: number | null
    recommended: number | null
    stamina: number | null
    turnLimit: number | null
    boss: boolean
    waves: StoryUnit[][]
    /** EX clear conditions, texts with their numbers filled in */
    ex?: Texts[]
  }
  /** 10장 시지프 백화점 (RPG): each ending's battles by floor, the ones the RPG data names (story_map.py rpg_endings) */
  endings?: { key: string; floors: { floor: string | null; battles: (NonNullable<StoryNode['battle']> & { id: number })[] }[] }[]
}

export interface StorySubchapter {
  id: number
  part: number
  number: string
  title: Texts | null
  company: Texts | null
  area: Texts | null
  /** id: whose StageMap tiles to draw (re-run intervals borrow their original's) */
  map: { id?: number; rows: number; cols: number; tile: number; tiles: [number, number][] }
  camera: CameraSetting
  /** The map effect's anchor (map pixels from the bottom left) when the chapter sets it (main-stage-map-setting
   * effectPosition); else the map's centre */
  effectAt?: [number, number]
  /** 상·중·하편: the last node id of each stage group (subchapter-detail), when there is more than one */
  groups?: number[] | null
  nodes: StoryNode[]
  /** cover/<id>.webp exists (the chapter list's background): shown blurred while the map loads */
  coverImg?: boolean
  /** Per unit id. The full enemy records (hp, speed, stagger, skills …) are in story-map/enemies.json for an enemy DB. */
  enemies: Record<string, {
    name: Texts | null
    desc: Texts | null
    /** Unit id of the portrait to show (its own, or the unit whose appearance it wears) */
    portrait?: number | null
    /** atk: SLASH / PENETRATE / HIT, sin: CRIMSON … VIOLET (+ WHITE / BLACK) → damage multiplier */
    resist?: { atk: Record<string, number>; sin: Record<string, number> }
    /** The game marks it a mob (Enemies desc 잡몹 / 일반 적, or a *Mob* appearance). VIEWER: others are spoilers */
    mob?: boolean
  }>
}

export type StoryIndexEntry = Pick<StorySubchapter, 'id' | 'part' | 'number' | 'title' | 'company' | 'area'> & {
  /** StagePartText: 지옥 (part 1), 외전 (part 91) */
  partTitle: Texts | null
  illust: boolean
  /** In-story date of the chapter, e.g. 985-03 (StageChapterText.timeline) */
  timeline: string | null
  /** Map tile [row, col] of mapId under the first stage: the chapter select background */
  cover: [number, number] | null
  /** cover/<id>.webp: a 3 x 2 tile window of the map, its busiest part (story_map.py cover_image); else the cover tile */
  coverImg?: boolean
  mapId: number
  /** subchapterFeatureList HARD: the hard version of `normal` (9112 of 9105) */
  hard: boolean
  normal: number | null
  /** isSyncChapter: the same chapter again under another id (9128 = 110); never listed */
  sync: number | null
}

async function read<T>(path: string): Promise<T | null> {
  const res = await fetch(`${STORY_MAP_BASE}/${path}`)
  return res.ok ? res.json() as Promise<T> : null
}

export async function getStoryIndex(): Promise<StoryIndexEntry[]> {
  'use cache'
  cacheLife('max')
  cacheTag(CACHE_TAGS.gameData)
  return ((await read<StoryIndexEntry[]>('index.json')) ?? []).filter(e => !isCollab(e))
}

/** The collab 선의의 순례 (LC-PC, 9120/9121) is left out (USER 2026-11-09): the game keeps its data but no longer ships
 * its map, dungeon floor or pictures (the client looks up StageMap_9120 and finds nothing). */
const isCollab = (e: { number: string }) => !/^\d+(\.\d+)?$/.test(e.number)

export async function getStorySubchapter(id: number): Promise<StorySubchapter | null> {
  'use cache'
  cacheLife('max')
  cacheTag(CACHE_TAGS.gameData)
  const sub = await read<StorySubchapter>(`sub/${id}.json`)
  return sub && !isCollab(sub) ? sub : null
}

export function pickText(t: Texts | null | undefined, lang: 'ko' | 'en' | 'ja'): string {
  return t?.[lang] ?? t?.ko ?? t?.en ?? ''
}

/** A story dungeon's interior (pipeline/story_map.py dungeons()): floors of nodes with their encounter (Dungeon.Map.ENCOUNTER),
 * world position "x,z" (main chapter dungeons; null for the mirror-dungeon kind), sector / row and adjacent nodes. */
/** [centre x, centre y, width, height] in the dungeon map's units (y up), as the game's RectTransforms have them. */
export type DungeonRect = [number, number, number, number]
export type RGBA = [number, number, number, number]
/** Image.Type.Sliced: borders in map units (left, bottom, right, top), the same as uv fractions, fillCenter */
export interface DungeonSlice { border: [number, number, number, number]; uv: [number, number, number, number]; fill: boolean }
/** A room's child Image (7장-style rooms): on = active in the prefab, mask = a Unity Mask over its kids */
export interface DungeonPart { name: string; on: boolean; rect: DungeonRect; tilt?: number; /** turned about its centre, degrees counter-clockwise (8-20 2F slanted sectors) */ rot?: number; /** mirrored [x, y] about its centre (a negative localScale) */ flip?: [boolean, boolean]; sprite?: string; color?: RGBA; fit?: boolean; slice?: DungeonSlice; mask?: boolean; kids?: DungeonPart[] }
/** fit: Image.preserveAspect (the sprite fitted in the rect, its aspect kept) */
export interface DungeonDoor { rect: DungeonRect; rot: number; sprite: string | null; slice?: DungeonSlice; fit?: boolean }
/** One floor as its DungeonMapFloor_<id>_<floor> prefab lays it out (pipeline/story_map.py dungeon_layouts). */
export interface DungeonFloorMap {
  /** order: the Canvas sorting order they draw at (-1: under the LineRenderers; 1: [Script]MapCanvas) */
  pics: { rect: DungeonRect; sprite?: string; illust?: boolean; color: RGBA; clip?: DungeonRect; order?: number; slice?: DungeonSlice; fit?: boolean; lift?: number }[]
  /** iconSprite: the prefab's own Icon sprite (a cleared BOSS room shows it) */
  nodes: Record<string, { rect: DungeonRect; panel: string | null; panelSlice?: DungeonSlice; frame: [number, number] | null; icon: [number, number] | null; doors: DungeonDoor[]; iconSprite?: string; /** 8장 rooms: the panel in the room's own _configColor */ panelColor?: RGBA; /** 8장 rooms: panel, frame and icon of a blocked room */ blockedColor?: RGBA; /** a block trigger room: once passed, every room up to threshold is blocked */ block?: { threshold: number; timing: number }; /** 8장 rooms: IconFrame and Icon in the encounter's colour */ encounterIcon?: boolean; unlocks?: number[]; frameFit?: boolean; iconFit?: boolean; /** the room's localScale when not 1 (5-36 2F: 0.7); rect, frame, icon and doors already include it */ scale?: number
    /** 7장-style rooms (no IconFrame): the child Images in hierarchy order; their StoryDungeonNodeGrayscale; a picture room */
    parts?: DungeonPart[]; gray?: { color: RGBA; colorTargets: string[]; materialTargets: string[] }; illustNode?: boolean }>
  /** LineRenderer points and width, or (StoryDungeonLineImageUI) the Images that draw the line */
  lines: { a: number; b: number; from?: number; pts: [number, number][]; width: number; doors: DungeonDoor[]; imgs?: { rect: DungeonRect; rot: number; sprite: string | null; fit?: boolean; material?: string; white?: number; black?: number }[] }[]
  /** MapFloor._mapFog: drawn over the floor while the party is on another one */
  fog?: { rect: DungeonRect; color: RGBA; over?: boolean; lift?: number }
  /** 1~3장 area names (MapTexts: TextMeshProUGUI + StoryDungeonAreaTextLoader); text from Localize DungeonArea[key] */
  texts?: { key: string; at: [number, number]; size: [number, number]; pivot: [number, number]; tilt: number; q?: [number, number, number, number]; z: number; fonts?: Partial<Record<'ko' | 'en' | 'ja', string>>; margin?: [number, number, number, number]; color: RGBA; fontSize: number
    autoSize: boolean; sizeRange: [number, number]; style: number; align: [number, number]; spacing: [number, number, number]; wrap: number; text?: Texts }[]
  /** Area name sparkle: alpha = lerp(from, to, clamp01(curve(t))), t looping over duration */
  sparkle?: { duration: number; from: number; to: number; curve: [number, number, number, number][]; pre?: number; post?: number }
}
/** A story dungeon event result: by its condition (Prob_x, ChooseUnit_…), the next event and the effects, worded with the
 * game's templates (text: <color=#hex> rich text) */
export interface DungeonEventEffect { resultEffect?: string; text?: Texts; battle?: StoryNode['battle']; [k: string]: unknown }
/** An E.G.O gift an event gives, takes or asks for: the game's name and effect text (Localize EGOgift desc), grade, sin, keyword */
export interface DungeonEventGift { name: Texts; desc?: Texts; grade?: string; sin?: string; keyword?: string; stackable?: boolean }
export interface DungeonEventResult { cond: string; next?: number; effects?: DungeonEventEffect[] }
/** A story dungeon event (EVENT room): a choice (scene text and options) or a sinner check (judgement, bonuses, success / failure) */
export type DungeonEvent = { id: number } & (
  | { kind: 'choice'; desc?: Texts; options: { text?: Texts; sub?: Texts; lock?: string; results: DungeonEventResult[] }[] }
  | { kind: 'check'; desc?: Texts; behave?: Texts; people: { min: number; max: number }; sins: string[]
      judge: { upDownType: number; inclusiveValue: number; exclusiveValue: number }; judgeText: Texts
      bonus: { case: string; adder: number; text: Texts }[]
      success: { text: Texts[]; results: DungeonEventResult[] }; failure: { text: Texts[]; results: DungeonEventResult[] } })

export interface StoryDungeon {
  id: number
  logic: string
  recommended: number | null
  illust: boolean
  /** MapFloorManager: CameraMovingArea [startX, endX, startY, endY], CameraZoomData (fov 0 = the scene camera's) */
  camera?: { area: [number, number, number, number]; minFov: number; maxFov: number; fov: number | null; addY: number }
  /** Rooms: name and desc are the game's room panel title and story (Localize DungeonNode stageList) */
  floors: { bg: boolean; map?: DungeonFloorMap; nodes: { id: number; enc: number; icon: string | null; name?: Texts; desc?: Texts; sector: number; row: number; pos: [number, number] | null; hidden: boolean; links: number[]; battle?: StoryNode['battle']; bossAttr?: string; illust?: boolean; event?: number }[]
    /** the room whose cleared-state picture the floor shows (story-dungeon-map-illust: dungeon/<id>/map_<room>.webp) */
    illustNode?: number }[]
  enemies: StorySubchapter['enemies']
  /** the events of its EVENT rooms by id (each room's event: its first) */
  events?: Record<string, DungeonEvent>
  /** the gifts its events name, by game id (pictures: gift/<id>.webp) */
  gifts?: Record<string, DungeonEventGift>
  /** the events with a picture (event/<id>.webp: ChoiceEvent_<id>) */
  eventPics?: number[]
}
/** dungeon/ui.json: DungeonUIConfig, the encounter and line colour sets, the dungeon scene's Main Camera. */
export interface StoryDungeonUI {
  encounters: Record<string, Record<string, { sprite: string; node: RGBA; icon: RGBA }>>
  encounterSetOf: Record<string, string>
  nodeDefault: RGBA
  doors: Record<string, { scale: number; sprite: string }>
  lines: Record<string, Record<string, RGBA>>
  /** Mirror-style event dungeons (StoryDungeonNode_MirrorDungeonVersion, RandomDungeonUISettings): per dungeon the room
   * picture by kind (normal / hard / boss) and state, the Icon sprite by encounter, the line colour by LINE_STATE */
  mirror?: Record<string, {
    sets: Record<'normal' | 'hard' | 'boss', Record<'normal' | 'current' | 'passed' | 'notAvailable' | 'currentCleared' | 'nextPassable' | 'hover',
      { sprite: string | null; bg: RGBA; frame: string | null; size: [number, number]; pos: [number, number, number]; color: RGBA }>>
    lines: Record<string, RGBA>
    icons: Record<string, string>
  }>
  /** follow: the camera's move to a room (MoveCamAndExecuteEncounter): _CAM_FOLLOWING_DURATION and _moveAnimCurve keys [time, value, inSlope, outSlope] */
  camera: { fov: number; pitch: number; offset: [number, number, number]; zoomSpeed: number; moveSensitivity: number; follow?: { duration: number; curve: [number, number, number, number][] } }
  /** The PlayerToken RectTransform (map units) and its Image */
  token: { size: [number, number]; pivot: [number, number]; tilt: number; sprite: string; preserveAspect: boolean }
  /** [Script]MapCanvas: its size and its world z (the map's y 0 sits there) */
  canvas?: { size: [number, number]; z: number }
  /** NodeUI StartTypo (TextMeshProUGUI) and ClearMark */
  startTypo?: { text: string; font: string; size: number; color: RGBA; align?: [string, string]; file?: string }
  /** NodeUI: [Image]selectBG and Outline (sliced) on the selected room, their sizes the room's plus `grow` */
  select?: { bg: { grow: [number, number]; color: RGBA }; outline: { grow: [number, number]; sprite: string; color: RGBA; slice: DungeonSlice | null } }
  clearMark?: { sprite: string; size: [number, number]; color: RGBA }
  /** The cleared-line material (FX_Grp_0_Master_Dissolve): its properties and textures (ui/fx/), drawn at sorting order `order` */
  lineCleared?: { material: string; shader: string | null; floats: Record<string, number>; colors: Record<string, number[]>; textures: Record<string, { file: string; wrap: [number, number] }>; order: number }
  /** The dungeon camera's URP post-processing (only Bloom is set) */
  post?: { bloom: { threshold: number; intensity: number; scatter: number; clamp: number; tint: number[]; highQuality: boolean; downscale: string; maxIterations: number; skipIterations: number } }
  /** Sin colour by ATTRIBUTE_TYPE (NONE: _uiTextDarkColor) */
  sinColors?: Record<string, RGBA>
  /** TextMeshProLanguageSetter's font per language (the site's /fonts/<font>.woff2) and its TMP FaceInfo per em */
  areaFonts?: Record<'ko' | 'en' | 'ja', { font: string; lineHeight: number; ascent: number; descent: number }>
  /** the area names' fonts from the game (TMP font asset name): subset file, FaceInfo per em */
  fontFaces?: Record<string, { file: string; lineHeight: number; ascent: number; descent: number }>
}

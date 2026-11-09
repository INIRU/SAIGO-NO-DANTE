'use client'

import { isTouch, local } from './landscape'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { DungeonDoor, DungeonPart, DungeonRect, RGBA, StoryDungeon, StoryDungeonUI, StoryNode, StorySubchapter } from '@/lib/story-map'
import { storageName } from '@/lib/storage-name'
import { SIN_ATTRIBUTE_CODES, SIN_ICON_MAP } from '@/lib/constants/sin'
import { BackButton, StagePanel } from './StoryClient'
import DungeonEventWindow from './DungeonEvent'
import DungeonGifts from './DungeonGifts'
import { DungeonGL, type Cam, type Item, type Slice } from './dungeon-gl'

type Lang = 'ko' | 'en' | 'ja'

// Dungeon.Map.ENCOUNTER names (site words, not the game's UI text)
const L = {
  ko: { back: '스테이지 지도로', floor: (n: number) => `${n}F`, floors: '층', rooms: '방',
    enc: { 0: '시작', 1: '전투', 2: '어려운 전투', 3: '이벤트', 4: '세이브', 5: '환상체 전투', 6: '보스', 12: '계단', 13: '스토리', 14: '어려운 환상체 전투' } as Record<number, string>,
    room: '전투가 없는 칸입니다.', noGl: '이 브라우저에서는 던전 지도를 그릴 수 없습니다 (WebGL2).' },
  en: { back: 'Back to the stage map', floor: (n: number) => `${n}F`, floors: 'Floors', rooms: 'Rooms',
    enc: { 0: 'Start', 1: 'Battle', 2: 'Hard battle', 3: 'Event', 4: 'Save', 5: 'Abnormality', 6: 'Boss', 12: 'Stairs', 13: 'Story', 14: 'Hard abnormality' } as Record<number, string>,
    room: 'No battle here.', noGl: 'This browser cannot draw the dungeon map (WebGL2).' },
  ja: { back: 'ステージマップへ', floor: (n: number) => `${n}F`, floors: '階', rooms: '部屋',
    enc: { 0: 'スタート', 1: '戦闘', 2: '困難な戦闘', 3: 'イベント', 4: 'セーブ', 5: '幻想体戦闘', 6: 'ボス', 12: '階段', 13: 'ストーリー', 14: '困難な幻想体戦闘' } as Record<number, string>,
    room: '戦闘のないマスです。', noGl: 'このブラウザではダンジョンマップを描けません (WebGL2)。' },
}

const WHITE: RGBA = [1, 1, 1, 1]
/** Unity AnimationCurve.Evaluate for non-weighted keys [time, value, inSlope, outSlope]: cubic Hermite per span */
function evalCurve(keys: [number, number, number, number][], x: number, post?: number): number {
  if (!keys.length) return x
  // AnimationCurve post infinity past the last key (serialized InternalWrapMode): 0 PingPong, 1 Repeat, else clamped
  const t0 = keys[0][0], len = keys[keys.length - 1][0] - t0
  if (x > t0 + len && len > 0 && (post === 0 || post === 1)) {
    const u = (x - t0) / len
    x = t0 + len * (post === 1 ? u - Math.floor(u) : 1 - Math.abs((u % 2) - 1))
  }
  if (x <= keys[0][0]) return keys[0][1]
  for (let i = 0; i + 1 < keys.length; i++) {
    const [t0, v0, , o0] = keys[i], [t1, v1, i1] = keys[i + 1]
    if (x > t1) continue
    const dx = t1 - t0, t = (x - t0) / dx, t2 = t * t, t3 = t2 * t
    return (2 * t3 - 3 * t2 + 1) * v0 + (t3 - 2 * t2 + t) * o0 * dx + (-2 * t3 + 3 * t2) * v1 + (t3 - t2) * i1 * dx
  }
  return keys[keys.length - 1][1]
}
// DungeonNodeUIButton.StartScaleIcon: rect_iconFrame to _maxScaleSize 1.2 in _scaleDuration 0.25 s along _scaleCurve
const HOVER_SCALE = 1.2, HOVER_TIME = 0.25
// Floor i is moved by (0, 0, i * 5) in the map canvas's space, 5 i below the first
const FLOOR_STEP = 5
const floorY = (fi: number) => -FLOOR_STEP * fi

type VNode = { id: number; enc: number; hidden: boolean; unlocks?: number[]; panelColor?: RGBA; blockedColor?: RGBA; block?: { threshold: number }; encounterIcon?: boolean; frameFit?: boolean; iconFit?: boolean; scale?: number; rect: DungeonRect; panel: string; panelSlice?: Slice; frame: [number, number]; icon: [number, number]; doors: (DungeonDoor & { slice?: Slice })[]; iconSprite?: string; bossAttr?: string; parts?: DungeonPart[]; gray?: { color: RGBA; colorTargets: string[]; materialTargets: string[] }; illustNode?: boolean }
type VLine = { a: number; b: number; from?: number; pts: [number, number][]; width: number; doors: (DungeonDoor & { slice?: Slice })[]; imgs?: { rect: DungeonRect; rot: number; sprite: string | null; fit?: boolean; material?: string; white?: number; black?: number }[] }
type Pic = { rect: DungeonRect; sprite?: string; illust?: boolean; color: RGBA; clip?: DungeonRect; order?: number; slice?: Slice; fit?: boolean; lift?: number }
type FView = { fi: number; bg: boolean; pics: Pic[]; nodes: VNode[]; lines: VLine[]; fog?: { rect: DungeonRect; color: RGBA; over?: boolean; lift?: number }; texts?: NonNullable<StoryDungeon['floors'][number]['map']>['texts']; sparkle?: NonNullable<StoryDungeon['floors'][number]['map']>['sparkle'] }

/** A floor without its prefab read (the 9xxx event dungeons have no DungeonMapFloor): GUESS the 4장 room size and
 * straight lines, positions from the static data or, without them, by steps from START. */
function fallback(nodes: StoryDungeon['floors'][number]['nodes']): { nodes: VNode[]; lines: VLine[] } {
  const at = new Map<number, [number, number]>()
  if (nodes.every(n => n.pos)) for (const n of nodes) at.set(n.id, n.pos!)
  else {
    const ids = new Set(nodes.map(n => n.id))
    const start = nodes.find(n => n.enc === 0) ?? nodes[0]
    const depth = new Map([[start.id, 0]])
    for (const q = [start]; q.length;) {
      const n = q.shift()!
      for (const l of n.links) if (ids.has(l) && !depth.has(l)) { depth.set(l, depth.get(n.id)! + 1); q.push(nodes.find(m => m.id === l)!) }
    }
    const maxD = Math.max(...depth.values(), 0)
    for (const n of nodes) if (!depth.has(n.id)) depth.set(n.id, maxD + 1)
    const cols = new Map<number, number[]>()
    for (const n of nodes) cols.set(depth.get(n.id)!, [...(cols.get(depth.get(n.id)!) ?? []), n.id])
    for (const [d, col] of cols) col.sort((a, b) => a - b).forEach((id, i) => at.set(id, [d * 7, (col.length - 1) / 2 * 5 - i * 5]))
  }
  const vn = nodes.map((n): VNode => ({ id: n.id, enc: n.enc, hidden: n.hidden, rect: [...at.get(n.id)!, 4.2, 2.6], panel: 'MainUI_MainDungeon_1_1', frame: [2.5, 2.5], icon: [2.1, 2.9], doors: [] }))
  const lines = nodes.flatMap(n => n.links.filter(l => l > n.id && at.has(l)).map((l): VLine => ({ a: n.id, b: l, pts: [at.get(n.id)!, at.get(l)!], width: 0.16, doors: [] })))
  return { nodes: vn, lines }
}

const inRect = (p: [number, number], r: DungeonRect) => Math.abs(p[0] - r[0]) <= r[2] / 2 && Math.abs(p[1] - r[1]) <= r[3] / 2

/** A story dungeon as the game's camera shows it, drawn with WebGL from the game's own objects (dungeon-gl): the floor
 * prefabs' pictures, LineRenderers, rooms (panel, doors, octagon and encounter icon tinted by the encounter set), the
 * PlayerToken and the fog over the other floors, under the dungeon scene's Main Camera (perspective, 45 degrees down,
 * at the focused room + (5, 15 + additionalCameraYPos, -15)). Picking a room opens its panel. */
/** floor (index) and room (the picked room, its panel open; null: none) come from the page's URL (StoryClient):
 * onFloor / onRoom ask for a change, onClose leaves the dungeon. */
export default function DungeonView({ id, base, lang, title, floor: floorProp, room, onFloor, onRoom, onClose }: {
  id: number; base: string; lang: Lang; title: string; floor: number; room: number | null
  onFloor: (f: number) => void; onRoom: (id: number | null) => void; onClose: () => void
}) {
  const s = L[lang]
  const [d, setD] = useState<StoryDungeon | null>(null)
  const [ui, setUi] = useState<StoryDungeonUI | null>(null)
  const [glFailed, setGlFailed] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  // the board covers the window as the game's screen does: no page scrollbar beside it while it is open (the camera's
  // entry offset depends on the screen's shape)
  useEffect(() => {
    // globals.css keeps a scrollbar gutter on html (scrollbar-gutter: stable): released too, the page behind is covered
    const el = document.documentElement, prev = [el.style.overflow, el.style.scrollbarGutter]
    el.style.overflow = 'hidden'
    el.style.scrollbarGutter = 'auto'
    return () => { el.style.overflow = prev[0]; el.style.scrollbarGutter = prev[1] }
  }, [])

  useEffect(() => {
    let live = true
    fetch(`${base}/dungeon/${id}.json`).then(r => r.ok ? r.json() : null).then(j => { if (live) setD(j) })
    fetch(`${base}/dungeon/ui.json`).then(r => r.ok ? r.json() : null).then(j => { if (live) setUi(j) })
    return () => { live = false }
  }, [base, id])
  // The map's WebGL effect behind this full-screen view stops while it is open (StoryFx listens)
  useEffect(() => {
    // also kept as an attribute: an effect still loading when the dungeon opens (a ?dungeon= link) misses the event
    document.documentElement.setAttribute('data-story-cover', '')
    window.dispatchEvent(new CustomEvent('story-cover', { detail: true }))
    return () => { document.documentElement.removeAttribute('data-story-cover'); window.dispatchEvent(new CustomEvent('story-cover', { detail: false })) }
  }, [])
  useEffect(() => {
    // Escape closes the top layer: the room's panel, else the dungeon
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') { if (room != null) onRoom(null); else onClose() } }
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  }, [onClose, onRoom, room])

  // Every floor: the game spawns them all on one map canvas, one below the
  // other along the map's y; the floors the party is not on are under their MapFloor._mapFog (SetMapFogActive)
  const floors = useMemo((): FView[] => (d?.floors ?? []).map((fl, fi) => {
    const byId = new Map(fl.nodes.map(n => [n.id, n]))
    if (!fl.map) return { fi, bg: fl.bg, pics: [], ...fallback(fl.nodes) }
    const nodes = Object.entries(fl.map.nodes).flatMap(([k, m]): VNode[] => {
      const n = byId.get(Number(k))
      return n ? [{ id: n.id, enc: n.enc, hidden: n.hidden, rect: m.rect, panel: m.panel ?? 'MainUI_MainDungeon_1_1', panelSlice: m.panelSlice, frame: m.frame ?? [2.5, 2.5], icon: m.icon ?? [2.1, 2.9], doors: m.doors, iconSprite: m.iconSprite, unlocks: m.unlocks, panelColor: m.panelColor, blockedColor: m.blockedColor, block: m.block, encounterIcon: m.encounterIcon, frameFit: m.frameFit, iconFit: m.iconFit, scale: m.scale, bossAttr: n.bossAttr, parts: m.parts, gray: m.gray, illustNode: m.illustNode }] : []
    })
    return { fi, bg: fl.bg, pics: fl.map.pics as Pic[], nodes, lines: fl.map.lines, fog: fl.map.fog, texts: fl.map.texts, sparkle: fl.map.sparkle }
  }), [d])
  // a floor the dungeon does not have (a stale URL) falls back to the first
  const floor = floorProp >= 0 && floorProp < Math.max(1, floors.length) ? floorProp : 0
  const view = floors[floor] ?? null
  // a room of another floor (or none) is not picked
  const picked = room != null && view?.nodes.some(n => n.id === room) ? room : null

  // Encounter set and line colours of this dungeon (DungeonUIConfig)
  const encSet = ui ? ui.encounters[ui.encounterSetOf[String(id)] ?? 'default'] ?? ui.encounters.default : null
  // mirror-style event dungeons draw rooms and lines from their own setting (DungeonUIConfig.GetLineColor)
  const mirror = ui?.mirror?.[String(id)] ?? null
  const lineSet = ui ? mirror?.lines ?? ui.lines[String(id)] ?? ui.lines.default : null

  // The panel reads stages: every room becomes one, its battle and the dungeon's enemies as the chapter's.
  const stages = useMemo(() => d?.floors.flatMap(f => f.nodes.map((n): StoryNode => ({
    id: n.id, stage: 0, x: 0, y: 0, upper: false, type: n.battle ? 'NORMAL' : 'STORY', icon: n.icon ?? '', tag: n.icon ?? '',
    // The game's room panel shows the room's name (no number); a room without one keeps the encounter's word
    label: '', title: n.name ?? { [lang]: s.enc[n.enc] ?? '' }, cg: false, battle: n.battle,
  }))) ?? [], [d, lang, s])
  const pseudoSub = d && ({ id: d.id, enemies: d.enemies, nodes: stages } as unknown as StorySubchapter)
  const pickedStage = stages.find(n => n.id === picked)
  const pickedEvent = d?.floors.flatMap(f => f.nodes).find(n => n.id === picked)?.event ?? null

  // Camera: the dungeon scene's Main Camera, a real position over the map: x, its height h above the rooms and its
  // map-y position zc, pitched `pitch` down. ui.camera.offset (y, z): room + (_, 15, -15); additionalCameraYPos raises it.
  const camData = d?.camera
  const pitch = ui?.camera.pitch ?? 45
  const off = ui?.camera.offset ?? [5, 15, -15]
  // the room's floor height too: the camera follows the room in world space (floor i is 5 i lower).
  // MoveCamAndExecuteEncounter (MoveNext): the camera goes to the room + (0, 15 + additionalCameraYPos, -15); on a reset
  // (entering the map) its x then becomes ViewportToWorldPoint((0.15, 0.5, -15)).x, so the room stands 15% from the
  // left: x + 15 * 0.7 * tan(fov / 2) * aspect (5.35 at 1920 x 1009, FOV 30). A room picked later is centred.
  const roomCam = (r: DungeonRect, fi: number, reset = false, fov = baseFov): Cam => {
    const cv = canvasRef.current, aspect = cv && cv.clientHeight ? cv.clientWidth / cv.clientHeight : 16 / 9
    const dx = reset ? 15 * 0.7 * Math.tan((fov * Math.PI) / 360) * aspect : 0
    return { x: r[0] + dx, h: off[1] + (camData?.addY ?? 0) + floorY(fi), zc: r[1] + off[2] }
  }
  // Default zoom: defaultZoomFOV when it is not 0, else minZoomFOV (1~8장: 30)
  const baseFov = camData ? camData.fov || camData.minFov : ui?.camera.fov ?? 30
  const startOf = (f: FView | null | undefined) => f?.nodes.find(n => n.enc === 0) ?? f?.nodes[0]
  const startNode = startOf(view)

  // Camera and zoom live in refs: the board is drawn every frame from them, without React
  const camRef = useRef<Cam | null>(null)
  const fovRef = useRef<number | null>(null)
  const glide = useRef<{ from: Cam; to: Cam; fov0: number; fov1: number; t: number } | null>(null)
  // MoveCamAndExecuteEncounter: to the room, the FOV back to _minZoomFOV when the room's panel opens (else
  // GetDefaultZoomFOV)
  const glideTo = (to: Cam, panel: boolean) => {
    const fov0 = fovRef.current ?? baseFov
    glide.current = { from: camRef.current ?? to, to, fov0, fov1: panel ? camData?.minFov ?? fov0 : baseFov, t: 0 }
  }
  // The party: the picked room (the token moves there, MoveCamAndExecuteEncounterWithMovingIcon), else the floor's START
  const here = picked ?? startNode?.id
  const pick = (nid: number) => onRoom(nid)
  const toFloor = (f: number) => onFloor(f)
  // The camera follows the URL: on the first frame it starts on the room (or the floor's START); then a room picked
  // glides there (the room panel's FOV), a floor changed glides to its START (the default FOV). Back and forward in
  // the browser move it the same way.
  const last = useRef<{ floor: number; room: number | null } | null>(null)
  useEffect(() => { glide.current = null; camRef.current = null; fovRef.current = null; last.current = null }, [d])
  useEffect(() => {
    if (!d || !ui) return
    const prev = last.current
    last.current = { floor, room: picked }
    const n = picked != null ? view?.nodes.find(m => m.id === picked) : startNode
    if (!n) return
    // entering, or a new floor from its START: a reset (GUESS for the floor change: ResetPlayerPosition's path)
    if (!prev) { camRef.current = roomCam(n.rect, floor, picked == null); if (picked != null && camData) fovRef.current = camData.minFov; return }
    if (prev.floor !== floor) glideTo(roomCam(n.rect, floor, picked == null), false)
    else if (picked != null && prev.room !== picked) glideTo(roomCam(n.rect, floor), true)
  }, [d, ui, floor, picked]) // eslint-disable-line react-hooks/exhaustive-deps

  // The draw list, in the game's order: Canvas sorting order (the floors' MapBG / bg / Stair Canvases -1, the
  // LineRenderers 0 (cleared: CLEARED_LINE_LAYER 2), [Script]MapCanvas 1, the PlayerToken's Canvas 3, a fog Canvas on
  // the BattleUnit sorting layer after them), then hierarchy order (floor by floor; in a room: [Button]Node, Doors,
  // [Image]selectBG, Outline, IconFrame with Icon and StartTypo, ClearMark).
  // VIEWER (USER 2026-11-08: every room shown): the map as the game draws a run with every room cleared (save pnids:
  // the state in which the game shows every room, checked in the running game): ClearMark on every room, every line
  // CLEARED (the cleared-line material), a BOSS room in its abnormality's icon and sin colour;
  // the party stands on the floor's START.
  const hover = useRef<{ id: number | null; k: Map<number, number> }>({ id: null, k: new Map() })
  // when the map was shown: the area names' sparkle starts there (OnEnable)
  const shown = useRef(performance.now())
  const scene = useRef<(dt: number) => Item[]>(() => [])
  scene.current = (dt: number) => {
    if (!ui) return []
    const items: [number, Item][] = []
    // each item at its floor's height
    let fy = 0
    // lift: a RectTransform's local z over its floor (the map canvas's z is world down), e.g. a floor's fog
    // hidden rooms no cleared room unlocks (every room is cleared here): their
    // lines stay closed
    const unlocked = new Set(floors.flatMap(f => f.nodes.flatMap(n => n.unlocks ?? [])))
    const hiddenIds = new Set(floors.flatMap(f => f.nodes.filter(n => n.hidden && !unlocked.has(n.id)).map(n => n.id)))
    const push = (order: number, it: Item, lift = 0) => items.push([order, { ...it, y: fy + lift }])
    const sp = (name: string) => `${base}/ui/s/${storageName(name)}.webp`
    // Blocked rooms (8-20: StoryDungeonAnimation_10801.UpdateBlockedNodeUIList): every room up to the highest
    // _blockThresholdId of the block trigger rooms passed. VIEWER (USER 2026-11-08): the map as first entered, before any
    // trigger is passed, so no room is blocked (with every trigger passed the game shows 2F up to 10845 red)
    const blocked = (_id: number) => false
    // StoryDungeonNodeClearState_Default.GetLineState: DEFAULT (0) when either end is blocked, else CLEARED (2) (every
    // room is cleared); a picked room only gets the Outline and the moving token (MoveCamAndExecuteEncounterWithMovingIcon)
    const lineColor = (l: VLine): RGBA => (blocked(l.a) || blocked(l.b) ? lineSet?.['0'] : lineSet?.['2']) ?? [0.6275, 0.7922, 0.2471, 1]
    // Cleared lines in the game's material (the dissolve with its noise). VIEWER (USER
    // 2026-11-08): the board lagged with the bloom pass on, so there is no bloom; a soft halo line under each line (wider,
    // faint orange) stands in for the glow the bloom gave
    const fx = !!ui.lineCleared
    // (a DEFAULT line's halo red: the material turns its red vertex colour pure red)
    const HALO: RGBA = [1, 0.62, 0.12, 0.8], HALO_RED: RGBA = [1, 0.05, 0, 0.8], HALO_WIDTH = 4
    // the LineRenderers in the game's sorting (CLEARED_LINE_LAYER 2, over the rooms); their door caps are Images in the
    // floor's Lines group, which comes before Nodes, so the caps sit under the rooms (5-36 2F recording, 2026-11-08)
    const lineOrder = ui.lineCleared?.order ?? 0
    const door = (dr: DungeonDoor, order: number) => {
      if (dr.sprite) push(order, { k: 'img', tex: sp(dr.sprite), color: WHITE, rect: dr.rect, rot: dr.rot, slice: dr.slice, fit: dr.fit })
    }
    // [Rect]RewardIcons (StoryDungeonNode_MirrorDungeonVersion.SetNodeAttributeUI, battle rooms): AttackType and
    // AttributeType of EffectiveAttributeCalculator, the attack type and sin the battle's enemies resist least (the highest
    // multiplier over the enemies; WHITE / BLACK are not sins). The slots are laid out at run time: side by side, 0.9
    // wide, centred under the room, the attack icon 0.86 and the sin icon 0.72 (measured in the 912711 recording).
    // Rooms without resist data (abnormality parts are not exported) show none: GUESS gap
    const ATK_SPRITE: Record<string, string> = { SLASH: 'Icon_AttackType_slash', PENETRATE: 'Icon_AttackType_pierce', HIT: 'Icon_AttackType_hit' }
    const rewardIcons = (n: VNode, p: DungeonPart) => {
      const units = (d!.floors.flatMap(f => f.nodes).find(m => m.id === n.id)?.battle?.waves ?? []).flat()
      const top = (side: 'atk' | 'sin', keys: string[]) => {
        let best: string | null = null, bv = -Infinity
        for (const k of keys) for (const u of units) {
          const v = d!.enemies?.[String(u.id)]?.resist?.[side]?.[k]
          if (v != null && v > bv) { bv = v; best = k }
        }
        return best
      }
      const atk = top('atk', Object.keys(ATK_SPRITE)), sin = top('sin', Object.keys(SIN_ATTRIBUTE_CODES))
      const slots = [atk && { tex: sp(ATK_SPRITE[atk]), size: 0.86, color: [0.6314, 0.4157, 0.2314, 1] as RGBA },
        sin && SIN_ATTRIBUTE_CODES[sin] && { tex: SIN_ICON_MAP[SIN_ATTRIBUTE_CODES[sin]], size: 0.72, color: WHITE }].filter(x => !!x)
      slots.forEach((s, i) => {
        const x = p.rect[0] + (i - (slots.length - 1) / 2) * 0.9
        push(1, { k: 'img', tex: sp('Sprite_Mirror_Node_Reward_Back_Normal'), color: [0.5, 0.5, 0.5, 1], rect: [x, p.rect[1], 0.9, 0.9], tilt: p.tilt })
        push(1, { k: 'img', tex: s.tex, color: s.color, rect: [x, p.rect[1], s.size, s.size], fit: true, tilt: p.tilt })
      })
    }
    // hover scale: _scaleCurve rises from 0 to 1 with flat ends (smoothstep), back down when the pointer leaves
    const hv = hover.current
    for (const f of floors) for (const n of f.nodes) {
      const cur = hv.k.get(n.id) ?? 0, goal = hv.id === n.id ? 1 : 0
      if (cur !== goal) hv.k.set(n.id, goal > cur ? Math.min(1, cur + dt / HOVER_TIME) : Math.max(0, cur - dt / HOVER_TIME))
    }
    for (const f of floors) {
      fy = floorY(f.fi)
      for (const p of f.pics) {
        // img_mapIllust: the floor picture, else the prefab's own sprite stays
        // every room cleared: the floor's picture after its last listed room (StoryDungeonMapIllustManager)
        const cleared = d!.floors[f.fi].illustNode
        const tex = p.illust && (f.bg || cleared) ? `${base}/dungeon/${id}/${isTouch() ? 'h/' : ''}${cleared ? `map_${cleared}` : f.fi}.webp` : p.sprite ? sp(p.sprite) : null
        if (tex) push(p.order ?? 1, { k: 'img', tex, color: p.color, rect: p.rect, clip: p.clip, slice: p.slice, fit: p.fit }, p.lift)
      }
      // A hidden room the save has not unlocked (the open list holds only the room just
      // left, so a finished dungeon entered again has none) is closed with the lines filed under it (CloseLine(room))
      const shut = (l: VLine) => l.from != null && hiddenIds.has(l.from)
      for (const l of f.lines) if (l.pts.length > 1 && l.width > 0 && !shut(l)) {
        const red = blocked(l.a) || blocked(l.b)
        if (fx) push(lineOrder, { k: 'line', pts: l.pts, width: l.width * HALO_WIDTH, color: red ? HALO_RED : HALO, fx: false, soft: true })
        push(lineOrder, { k: 'line', pts: l.pts, width: l.width, color: lineColor(l), fx })
      }
      // the lines' door caps (Lines/line_<a>_<b>/Door), before the rooms
      for (const l of f.lines) if (!shut(l)) for (const dr of l.doors) door(dr, 1)
      // Image lines (the LINE_STATE colour on each Image)
      for (const l of f.lines) if (!shut(l)) for (const im of l.imgs ?? []) {
        const c = lineColor(l)
        // FX_M_UI_DungeonLine1 (Fx_Grp_Trail_Simple_Shader, no sprite): rgb = colour x _White_Intensity + _Black_Intensity, opaque
        const col: RGBA = im.white != null ? [c[0] * im.white + (im.black ?? 0), c[1] * im.white + (im.black ?? 0), c[2] * im.white + (im.black ?? 0), 1] : c
        push(1, { k: 'img', tex: im.sprite ? sp(im.sprite) : '', color: col, rect: im.rect, rot: im.rot, fit: im.fit })
      }
      for (const n of f.nodes) {
        const e = encSet?.[String(n.enc)]
        // a cleared BOSS room: its first enemy's sin colour (NONE:
        // _uiTextDarkColor) on panel, frame and icon, and the prefab's own Icon sprite (no SetNodeIconByEncounter)
        const boss = n.enc === 6 && n.bossAttr && ui.sinColors ? ui.sinColors[n.bossAttr] ?? ui.sinColors.NONE : null
        const nodeColor = boss ?? e?.node ?? ui.nodeDefault ?? WHITE
        // 8장 rooms (StoryDungeonNode_10801): the panel in the room's _configColor, IconFrame and Icon in the encounter's colour
        // a blocked 8장 room: panel, IconFrame and Icon in _blockedNodeColor (StoryDungeonNode_10801.SetShownType)
        const blockCol = blocked(n.id) ? n.blockedColor : undefined
        const iconColor = blockCol ?? boss ?? (n.encounterIcon ? nodeColor : e?.icon ?? nodeColor)
        // a hidden room is unlocked once cleared (UnlockHiddenNode): its own encounter icon, not MainUI_MainDungeon_q
        const glyph = (boss && n.iconSprite) || (e?.sprite ?? d!.floors[f.fi].nodes.find(m => m.id === n.id)?.icon)
        const r = n.rect
        // StoryDungeonNode_MirrorDungeonVersion.UpdateData: the hard set for HARD_BATTLE / HARD_AB_BATTLE, the boss set for
        // BOSS, else normal; SetShownType with every room cleared: the party's room currentCleared, the rest passed
        const mset = mirror ? (n.enc === 2 || n.enc === 14 ? mirror.sets.hard : n.enc === 6 ? mirror.sets.boss : mirror.sets.normal) : null
        const mstate = mset ? (here === n.id ? mset.currentCleared : mset.passed) : null
        if (n.parts) {
          // 7장-style rooms, part by part in hierarchy order (a cleared
          // room: StoryDungeonNodeGrayscale on: its grey on the colour targets, UI/Grayscale on the material targets)
          const g = n.gray
          const draw = (parts: DungeonPart[], mask?: { tex: string; rect: DungeonRect; fit?: boolean }) => {
            for (const p of parts) {
              const gray = !!g?.materialTargets.includes(p.name)
              // [Rect]RewardIcons (event dungeon rooms): filled at run time (the prefab holds placeholders); the first one is drawn below,
              // the E.G.O gift one ((1), the run's rewards) is not
              if (p.name === 'ClearMark' || p.name === 'AbBattleMark' || p.name === 'Doors' || (p.name.startsWith('[Rect]RewardIcons') && !(mirror && p.name === '[Rect]RewardIcons'))) continue
              if ((p.name === '[Image]selectBG' || p.name === 'Outline') && here !== n.id) continue
              if (p.name === 'Icon') {
                // a picture room hides its icon; else the encounter's glyph in iconColor (mirror style: the dungeon's
                // icon set, in the state's _color)
                const mg = mirror?.icons[String(n.enc)]
                if (n.illustNode || !(mg ?? glyph)) continue
                push(1, { k: 'img', tex: sp((mg ?? glyph)!), color: mstate?.color ?? iconColor, rect: p.rect, fit: p.fit, gray, mask, tilt: p.tilt })
                continue
              }
              if (p.name === '[Rect]RewardIcons' && mirror) { rewardIcons(n, p); continue }
              if (mstate && p.name === '[Button]Node' && mstate.sprite) {
                // SetNodeUI: the state's sprite, _backgroundColor, _size and _localPosition on [Button]Node
                push(1, { k: 'img', tex: sp(mstate.sprite), color: mstate.bg, rect: [p.rect[0] + mstate.pos[0], p.rect[1] + mstate.pos[1], mstate.size[0], mstate.size[1]], fit: p.fit, tilt: p.tilt, rot: p.rot, flip: p.flip })
                continue
              }
              if (mset && (p.name === '[Image]selectBG' || p.name === 'Outline') && mset.hover.sprite) {
                // the _hover state on selectBG and Outline (912711 recording: both in its sprite, white)
                push(1, { k: 'img', tex: sp(mset.hover.sprite), color: mset.hover.bg, rect: [p.rect[0], p.rect[1], mstate?.size[0] ?? p.rect[2], mstate?.size[1] ?? p.rect[3]], tilt: p.tilt })
                continue
              }
              if (p.name === '[Image]Illsut') {
                push(1, { k: 'img', tex: `${base}/dungeon/${id}/${isTouch() ? 'h/' : ''}node_${n.id}.webp`, color: p.color ?? WHITE, rect: p.rect, fit: p.fit, gray, mask })
                continue
              }
              if (p.mask && p.sprite) { if (p.kids) draw(p.kids, { tex: sp(p.sprite), rect: p.rect, fit: p.fit }); continue }
              if (!p.on && p.name !== '[Image]selectBG' && p.name !== 'Outline') continue
              const color = p.name === '[Button]Node' ? (g?.colorTargets.includes(p.name) ? g.color : blockCol ?? boss ?? n.panelColor ?? nodeColor)
                : p.name === '[Image]IconFrame' && (n.encounterIcon || blockCol) ? blockCol ?? nodeColor : p.color ?? WHITE
              if (p.sprite) push(1, { k: 'img', tex: sp(p.sprite), color, rect: p.rect, fit: p.fit, slice: p.slice, gray, mask, tilt: p.tilt, rot: p.rot, flip: p.flip })
              if (p.kids) draw(p.kids, mask)
            }
          }
          draw(n.parts)
          for (const dr of n.doors) door(dr, 1)
          continue
        }
        // [Button]Node: the panel sprite tinted by the encounter's nodeColor
        push(1, { k: 'img', tex: sp(n.panel), color: nodeColor, rect: r, slice: n.panelSlice })
        for (const dr of n.doors) door(dr, 1)
        // The room the party is on shows selected (SetCurrentNodeUISelectedState → SetOutlineEnable, SetCoverEnable)
        if (here === n.id && ui.select) {
          const g = ui.select.bg, o = ui.select.outline, ns = n.scale ?? 1
          push(1, { k: 'img', tex: '', color: g.color, rect: [r[0], r[1], r[2] + g.grow[0] * ns, r[3] + g.grow[1] * ns] })
          push(1, { k: 'img', tex: sp(o.sprite), color: o.color, rect: [r[0], r[1], r[2] + o.grow[0] * ns, r[3] + o.grow[1] * ns], slice: o.slice ?? undefined })
        }
        const k = hv.k.get(n.id) ?? 0, sc = 1 + (HOVER_SCALE - 1) * k * k * (3 - 2 * k)
        push(1, { k: 'img', tex: sp('MainUI_MainDungeon_icon_frame'), color: nodeColor, rect: [r[0], r[1], n.frame[0] * sc, n.frame[1] * sc], fit: n.frameFit })
        if (glyph) push(1, { k: 'img', tex: sp(glyph), color: iconColor, rect: [r[0], r[1], n.icon[0] * sc, n.icon[1] * sc], fit: n.iconFit })
        // StartTypo (shown for START): stretched over IconFrame less (0.2, 0.9)
        if (n.enc === 0 && ui.startTypo?.file) {
          push(1, { k: 'text', text: ui.startTypo.text, font: `${base}/${ui.startTypo.file}`, size: ui.startTypo.size, color: ui.startTypo.color,
            rect: [r[0], r[1], n.frame[0] - 0.2, n.frame[1] - 0.9], scale: sc })
        }
        // ClearMark (a cleared room's check, centred on the room's top right corner): VIEWER (USER 2026-11-08) not drawn
        if (false as boolean && ui.clearMark) {
          push(1, { k: 'img', tex: sp(ui.clearMark.sprite), color: ui.clearMark.color, rect: [r[0] + r[2] / 2, r[1] + r[3] / 2, ui.clearMark.size[0], ui.clearMark.size[1]] })
        }
      }
      // MapTexts (after Nodes in the floor): the area names in the language's font, their alpha sparkling
      // (every name on the same beat from the floor's start)
      // each label's font for the language (TextMeshProLanguageSetter, exported from the game), else the old default
      const faceOf = (t: { fonts?: Partial<Record<'ko' | 'en' | 'ja', string>> }) => {
        const ff = ui.fontFaces?.[t.fonts?.[lang] ?? '']
        if (ff) return { url: `${base}/${ff.file}`, face: ff }
        const df = ui.areaFonts?.[lang] ?? ui.areaFonts?.ko
        return df ? { url: `/fonts/${df.font}.woff2`, face: df } : null
      }
      if (f.texts) {
        const sk = f.sparkle
        const tt = sk ? ((performance.now() - shown.current) / 1000 / sk.duration) % 1 : 0
        const a = sk ? sk.from + (sk.to - sk.from) * Math.min(1, Math.max(0, evalCurve(sk.curve, tt, sk.post))) : null
        for (const t of f.texts) {
          const str = t.text?.[lang] ?? t.text?.ko
          if (!str) continue
          const fc = faceOf(t)
          if (!fc) continue
          push(1, { k: 'label', text: str, font: fc.url, face: fc.face, at: t.at, size: t.size, pivot: t.pivot, align: t.align?.[0], margin: t.margin, tilt: t.tilt, q: t.q, z: t.z,
            color: [t.color[0], t.color[1], t.color[2], a ?? t.color[3]], fontSize: t.fontSize, autoSize: t.autoSize, sizeRange: t.sizeRange,
            spacing: t.spacing, wrap: t.wrap !== 0 })
        }
      }
      // MapFloor._mapFog over a floor the party is not on (SetMapFogActive)
      if (f.fi !== floor && f.fog) push(f.fog.over ? 1e6 : 1, { k: 'img', tex: '', color: f.fog.color, rect: f.fog.rect }, f.fog.lift)
    }
    // PlayerToken: its pivot on the current room's centre, tilted to face the camera
    const tf = floors.find(f => f.nodes.some(m => m.id === here)), tn = tf?.nodes.find(m => m.id === here)
    fy = floorY(tf?.fi ?? 0)
    if (tn) push(3, { k: 'token', tex: sp(ui.token.sprite), at: [tn.rect[0], tn.rect[1]], size: ui.token.size, pivot: ui.token.pivot, tilt: ui.token.tilt, preserveAspect: ui.token.preserveAspect })
    return items.map((x, i) => [x, i] as const).sort((a, b) => a[0][0] - b[0][0] || a[1] - b[1]).map(x => x[0][1])
  }

  // The render loop: camera glide (MapManager camera follow over _CAM_FOLLOWING_DURATION), hover, then the frame
  const gl = useRef<DungeonGL | null>(null)
  const camOf = () => camRef.current ?? (startNode ? roomCam(startNode.rect, floor, true) : { x: 0, h: 15, zc: -15 })
  const frame = useRef<(dt: number) => void>(() => {})
  frame.current = (dt: number) => {
    if (!gl.current || !ui) return
    const lc = ui.lineCleared
    gl.current.setLineFx(lc ? { floats: lc.floats, colors: lc.colors,
      textures: Object.fromEntries(Object.entries(lc.textures).map(([k, t]) => [k, { url: base + '/' + t.file, wrap: t.wrap }])) } : null)
    // VIEWER (USER 2026-11-08, lag): no bloom; with plain lines little on the board is bright enough for it
    gl.current.setBloom(null)
    const g = glide.current
    if (g) {
      // each frame: e = clamp01(_moveAnimCurve.Evaluate(t)), position and FOV lerped by e, then t += deltaTime / duration
      const fl = ui.camera.follow, e = Math.min(1, Math.max(0, fl ? evalCurve(fl.curve, g.t) : g.t))
      camRef.current = { x: g.from.x + (g.to.x - g.from.x) * e, h: g.from.h + (g.to.h - g.from.h) * e, zc: g.from.zc + (g.to.zc - g.from.zc) * e }
      fovRef.current = g.fov0 + (g.fov1 - g.fov0) * e
      if (g.t >= 1) glide.current = null
      else g.t += dt / (fl?.duration ?? 0.5)
    }
    gl.current.draw(scene.current(dt), camOf(), fovRef.current ?? baseFov, pitch)
  }
  useEffect(() => {
    const cv = canvasRef.current
    if (!cv) return
    try { gl.current = new DungeonGL(cv) } catch (e) { console.error("dungeon board:", e); setGlFailed(true); return }
    let raf = 0, last = performance.now()
    // touch devices draw at most 30 times a second (the HDR target and the bloom passes are full-screen each frame)
    const minGap = window.matchMedia('(pointer: coarse)').matches ? 1000 / 30 - 2 : 0
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop)
      if (now - last < minGap) return
      frame.current(Math.min(0.1, (now - last) / 1000))
      last = now
    }
    raf = requestAnimationFrame(loop)
    return () => { cancelAnimationFrame(raf); gl.current?.destroy(); gl.current = null }
  }, [])

  // A room takes the pointer on its [Button]Node Image (the raycast target), turned as drawn (8-20 2F: 45, 135, 225...);
  // rooms without parts on the NodeUI rect
  const overRoom = (p: [number, number], n: VNode) => {
    const b = n.parts?.find(q => q.name === '[Button]Node')
    if (!b?.rot) return inRect(p, b?.rect ?? n.rect)
    const a = (-b.rot * Math.PI) / 180, dx = p[0] - b.rect[0], dy = p[1] - b.rect[1]
    const x = dx * Math.cos(a) - dy * Math.sin(a), y = dx * Math.sin(a) + dy * Math.cos(a)
    return Math.abs(x) <= b.rect[2] / 2 && Math.abs(y) <= b.rect[3] / 2
  }
  // The room under a client pixel: the fog over another floor takes the pointer, as the game's Image does
  const roomAt = (cx: number, cy: number): number | null => {
    if (!gl.current) return null
    for (let i = floors.length - 1; i >= 0; i--) {
      const f = floors[i]
      // the pointer's ray met with this floor's own plane
      const p = gl.current.pick(cx, cy, camOf(), fovRef.current ?? baseFov, pitch, floorY(f.fi))
      if (!p) continue
      if (f.fi !== floor && f.fog && inRect(p, f.fog.rect)) return null
      for (let j = f.nodes.length - 1; j >= 0; j--) if (overRoom(p, f.nodes[j])) return f.nodes[j].id
    }
    return null
  }

  // Dragging while the button is held: x = GetAxis("Mouse X") * deltaTime * _camMovingSensitivity,
  // y likewise with "Mouse Y" (InputManager: 0.1 per pixel); Transform.Translate((-x, 0, -y), Space.World): a flat
  // pan, the height kept; a move that would leave CameraMovingArea (world x, world z) is dropped. deltaTime: one frame
  // at Application.targetFrameRate 60 (vSyncCount 0).
  const drag = useRef<{ x: number; y: number; sx: number; sy: number; moved: boolean } | null>(null)
  // VIEWER: two fingers zoom like the wheel (the field of view, between the camera's min and max)
  const fingers = useRef(new Map<number, [number, number]>())
  const pinch = useRef<{ d0: number; f0: number } | null>(null)
  const spread = () => { const [a, b] = [...fingers.current.values()]; return Math.hypot(a[0] - b[0], a[1] - b[1]) }
  const onPointerDown = (e: React.PointerEvent) => {
    // a press on the page's own controls (back, floors, the room panel) is theirs: no drag, no capture (a captured
    // pointer would take their click away)
    if ((e.target as HTMLElement).closest('button, a, input, nav, [data-dungeon-ui]')) return
    const [x, y] = local(e.clientX, e.clientY)
    // a new touch's first finger drops fingers of an earlier one never seen lifting (see StoryMap)
    if (e.isPrimary) { fingers.current.clear(); pinch.current = null }
    fingers.current.set(e.pointerId, [x, y])
    e.currentTarget.setPointerCapture(e.pointerId)
    if (fingers.current.size === 2) {
      pinch.current = { d0: spread() || 1, f0: fovRef.current ?? baseFov }
      if (drag.current) drag.current.moved = true
      return
    }
    drag.current = { x, y, sx: x, sy: y, moved: false }
  }
  const onPointerMove = (e: React.PointerEvent) => {
    const g = drag.current
    const [x, y] = local(e.clientX, e.clientY)
    if (fingers.current.has(e.pointerId)) fingers.current.set(e.pointerId, [x, y])
    if (pinch.current && fingers.current.size === 2 && camData) {
      glide.current = null
      fovRef.current = Math.min(camData.maxFov, Math.max(camData.minFov, pinch.current.f0 * pinch.current.d0 / spread()))
      return
    }
    if (!g) {
      const nid = roomAt(x, y)
      hover.current.id = nid
      if (canvasRef.current) canvasRef.current.style.cursor = nid != null ? 'pointer' : ''
      return
    }
    if (!ui) return
    if (!g.moved && Math.hypot(x - g.sx, y - g.sy) < 4) return
    g.moved = true
    glide.current = null
    hover.current.id = null
    const k = 0.1 * (1 / 60) * ui.camera.moveSensitivity
    const p2 = (x - g.x) * k, p3 = -(y - g.y) * k
    g.x = x
    g.y = y
    const area = camData?.area, cz = ui.canvas?.z ?? 10
    const c = camOf()
    const zw = c.zc + cz
    if (area && (c.x - p2 < area[0] || c.x - p2 > area[1] || zw - p3 < area[2] || zw - p3 > area[3])) return
    camRef.current = { x: c.x - p2, h: c.h, zc: c.zc - p3 }
  }
  const onPointerUp = (e: React.PointerEvent) => {
    fingers.current.delete(e.pointerId)
    if (pinch.current) {
      // the finger left goes on dragging from where it is
      if (fingers.current.size === 1) { const [x, y] = [...fingers.current.values()][0]; drag.current = { x, y, sx: x, sy: y, moved: true }; return }
      pinch.current = null
    }
    const g = drag.current
    drag.current = null
    if (g && !g.moved) { const nid = roomAt(...local(e.clientX, e.clientY)); if (nid != null) pick(nid) }
  }
  // Wheel zoom: fov -= deltaTime * _zoomSpeed * mouseScrollDelta.y, clamped to [min, max]. One wheel
  // notch is a scroll delta of 1 (the browser's deltaY 100, or 3 lines); deltaTime: one 60 fps frame.
  const onWheel = (e: React.WheelEvent) => {
    if (!camData || !ui) return
    glide.current = null
    const notches = -(e.deltaMode === 1 ? e.deltaY / 3 : e.deltaMode === 2 ? e.deltaY : e.deltaY / 100)
    const step = (1 / 60) * ui.camera.zoomSpeed * notches
    fovRef.current = Math.min(camData.maxFov, Math.max(camData.minFov, (fovRef.current ?? baseFov) - step))
  }

  return (
    <div className="story-panel-in fixed inset-0 z-[70] cursor-grab touch-none select-none overflow-hidden bg-black active:cursor-grabbing"
      onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={e => { drag.current = null; pinch.current = null; fingers.current.delete(e.pointerId) }}
      onPointerLeave={() => { hover.current.id = null }} onWheel={onWheel}>
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" aria-hidden />
      {glFailed && <p className="absolute inset-x-0 top-1/2 text-center text-[var(--text-secondary)]">{s.noGl}</p>}
      {/* The rooms of this floor for the keyboard and screen readers (the board itself is a picture) */}
      {view && (
        <ul aria-label={s.rooms} className="sr-only">
          {view.nodes.map((n, k) => (
            <li key={n.id}>
              <button type="button" onClick={() => pick(n.id)} aria-pressed={here === n.id}>
                {`${view.fi + 1}-${k + 1} ${s.enc[n.enc] ?? ''}`}
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Back, title and the floors in one row at the top left, clear of the room panel on the right */}
      <div className="pointer-events-none absolute left-0 top-0 flex flex-wrap items-center gap-x-3 gap-y-2 px-3 pt-3 @3xl:px-6">
        <BackButton base={base} label={s.back} onClick={onClose} />
        <div className="story-title font-[family-name:var(--font-heading)] text-[1.5rem] text-[var(--gold)] [text-shadow:0_1px_3px_#000,0_0_8px_#000] @3xl:text-[1.875rem]">{title}</div>
        {d && d.floors.length > 1 && (
          <nav aria-label={s.floors} className="pointer-events-auto flex gap-2" onPointerDown={e => e.stopPropagation()} onPointerUp={e => e.stopPropagation()}>
            {d.floors.map((_, f) => (
              <button key={f} type="button" onClick={() => toFloor(f)} aria-pressed={f === floor}
                className={`flex h-11 items-center rounded-sm border bg-[#0b0906]/85 px-3.5 font-[family-name:var(--font-heading)] text-[1.0625rem] shadow-[0_2px_8px_#000a] backdrop-blur-sm transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--gold)] ${f === floor ? 'border-[var(--gold-light)] text-[var(--gold-light)]' : 'border-[#5a4526] text-[#d8ccb6] hover:border-[#86683a]'}`}>
                {s.floor(f + 1)}
              </button>
            ))}
          </nav>
        )}
      </div>
      {/* The gifts this dungeon's events can give, at the top right */}
      {d?.events && d.gifts && (
        <div className="pointer-events-none absolute right-3 top-3 hidden @3xl:block @3xl:right-6" onPointerDown={e => e.stopPropagation()} onPointerUp={e => e.stopPropagation()} onWheel={e => e.stopPropagation()}>
          <DungeonGifts events={d.events} gifts={d.gifts} firsts={d.floors.flatMap(f => f.nodes).flatMap(n => (n.event != null ? [n.event] : []))} lang={lang} base={base} />
        </div>
      )}
      {/* An EVENT room opens the game's event window in the middle of the screen; other rooms the side panel */}
      {pickedStage && pseudoSub && pickedEvent != null && d?.events && (
        <div onPointerDown={e => e.stopPropagation()} onPointerUp={e => e.stopPropagation()} onPointerMove={e => e.stopPropagation()} onWheel={e => e.stopPropagation()}>
          <DungeonEventWindow key={pickedStage.id} events={d.events} gifts={d.gifts} pics={d.eventPics} first={pickedEvent}
            title={pickedStage.title?.[lang] ?? pickedStage.title?.ko ?? ''} lang={lang} sub={pseudoSub} base={base} onClose={() => onRoom(null)} />
        </div>
      )}
      {pickedStage && pseudoSub && pickedEvent == null && (
        <div onPointerDown={e => e.stopPropagation()} onPointerUp={e => e.stopPropagation()} onPointerMove={e => e.stopPropagation()}>
          <StagePanel key={pickedStage.id} node={pickedStage} sub={pseudoSub} base={base} lang={lang} spoiler={false} note={s.room}
            story={d?.floors.flatMap(f => f.nodes).find(n => n.id === pickedStage.id)?.desc} onClose={() => onRoom(null)} />
        </div>
      )}
    </div>
  )
}

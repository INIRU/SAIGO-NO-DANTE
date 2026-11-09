'use client'

import { useTurnedTouchScroll } from './landscape'
import FullscreenGate from './FullscreenGate'
import { useEffect, useMemo, useRef, useState } from 'react'
import { parseAsInteger, useQueryStates } from 'nuqs'
import Link from 'next/link'
import { useHtmlFlag } from '@/hooks/useHtmlFlag'
import '../story.css'
import { X } from 'lucide-react'
import type { StoryNode, StorySubchapter, StoryUnit, Texts } from '@/lib/story-map'
import { SIN_ICON_MAP } from '@/lib/constants/sin'
import type { SinType } from '@/lib/types'
import AttackTypeIcon, { type AttackTypeKey } from '@/components/ui/AttackTypeIcon'
import StoryMap from './StoryMap'
import { useStoryProgress } from './progress'
import { isHiddenChapter } from './story-order'
import DungeonView from './DungeonView'

type Lang = 'ko' | 'en' | 'ja'

const L = {
  ko: {
    title: '스토리 맵', back: '장 선택으로', close: '닫기', enterDungeon: '입장', floorCount: (n: number) => `${n}층`, chapterName: (n: string) => `${n}장`,
    recommended: '추천 레벨', effective: '유효', atk: { slash: '참격', pierce: '관통', blunt: '타격' } as Record<AttackTypeKey, string>, sin: { wrath: '분노', lust: '색욕', sloth: '나태', gluttony: '탐식', gloom: '우울', pride: '오만', envy: '질투' } as Record<SinType, string>, ex: 'EX 클리어 조건', enemies: '적 정보', turnLimit: (n: number) => `${n}턴 제한`, boss: '보스전',
    wave: (i: number) => `${i}웨이브`, hidden: '처음엔 보이지 않음', reveal: '눌러서 보기', story: '스토리', storyOnly: '전투 없이 이야기만 진행되는 스테이지입니다.', spoiler: '아직 열지 않은 장입니다. 장 선택에서 이 장을 누르면 보입니다.',
    spoilerTitle: '스포일러 주의', spoilerBody: '아직 열지 않은 장입니다. 열면 이 장의 스테이지와 적이 보이고, 그 앞의 장도 모두 열립니다.', openAnyway: '그래도 열기',
    ending: '엔딩', otherFloor: '그 외', endingNote: '백화점을 돌아다니며 만나는 전투입니다. 엔딩마다 다릅니다.',
    difficulty: ['노말', '하드'], groups: '편', group: (n: number) => ['상편', '중편', '하편'][n - 1] ?? `${n}편`, pickHint: '스테이지를 누르면 적 정보가 열립니다',
  },
  en: {
    title: 'Story Map', back: 'Back to chapters', close: 'Close', enterDungeon: 'Enter', floorCount: (n: number) => `${n} floors`, chapterName: (n: string) => `Ch. ${n}`,
    recommended: 'Recommended', effective: 'Weak to', atk: { slash: 'Slash', pierce: 'Pierce', blunt: 'Blunt' } as Record<AttackTypeKey, string>, sin: { wrath: 'Wrath', lust: 'Lust', sloth: 'Sloth', gluttony: 'Gluttony', gloom: 'Gloom', pride: 'Pride', envy: 'Envy' } as Record<SinType, string>, ex: 'EX clear', enemies: 'Enemies', turnLimit: (n: number) => `${n}-turn limit`, boss: 'Boss battle',
    wave: (i: number) => `Wave ${i}`, hidden: 'hidden at first', reveal: 'Show', story: 'Story', storyOnly: 'A story stage with no battle.', spoiler: 'Not opened yet. Pick this chapter on the chapter list to show it.',
    spoilerTitle: 'Spoiler warning', spoilerBody: 'You have not opened this chapter yet. Opening it shows its stages and enemies, and opens every chapter before it.', openAnyway: 'Open anyway',
    ending: 'Ending', otherFloor: 'Other', endingNote: 'The battles met while walking the store, different for each ending.',
    difficulty: ['Normal', 'Hard'], groups: 'Parts', group: (n: number) => `Part ${n}`, pickHint: 'Pick a stage to see its enemies',
  },
  ja: {
    title: 'ストーリーマップ', back: '章の選択へ', close: '閉じる', enterDungeon: '入場', floorCount: (n: number) => `${n}階`, chapterName: (n: string) => `${n}章`,
    recommended: '推奨レベル', effective: '有効', atk: { slash: '斬撃', pierce: '貫通', blunt: '打撃' } as Record<AttackTypeKey, string>, sin: { wrath: '憤怒', lust: '色欲', sloth: '怠惰', gluttony: '暴食', gloom: '憂鬱', pride: '傲慢', envy: '嫉妬' } as Record<SinType, string>, ex: 'EXクリア条件', enemies: '敵情報', turnLimit: (n: number) => `${n}ターン制限`, boss: 'ボス戦',
    wave: (i: number) => `ウェーブ${i}`, hidden: '最初は見えない', reveal: '押して表示', story: 'ストーリー', storyOnly: '戦闘のないストーリーステージです。', spoiler: 'まだ開いていない章です。章の選択でこの章を押すと表示されます。',
    spoilerTitle: 'ネタバレ注意', spoilerBody: 'まだ開いていない章です。開くとこの章のステージと敵が表示され、それ以前の章もすべて開きます。', openAnyway: 'それでも開く',
    ending: 'エンディング', otherFloor: 'その他', endingNote: '百貨店を歩き回って出会う戦闘です。エンディングごとに異なります。',
    difficulty: ['ノーマル', 'ハード'], groups: '編', group: (n: number) => ['上編', '中編', '下編'][n - 1] ?? `${n}編`, pickHint: 'ステージを押すと敵情報が開きます',
  },
}

const text = (t: Texts | null | undefined, lang: Lang) => t?.[lang] ?? t?.ko ?? t?.en ?? ''

// Effective attribute marks: the shared brown attack type icon and the site's sin icons.
const ATK_ICONS: Record<string, AttackTypeKey> = { SLASH: 'slash', PENETRATE: 'pierce', HIT: 'blunt' }
const SIN_KEYS: Record<string, SinType> = { CRIMSON: 'wrath', SCARLET: 'lust', AMBER: 'sloth', SHAMROCK: 'gluttony', AZURE: 'gloom', INDIGO: 'pride', VIOLET: 'envy' }

/** The stage's effective attack types and sins: those every shown enemy takes more than normal damage from.
 * GUESS: the game's own rule for its "effective" row was not read from code. */
function effective(node: StoryNode, sub: StorySubchapter) {
  const units = (node.battle?.waves ?? []).flat().filter(u => !u.hidden).map(u => sub.enemies[String(u.id)]?.resist).filter(r => !!r)
  const weak = (k: string, side: 'atk' | 'sin') => units.length > 0 && units.every(r => (r[side][k] ?? 1) > 1)
  return {
    atk: Object.entries(ATK_ICONS).filter(([k]) => weak(k, 'atk')).map(([k, icon]) => ({ key: k, icon })),
    sin: Object.entries(SIN_KEYS).filter(([k]) => weak(k, 'sin')).map(([k, sin]) => ({ key: k, sin })),
  }
}

export default function StoryClient({ lang, sub, base, order, parts, difficulty }: {
  lang: Lang; sub: StorySubchapter; base: string; order: number[]; parts: number[]
  /** The parts are a rerun's normal and hard versions, not two halves of a chapter */
  difficulty: boolean
}) {
  const s = L[lang]
  // Chapters after the reader's progress (chapter select) keep their stages behind ??? .
  const [progress, setProgress] = useStoryProgress()
  // An extra part (9128) is hidden exactly when its chapter (110) is.
  const spoiler = isHiddenChapter(order, progress, parts[0] ?? sub.id)
  const chapterTitle = spoiler ? '???' : text(sub.title, lang)
  // The page's state in the URL (nuqs), for links and reloads: ?stage= the picked stage with its panel open, &dungeon= a
  // dungeon opened over the map, &floor= its floor (1F = 1), &room= its picked room with the room's panel. Only entering
  // the dungeon adds a history entry: back (the browser's or the dungeon's own button) leaves it for the story map in one
  // press, wherever in the dungeon; picking stages, floors and rooms replaces the entry.
  const [q, setQ] = useQueryStates({ stage: parseAsInteger, dungeon: parseAsInteger, floor: parseAsInteger, room: parseAsInteger })
  const nav = useDungeonHistory(q, setQ)
  // Opens at the chapter's first stage, as a fresh save does: the stages after it are hidden until picked.
  const first = [...sub.nodes].sort((a, b) => a.id - b.id)[0]?.id ?? null
  const [lastPicked, setLastPicked] = useState<number | null>(first)
  const stageInUrl = q.stage != null && sub.nodes.some(n => n.id === q.stage) ? q.stage : null
  useEffect(() => { if (stageInUrl != null) setLastPicked(stageInUrl) }, [stageInUrl])
  const selected = stageInUrl ?? lastPicked
  // Picking a stage zooms in and opens its panel; closing it or dragging the map zooms back out, as in the game.
  const open = stageInUrl != null
  const select = (id: number) => { setLastPicked(id); nav.set({ stage: id }) }
  const closeStage = () => nav.set({ stage: null, dungeon: null, floor: null, room: null })
  const node = sub.nodes.find(n => n.id === selected) ?? null
  // A dungeon's interior opens over the map (its own floors, rooms and battles): only a dungeon of this chapter
  const dungeon = q.dungeon != null && sub.nodes.some(n => n.dungeon === q.dungeon) ? q.dungeon : null

  useFullScreen()
  return (
    <div className="story-landscape [container-type:size] fixed inset-0 z-[60] overflow-hidden bg-black">
      <FullscreenGate lang={lang} />
      <h1 className="sr-only">{`${s.title} — ${s.chapterName(sub.number)} ${text(sub.title, lang)}`}</h1>
      <StoryMap key={sub.id} sub={sub} base={base} lang={lang} selected={selected} zoomed={open} spoiler={spoiler} onSelect={select} onDragStart={() => { if (open) closeStage() }} />
      {/* Same header as the chapter list: back button, then the heading in gold at the list title's size. */}
      <div className="pointer-events-none absolute left-0 top-0 flex items-center gap-3 px-3 pt-3 @3xl:px-6">
        <BackButton href={`/${lang}/story`} base={base} label={s.back} />
        <div className="story-title font-[family-name:var(--font-heading)] text-[1.5rem] text-[var(--gold)] [text-shadow:0_1px_3px_#000,0_0_8px_#000] @3xl:text-[1.875rem]">{`${s.chapterName(sub.number)} ${chapterTitle}`}</div>
      </div>
      {!open && (
        <p className="pointer-events-none absolute bottom-5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-sm bg-black/55 px-3 py-1.5 text-[0.8125rem] text-[#d8ccb6]">{s.pickHint}</p>
      )}
      {difficulty && parts.length > 1 && (
        // A rerun's NORMAL / HARD, at the bottom left as in the game: green plate for normal, red for hard.
        <nav aria-label="NORMAL / HARD" className="absolute bottom-4 left-4 flex gap-2">
          {parts.map((id, i) => (
            // a full page load, as from the chapter list (StorySelect ChapterCard)
            <a key={id} href={`/${lang}/story/${id}`} aria-current={id === sub.id ? 'page' : undefined}
              className={`flex h-10 min-w-[6.5rem] items-center justify-center rounded-[3px] border-2 px-3 font-[family-name:var(--font-title)] text-[1.375rem] leading-none shadow-[0_2px_0_#000] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--gold)] ${i === 0 ? 'border-[var(--gold)] bg-[linear-gradient(180deg,#5f8f2a,#3b6118)] text-[#f0c418]' : 'border-[#3a0b0b] bg-[linear-gradient(180deg,#c2302b,#8a1512)] text-[#f3e4cb]'} ${id === sub.id ? '' : 'opacity-50 hover:opacity-80'}`}>
              {i === 0 ? 'NORMAL' : 'HARD'}
            </a>
          ))}
        </nav>
      )}
      {sub.groups && !open && (
        // Stage groups (상·중·하편): the game's compass mark and a numeral; each jumps the camera to its first stage.
        <nav aria-label={s.groups} className="absolute right-3 top-3 flex gap-2 @3xl:right-6">
          {sub.groups.map((last, g) => {
            const prev = g ? sub.groups![g - 1] : 0
            const firstNode = [...sub.nodes].sort((a, b) => a.id - b.id).find(n => n.id > prev && n.id <= last)
            if (!firstNode) return null
            const here = node != null && node.id > prev && node.id <= last
            const color = here ? 'bg-[var(--gold-light)] text-[var(--gold-light)]' : 'bg-[#d8ccb6] text-[#d8ccb6] group-hover:bg-[#f3e4cb] group-hover:text-[#f3e4cb]'
            return (
              <button key={last} type="button" onClick={() => setLastPicked(firstNode.id)} aria-label={s.group(g + 1)} aria-pressed={here}
                className={`group flex h-12 items-center gap-2 rounded-sm border bg-[#0b0906]/85 px-4 shadow-[0_2px_8px_#000a] backdrop-blur-sm transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--gold)] ${here ? 'border-[var(--gold-light)]' : 'border-[#5a4526] hover:border-[#86683a]'}`}>
                <span aria-hidden className={`h-6 w-6 transition-colors ${color.split(' ').filter(c => c.includes('bg-')).join(' ')}`}
                  style={{ maskImage: `url(${base}/ui/group-icon.webp)`, WebkitMaskImage: `url(${base}/ui/group-icon.webp)`, maskSize: 'contain', WebkitMaskSize: 'contain', maskRepeat: 'no-repeat', WebkitMaskRepeat: 'no-repeat' }} />
                <span className={`font-[family-name:var(--font-title)] text-[1.75rem] leading-none transition-colors ${color.split(' ').filter(c => c.includes('text-')).join(' ')}`}>{['I', 'II', 'III', 'IV', 'V'][g] ?? g + 1}</span>
              </button>
            )
          })}
        </nav>
      )}
      {open && node && <StagePanel key={node.id} node={node} sub={sub} base={base} lang={lang} spoiler={spoiler} onClose={closeStage}
        action={node.dungeon != null && <DungeonEntry node={node} base={base} lang={lang} onEnter={() => nav.enter(node.dungeon!)} />} />}
      {dungeon != null && <DungeonView id={dungeon} base={base} lang={lang} title={node ? `${node.label} ${text(node.title, lang)}` : ''}
        floor={(q.floor ?? 1) - 1} room={q.room}
        onFloor={f => nav.set({ floor: f === 0 ? null : f + 1, room: null })}
        onRoom={r => nav.set({ room: r })}
        onClose={nav.leave} />}
      {spoiler && <SpoilerGate lang={lang} onOpen={() => setProgress(parts[0] ?? sub.id)} />}
    </div>
  )
}

type Q = { stage: number | null; dungeon: number | null; floor: number | null; room: number | null }

/** The dungeon's one history entry. enter: the dungeon opens with a new entry (the only one this page adds); leave: back
 * over that entry when this page added it, so one press of the browser's back or the dungeon's own back button returns
 * to the story map; a dungeon that came with the URL (a shared link) is replaced away instead. Everything else in the URL
 * (stage, floor, room) replaces the current entry. */
function useDungeonHistory(q: Q, setQ: (v: Partial<Q>, o: { history: 'push' | 'replace' }) => unknown) {
  const pushed = useRef(false)
  // the browser's back / forward closed or opened it: the entry is no longer this page's to go back over
  useEffect(() => { if (q.dungeon == null) pushed.current = false }, [q.dungeon])
  return {
    set: (v: Partial<Q>) => setQ(v, { history: 'replace' }),
    enter(dungeon: number) {
      if (q.dungeon != null) { setQ({ dungeon, floor: null, room: null }, { history: 'replace' }); return }
      pushed.current = true
      setQ({ dungeon, floor: null, room: null }, { history: 'push' })
    },
    leave() {
      if (pushed.current) { pushed.current = false; window.history.back() }
      else setQ({ dungeon: null, floor: null, room: null }, { history: 'replace' })
    },
  }
}

/** A dungeon stage's entry as the game's panel has it: recommended level, the EX condition and the dungeon card, which
 * is the way in (static-data dungeon). */
function DungeonEntry({ node, base, lang, onEnter }: { node: StoryNode; base: string; lang: Lang; onEnter: () => void }) {
  const s = L[lang]
  const info = node.dungeonInfo
  return (
    <div className="relative">
      {info && (
        <ul className="mt-3 flex flex-wrap items-center gap-y-2 text-[0.875rem] leading-none [&>li]:flex [&>li]:items-center [&>li]:gap-1.5 [&>li]:border-[var(--border)] [&>li:not(:first-child)]:border-l [&>li:not(:first-child)]:pl-3 [&>li:not(:last-child)]:pr-3">
          <li>
            <span className="text-[#9c8b73]">{s.recommended}</span>
            <span className="font-[family-name:var(--font-title)] text-[1.375rem] text-[var(--gold-light)]">LV.{info.recommended || '??'}</span>
          </li>
          {info.ex.map((q, i) => (
            <li key={i}><span className="text-[#9c8b73]">EX</span><span className="break-keep text-[var(--text-primary)]">{text(q, lang)}</span></li>
          ))}
          {info.floors > 1 && <li className="text-[var(--text-secondary)]">{s.floorCount(info.floors)}</li>}
        </ul>
      )}
      {/* The game's dungeon card ([CanvasGroup]Dungeon): the entrance picture under its mask, the frame and the rail with
          the octagon; the whole card enters the dungeon (the site has no separate enter button) */}
      <DungeonCard src={info?.illust ? `${base}/dungeon/${node.dungeon}/illust.webp` : null} base={base} label={`${s.enterDungeon} ${node.label}`} onEnter={onEnter} />
    </div>
  )
}

// StageInfoUIRenewal2 [CanvasGroup]Dungeon (sharedassets2): rects in canvas units, x from the centre, y up from the
// parent's bottom, each a Simple Image with preserveAspect: the sprite fitted in its rect toward its pivot (0.5, 0).
const CARD = {
  mask: { w: 866.9, h: 363.01, y: 73.4, sprite: 'MainUI_MainStage_2_7', aspect: 892 / 362 },
  frame: { w: 903.9, h: 496, y: 49.8, sprite: 'MainUI_MainStage_2_4', aspect: 950 / 428 },
  rail: { w: 860.9, h: 254.15, y: -14.7, sprite: 'MainUI_MainStage_2_0', aspect: 903 / 219 },
}
// [Image]Illust (1) under the mask: stretched over the mask's rect plus (104.71, 42.49), its centre moved by
// (-18.38, 45.9), the picture fitted about its centre (preserveAspect, pivot 0.5)
const ILLUST = { grow: [104.71, 42.49], off: [-18.38, 45.9] }
const fitRect = (r: { w: number; h: number; y: number; aspect: number }) => (r.aspect > r.w / r.h ? { w: r.w, h: r.w / r.aspect, y: r.y } : { w: r.h * r.aspect, h: r.h, y: r.y })

function DungeonCard({ src, base, label, onEnter }: { src: string | null; base: string; label: string; onEnter: () => void }) {
  const [aspect, setAspect] = useState(1230 / 546)
  const parts = { mask: fitRect(CARD.mask), frame: fitRect(CARD.frame), rail: fitRect(CARD.rail) }
  const all = Object.values(parts)
  const W = Math.max(...all.map(r => r.w)), top = Math.max(...all.map(r => r.y + r.h)), bottom = Math.min(...all.map(r => r.y)), H = top - bottom
  const place = (r: { w: number; h: number; y: number }): React.CSSProperties => ({ left: `${((W - r.w) / 2 / W) * 100}%`, top: `${((top - r.y - r.h) / H) * 100}%`, width: `${(r.w / W) * 100}%`, height: `${(r.h / H) * 100}%` })
  // the picture inside the drawn mask, in the mask's own percentages
  const m = parts.mask
  const ir = { w: CARD.mask.w + ILLUST.grow[0], h: CARD.mask.h + ILLUST.grow[1] }
  const iw = ir.w / ir.h > aspect ? ir.h * aspect : ir.w, ih = ir.w / ir.h > aspect ? ir.h : ir.w / aspect
  const icx = ILLUST.off[0], icy = CARD.mask.y + CARD.mask.h / 2 + ILLUST.off[1]
  const illustStyle: React.CSSProperties = {
    left: `${((icx - iw / 2 + m.w / 2) / m.w) * 100}%`, top: `${((m.y + m.h - (icy + ih / 2)) / m.h) * 100}%`,
    width: `${(iw / m.w) * 100}%`, height: `${(ih / m.h) * 100}%`,
  }
  const sprite = (n: string) => `${base}/ui/s/${n}.webp`
  return (
    <button type="button" onClick={onEnter} aria-label={label} title={label}
      className="group relative mt-4 block w-full transition-[filter] duration-200 hover:[filter:drop-shadow(0_0_10px_#ff9a00a0)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--gold)]"
      style={{ aspectRatio: `${W} / ${H}` }}>
      <span className="absolute overflow-hidden" style={{ ...place(m), maskImage: `url(${sprite(CARD.mask.sprite)})`, WebkitMaskImage: `url(${sprite(CARD.mask.sprite)})`, maskSize: '100% 100%', WebkitMaskSize: '100% 100%' }}>
        {src && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt="" className="absolute max-w-none" style={illustStyle} onLoad={e => { const im = e.currentTarget; if (im.naturalHeight) setAspect(im.naturalWidth / im.naturalHeight) }} />
        )}
      </span>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={sprite(CARD.frame.sprite)} alt="" className="pointer-events-none absolute max-w-none" style={place(parts.frame)} />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={sprite(CARD.rail.sprite)} alt="" className="pointer-events-none absolute max-w-none" style={place(parts.rail)} />
    </button>
  )
}

/** The picked stage, built from the game's own stage info pieces: its see-through plate (info-plate, fading into the
 * map on the left), the inner bronze frame for the stage facts (info-frame) and the portrait frame of every enemy
 * (enemy-frame). The title band keeps the stage's card picture behind its number. */
export function StagePanel({ node, sub, base, lang, spoiler, onClose, note, action, story }: {
  node: StoryNode; sub: StorySubchapter; base: string; lang: Lang; spoiler: boolean; onClose: () => void
  /** Shown instead of the story-stage line when there is no battle (dungeon rooms) */
  note?: string
  /** Under the title: the button into a dungeon */
  action?: React.ReactNode
  /** A dungeon room's story (the game's room panel 스토리 text) */
  story?: Texts
}) {
  const s = L[lang]
  // Past the reader's progress: no picture, no title, no enemies.
  const b = spoiler ? undefined : node.battle
  const eff = effective(node, sub)
  const [wave, setWave] = useState(0)
  // Bosses and named characters stay behind ? until the reader asks for them (VIEWER, USER 2026-11-08)
  const [shown, setShown] = useState<Set<string>>(() => new Set())
  const veiled = (id: string) => !sub.enemies[id]?.mob && !shown.has(id)
  const unveil = (id: string) => setShown(v => new Set(v).add(id))
  const units = b?.waves[wave] ?? []
  return (
    // As in the game: see-through black over a blurred map, a plain edge on the map side. (A mask on top of
    // backdrop-filter makes Chrome drop the whole panel.)
    <aside className="story-panel-in absolute inset-x-0 bottom-0 max-h-[60%] overflow-y-auto overscroll-contain border-t border-[var(--border)] bg-black/80 px-4 pb-6 pt-4 backdrop-blur-md @3xl:inset-x-auto @3xl:bottom-0 @3xl:right-0 @3xl:top-0 @3xl:max-h-none @3xl:w-[min(32rem,46cqw)] @3xl:border-l @3xl:border-t-0 @3xl:px-8 @3xl:py-6">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`${base}/ui/s/${node.tag}.webp`} alt="" aria-hidden className="pointer-events-none absolute bottom-10 right-10 w-44 opacity-[0.08]" />
      <button type="button" onClick={onClose} aria-label={s.close}
        className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-sm text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--gold)] @3xl:right-6 @3xl:top-5"><X size={20} /></button>

      <header className="relative -mx-2 overflow-hidden px-2 pb-3 pt-2">
        {node.cg && !spoiler && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={`${base}/cg/${node.id}.webp`} alt="" aria-hidden className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-30 [mask-image:linear-gradient(90deg,transparent,#000_30%,#000_70%,transparent)]" />
        )}
        <div className="relative flex items-end gap-3 border-b border-[#5a4526] pb-2 pr-10">
          <span className="shrink-0 whitespace-nowrap font-[family-name:var(--font-title)] text-[3.25rem] leading-[0.85] text-[#f3e4cb] @3xl:text-[3.75rem]">{node.label}</span>
          <h2 className="min-w-0 break-keep pb-0.5 font-[family-name:var(--font-heading)] text-[1.5rem] leading-tight text-[#f3e4cb] @3xl:text-[1.75rem]">{spoiler ? '???' : text(node.title, lang)}</h2>
        </div>
      </header>

      {!spoiler && action}
      {!spoiler && story && text(story, lang) && (
        <p className="relative mt-3 break-keep text-[0.9375rem] leading-relaxed text-[#cfc3ad]">{text(story, lang)}</p>
      )}
      {!spoiler && node.endings ? (
        <Endings endings={node.endings} sub={sub} base={base} lang={lang} veiled={veiled} unveil={unveil} />
      ) : !b ? (
        !(action && !spoiler) && <p className="relative mt-5 text-[0.9375rem] text-[var(--text-secondary)]">{spoiler ? s.spoiler : note ?? s.storyOnly}</p>
      ) : (
        <div className="relative">
          {/* The info line of the site's game info windows (DESIGN.md 5): items side by side, split by a --border
              line, no box or chip. */}
          <ul className="mt-3 flex flex-wrap items-center gap-y-2 text-[0.875rem] leading-none [&>li]:flex [&>li]:items-center [&>li]:gap-1.5 [&>li]:border-[var(--border)] [&>li:not(:first-child)]:border-l [&>li:not(:first-child)]:pl-3 [&>li:not(:last-child)]:pr-3">
            <li>
              <span className="text-[#9c8b73]">{s.recommended}</span>
              {/* 0 in the data: the game prints LV.?? */}
              <span className="font-[family-name:var(--font-title)] text-[1.375rem] text-[var(--gold-light)]">LV.{b.recommended || '??'}</span>
            </li>
            {eff.atk.length + eff.sin.length > 0 && (
              <li>
                <span className="text-[#9c8b73]">{s.effective}</span>
                {eff.atk.map(e => (
                  <span key={e.key} className="flex items-center gap-1 text-[var(--text-primary)]"><AttackTypeIcon type={e.icon} className="h-5 w-5" />{s.atk[e.icon]}</span>
                ))}
                {eff.sin.map(e => (
                  <span key={e.key} className="flex items-center gap-1 text-[var(--text-primary)]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={SIN_ICON_MAP[e.sin]} alt="" className="h-5 w-5 object-contain" />{s.sin[e.sin]}
                  </span>
                ))}
              </li>
            )}
            {b.ex?.map((q, i) => (
              <li key={i}>
                <span className="text-[#9c8b73]">EX</span>
                <span className="break-keep text-[var(--text-primary)]">{text(q, lang)}</span>
              </li>
            ))}
            {b.boss && <li className="text-[#ec6a5e]">{s.boss}</li>}
            {/* 99 turns = no limit in the data */}
            {b.turnLimit != null && b.turnLimit < 99 && <li className="text-[var(--text-secondary)]">{s.turnLimit(b.turnLimit)}</li>}
          </ul>

          {/* Section title of the site's info windows: the title, a --border line to the right edge, controls at the end. */}
          <div className="mt-6 flex items-center gap-3">
            <h3 className="shrink-0 font-[family-name:var(--font-heading)] text-[1.125rem] leading-none text-[var(--text-primary)]">{s.enemies}</h3>
            <span aria-hidden className="h-px flex-1 bg-[var(--border)]" />
            {b.waves.length > 1 && (
              // Waves: bare Bebas numbers at the end of the title line, the shown one in gold.
              <div role="tablist" aria-label={s.enemies} className="-my-2 flex shrink-0">
                {b.waves.map((_, w) => (
                  <button key={w} type="button" role="tab" aria-selected={w === wave} aria-label={s.wave(w + 1)} onClick={() => setWave(w)}
                    className={`flex h-9 min-w-9 items-center justify-center font-[family-name:var(--font-title)] text-[1.375rem] leading-none transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--gold)] ${w === wave ? 'text-[var(--gold-light)]' : 'text-[#94887a] hover:text-[var(--text-primary)]'}`}>
                    {w + 1}
                  </button>
                ))}
              </div>
            )}
          </div>
          <ul key={wave} className="mt-3 grid grid-cols-3 gap-x-3 gap-y-4 @min-[40rem]:grid-cols-4 @3xl:grid-cols-3">
            {units.map((u, j) => {
              return <EnemyCard key={j} u={u} j={j} sub={sub} base={base} lang={lang} veil={veiled(String(u.id))} onReveal={() => unveil(String(u.id))} />
            })}
          </ul>
        </div>
      )}

    </aside>
  )
}

/** One enemy: the game's enemy info card, a head crop of the unit portrait inside its bronze portrait frame. A spoiler
 * card is a button that shows the face. */
function EnemyCard({ u, j, sub, base, lang, veil, onReveal }: {
  u: StoryUnit; j: number; sub: StorySubchapter; base: string; lang: Lang; veil: boolean; onReveal: () => void
}) {
  const s = L[lang]
  const e = sub.enemies[String(u.id)]
  const name = veil ? '???' : text(e?.name, lang) || '???'
  return (
    <li className="story-rise group min-w-0" style={{ '--i': j } as React.CSSProperties}>
      <div className={`relative aspect-[279/361] ${u.hidden ? 'opacity-60' : ''}`}>
        {veil && <button type="button" onClick={onReveal} aria-label={s.reveal} className="absolute inset-0 z-10 cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--gold)]" />}
        <div className="absolute inset-[5%] overflow-hidden bg-[radial-gradient(circle_at_50%_30%,#2e261d,#0f0c08)]">
          {e?.portrait && !veil
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={`${base}/portrait/${e.portrait}.webp`} alt="" loading="lazy" className="absolute left-1/2 top-[-4%] h-[170%] w-auto max-w-none -translate-x-1/2 transition-transform duration-300 group-hover:scale-[1.04]" />
            : <span className="flex h-full items-center justify-center font-[family-name:var(--font-title)] text-[2rem] text-[#5a4526]">?</span>}
          <span className="absolute inset-x-0 bottom-0 h-1/3 bg-[linear-gradient(transparent,#0b0906)]" aria-hidden />
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`${base}/ui/enemy-frame.webp`} alt="" aria-hidden className="pointer-events-none absolute inset-0 h-full w-full" />
        {u.count > 1 && (
          <span className="absolute -right-1 -top-1 bg-[#8a0b0b] px-1.5 py-0.5 font-[family-name:var(--font-title)] text-[1.0625rem] leading-none text-[#f3e4cb] shadow-[0_1px_3px_#000]">×{u.count}</span>
        )}
      </div>
      <p className="mt-1.5 line-clamp-2 break-keep text-center font-[family-name:var(--font-heading)] text-[0.8125rem] leading-[1.4] text-[var(--text-primary)]" title={u.hidden ? `${name} (${s.hidden})` : name}>{name}</p>
      {e?.desc && !veil && <p className="truncate text-center text-[0.6875rem] leading-[1.4] text-[#94887a]">{text(e.desc, lang)}</p>}
    </li>
  )
}

/** A floor's battles; the same enemies on one floor shown once (VIEWER). */
function battlesOf(battles: NonNullable<StoryNode['endings']>[number]['floors'][number]['battles']) {
  const seen = new Set<string>()
  return battles.filter(bt => {
    const k = bt.waves.map(w => w.map(u => `${u.id}x${u.count}`).join('+')).join('|')
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })
}

/** 10장 시지프 백화점: the store is walked in RPG mode (not drawn here); its battles, by ending and floor. */
function Endings({ endings, sub, base, lang, veiled, unveil }: {
  endings: NonNullable<StoryNode['endings']>; sub: StorySubchapter; base: string; lang: Lang
  veiled: (id: string) => boolean; unveil: (id: string) => void
}) {
  const s = L[lang]
  const [pick, setPick] = useState(0)
  const ending = endings[pick] ?? endings[0]
  return (
    <div className="relative">
      <p className="mt-3 break-keep text-[0.9375rem] leading-relaxed text-[#cfc3ad]">{s.endingNote}</p>
      <div className="mt-6 flex items-center gap-3">
        <h3 className="shrink-0 font-[family-name:var(--font-heading)] text-[1.125rem] leading-none text-[var(--text-primary)]">{s.ending}</h3>
        <span aria-hidden className="h-px flex-1 bg-[var(--border)]" />
        <div role="tablist" aria-label={s.ending} className="-my-2 flex shrink-0">
          {endings.map((e, i) => (
            <button key={e.key} type="button" role="tab" aria-selected={i === pick} aria-label={`${s.ending} ${e.key}`} onClick={() => setPick(i)}
              className={`flex h-9 min-w-9 items-center justify-center font-[family-name:var(--font-title)] text-[1.375rem] leading-none transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--gold)] ${i === pick ? 'text-[var(--gold-light)]' : 'text-[#94887a] hover:text-[var(--text-primary)]'}`}>
              {e.key}
            </button>
          ))}
        </div>
      </div>
      <div key={ending.key} role="tabpanel" className="story-panel-in">
        {ending.floors.map((f, fi) => (
          <section key={fi} className="mt-5">
            {f.floor ? <h4 className="font-[family-name:var(--font-title)] text-[1.75rem] leading-none text-[var(--gold-light)]">{f.floor}</h4>
              : <h4 className="font-[family-name:var(--font-heading)] text-[1.125rem] leading-none text-[var(--gold-light)]">{s.otherFloor}</h4>}
            <ol className="mt-2 space-y-4">
              {battlesOf(f.battles).map(bt => (
                <li key={bt.id} className="flex gap-3">
                  <span className="w-12 shrink-0 pt-1 font-[family-name:var(--font-title)] text-[1.125rem] leading-none text-[#9c8b73]">LV.{bt.recommended || bt.level || '??'}</span>
                  <ul className="grid flex-1 grid-cols-4 gap-x-2.5 gap-y-3 @min-[40rem]:grid-cols-5 @3xl:grid-cols-4">
                    {bt.waves.flat().map((u, j) => (
                      <EnemyCard key={j} u={u} j={j} sub={sub} base={base} lang={lang} veil={veiled(String(u.id))} onReveal={() => unveil(String(u.id))} />
                    ))}
                  </ul>
                </li>
              ))}
            </ol>
          </section>
        ))}
      </div>
    </div>
  )
}

/** The game's top-left back button: back_frame around a dark plate and the striped icon_back arrow; back_hover on hover. */
export function BackButton({ href, base, label, onClick }: { href?: string; base: string; label: string; onClick?: () => void }) {
  const Tag = onClick ? 'button' : Link
  return (
    <Tag href={(onClick ? undefined : href ?? '') as string} type={onClick ? 'button' : undefined} onClick={onClick} aria-label={label} title={label}
      className="story-back group pointer-events-auto relative block h-[3.25rem] w-[5.75rem] shrink-0 @3xl:h-[3.75rem] @3xl:w-[6.625rem]">
      <span className="absolute inset-[9%_6%] bg-[#0b0906] [clip-path:polygon(4%_0,96%_0,100%_12%,100%_88%,96%_100%,4%_100%,0_88%,0_12%)]" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`${base}/ui/back-icon.webp`} alt="" className="absolute left-1/2 top-1/2 h-[48%] -translate-x-1/2 -translate-y-1/2" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`${base}/ui/back-frame.webp`} alt="" className="absolute inset-0 h-full w-full" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`${base}/ui/back-hover.webp`} alt="" className="absolute inset-0 h-full w-full opacity-0 mix-blend-screen transition-opacity group-hover:opacity-60 group-focus-visible:opacity-60" />
    </Tag>
  )
}

/** A chapter after the reader's progress, reached by a link: the map stays dark behind a notice until the reader opens
 * it here (the same as picking it on the chapter list). */
function SpoilerGate({ lang, onOpen }: { lang: Lang; onOpen: () => void }) {
  const s = L[lang]
  return (
    <div role="dialog" aria-modal="true" aria-labelledby="story-spoiler-title"
      className="story-spoiler-in absolute inset-0 z-30 flex items-center justify-center bg-black/80 px-6 backdrop-blur-md">
      <div className="flex max-w-[30rem] flex-col items-center text-center [text-shadow:0_1px_10px_#000]">
        <svg aria-hidden viewBox="0 0 24 24" className="h-10 w-10 text-[#e2483d]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round">
          <path d="M12 3.5 22 20.5H2Z" />
          <path d="M12 10v5" strokeLinecap="round" />
          <circle cx="12" cy="17.6" r="0.4" fill="currentColor" />
        </svg>
        <h2 id="story-spoiler-title" className="mt-3 font-[family-name:var(--font-heading)] text-[2rem] leading-tight text-[#e2483d]">{s.spoilerTitle}</h2>
        <p className="mt-3 break-keep text-[1rem] leading-[1.6] text-[#d8ccb6]">{s.spoilerBody}</p>
        <div className="mt-7 flex items-center gap-3">
          <Link href={`/${lang}/story`}
            className="flex h-11 items-center rounded-sm px-5 font-[family-name:var(--font-heading)] text-[1rem] text-[var(--text-secondary)] transition-colors hover:text-[#f3e4cb] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--gold)]">{s.back}</Link>
          <button type="button" onClick={onOpen} autoFocus
            className="flex h-11 items-center rounded-[3px] border-2 border-[#3a0b0b] bg-[#a8201b] px-6 font-[family-name:var(--font-heading)] text-[1.0625rem] text-[#f3e4cb] shadow-[0_2px_0_#000] transition-colors hover:bg-[#c2302b] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--gold)]">{s.openAnyway}</button>
        </div>
      </div>
    </div>
  )
}

/** What a chapter page shows before its map: the page reads ?stage= etc. (nuqs), which the server cannot know for a
 * cached page, so the map is drawn in the browser. Until then this covers the site's nav and footer at once. */
export function StoryShell({ lang, base }: { lang: Lang; base: string }) {
  useFullScreen()
  return (
    <div className="story-landscape [container-type:size] fixed inset-0 z-[60] overflow-hidden bg-black">
      <div className="absolute left-0 top-0 flex items-center gap-3 px-3 pt-3 @3xl:px-6">
        <BackButton href={`/${lang}/story`} base={base} label={L[lang].back} />
      </div>
    </div>
  )
}

/** The story screens cover the whole window: nav and footer hidden, the page under them still (story.css). */
export function useFullScreen() {
  useHtmlFlag('with-story')
  useTurnedTouchScroll()
}

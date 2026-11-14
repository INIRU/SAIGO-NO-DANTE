'use client'

import { useTurnedTouchScroll } from '@/features/story/hooks/useTurnedTouchScroll'
import FullscreenGate from './FullscreenGate'
import { useEffect, useRef, useState } from 'react'
import { parseAsInteger, useQueryStates } from 'nuqs'
import Link from 'next/link'
import { useHtmlFlag } from '@/hooks/useHtmlFlag'
import '../story.css'
import { ArrowUp } from 'lucide-react'
import type { StoryNode, StorySubchapter } from '@/lib/story-map'
import StoryMap from './StoryMap'
import { useStoryProgress } from '@/features/story/hooks/useStoryProgress'
import DungeonView from './DungeonView'
import BackButton from './BackButton'
import StagePanel from './StagePanel'
import { MAP_COPY as L, isHiddenChapter, mapText as text, type Lang } from '@/features/story'

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
      {/* USER 2026-11-11: nothing said the card is the way into the dungeon map */}
      <button type="button" onClick={onEnter} className="mx-auto mt-1 flex items-center gap-1 px-2 py-1 text-[0.75rem] leading-none text-[var(--text-secondary)]">
        <ArrowUp size={12} aria-hidden />{s.dungeonMap}
      </button>
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
export function StoryShell({ lang, base, id, number, cover }: { lang: Lang; base: string; id: number; number: string; cover: boolean }) {
  useFullScreen()
  const s = L[lang]
  return (
    <div className="story-landscape [container-type:size] fixed inset-0 z-[60] overflow-hidden bg-black">
      {/* the chapter's own picture from the chapter list, blurred and dark (the reader's progress is not known yet, so it
          gives nothing away); the chapter number only, its title may be a spoiler */}
      {cover && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={`${base}/cover/${id}.webp`} alt="" aria-hidden className="story-bg-in absolute inset-0 h-full w-full object-cover blur-xl brightness-[.35]" />
      )}
      <div className="absolute left-0 top-0 flex items-center gap-3 px-3 pt-3 @3xl:px-6">
        <BackButton href={`/${lang}/story`} base={base} label={s.back} />
        <div className="story-title font-[family-name:var(--font-heading)] text-[1.5rem] text-[var(--gold)] [text-shadow:0_1px_3px_#000,0_0_8px_#000] @3xl:text-[1.875rem]">{s.chapterName(number)}</div>
      </div>
      <div role="status" className="absolute inset-0 flex flex-col items-center justify-center gap-4">
        {/* the game's bus that marks the current stage */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`${base}/ui/train.webp`} alt="" aria-hidden className="h-16 w-auto motion-safe:animate-pulse" />
        <p className="font-[family-name:var(--font-heading)] text-[1rem] text-[#d8ccb6] [text-shadow:0_1px_6px_#000]">{s.loading}</p>
      </div>
    </div>
  )
}

/** The story screens cover the whole window: nav and footer hidden, the page under them still (story.css). */
export function useFullScreen() {
  useHtmlFlag('with-story')
  useTurnedTouchScroll()
}

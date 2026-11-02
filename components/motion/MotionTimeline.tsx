'use client'

import { memo } from 'react'
import { useMotionFrame, type MotionChapter, type MotionFrameStore, type MotionMark } from '@/hooks/useSkillMotion'

/** The track's pieces: one per chapter, the first reaching back to frame 0; the whole track without chapters. */
export function chapterSpans(chapters: readonly MotionChapter[], frames: number): { from: number; to: number }[] {
  const starts = [...new Set(chapters.map(chapter => chapter.f))].filter(f => f > 0 && f < frames).sort((a, b) => a - b)
  return [0, ...starts].map((from, k, all) => ({ from, to: all[k + 1] ?? frames }))
}

/** The chapter a frame is in. */
export const currentChapter = (chapters: readonly MotionChapter[], frame: number) => chapters.findLast(chapter => chapter.f <= frame)

const kindOf = (mark: MotionMark) => mark.kill ? 'kill' : mark.kind === 'hit' && mark.critical ? 'critical' : mark.kind
const MARK_STYLE = { hit: 'h-2 bg-[var(--text-tertiary)]', critical: 'h-3 bg-[var(--gold-light)]', kill: 'h-3 bg-[var(--error-text)]', voice: 'h-1.5 bg-[var(--text-muted)]' }

function Pieces({ spans, frames, gold }: { spans: { from: number; to: number }[]; frames: number; gold?: boolean }) {
  return spans.map(({ from, to }) => <span key={from} className={`absolute inset-y-0 rounded-full ${gold ? 'bg-[var(--gold)]' : 'bg-[var(--border)]'}`} style={{ left: `${(from / frames) * 100}%`, right: `calc(${100 - (to / frames) * 100}% + ${to < frames ? '0.1875rem' : '0rem'})` }} />)
}

/** What does not change while playing: the empty track and the marks standing on it (the targets of one frame are one mark). */
const Rail = memo(function Rail({ spans, frames, marks }: { spans: { from: number; to: number }[]; frames: number; marks: readonly MotionMark[] }) {
  const stood = [...new Map(marks.map(mark => [`${mark.f}:${kindOf(mark)}`, mark])).values()]
  return (
    <>
      {stood.map(mark => {
        const kind = kindOf(mark)
        return <span key={`${mark.f}:${kind}`} data-mark={kind} className={`pointer-events-none absolute bottom-1/2 mb-[0.125rem] w-px -translate-x-1/2 ${MARK_STYLE[kind]}`} style={{ left: `${(mark.f / frames) * 100}%` }} />
      })}
      <span className="pointer-events-none absolute inset-x-0 top-1/2 h-1 -translate-y-1/2"><Pieces spans={spans} frames={frames} /></span>
    </>
  )
})

/**
 * The seek bar: the track cut at the chapters, the marks on it. A range input over it takes the mouse, the finger and the
 * keys; what changes every frame is only the gold copy's clip and the handle, kept out of the session replay.
 */
export default function MotionTimeline({ store, frames, chapters, marks, label, onSeek }: {
  store: MotionFrameStore; frames: number; chapters: readonly MotionChapter[]; marks: readonly MotionMark[]; label: string; onSeek: (frame: number) => void
}) {
  const frame = Math.max(0, useMotionFrame(store))
  const max = Math.max(0, frames - 1)
  const shown = Math.min(frame, max)
  const at = max ? (shown / max) * 100 : 0
  const spans = chapterSpans(chapters, Math.max(1, frames))
  return (
    <div className="group/seek relative h-10 min-w-0 flex-1 @max-md:order-first @max-md:basis-full @max-md:mx-2">
      {frames > 0 && <Rail spans={spans} frames={frames} marks={marks} />}
      <span data-sentry-block className="pointer-events-none absolute inset-x-0 top-1/2 h-1 -translate-y-1/2" style={{ clipPath: `inset(0 ${100 - at}% 0 0)` }}>
        <Pieces spans={spans} frames={Math.max(1, frames)} gold />
      </span>
      <input type="range" min={0} max={max} step={1} value={shown} aria-label={label} disabled={frames === 0} data-sentry-block
        onChange={event => onSeek(Number(event.target.value))}
        className="peer absolute inset-0 m-0 h-full w-full cursor-pointer opacity-0 disabled:cursor-default" />
      <span data-sentry-block className={`pointer-events-none absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--gold-light)] shadow-[0_0_0_3px_rgba(5,4,3,0.9)] transition-[scale] duration-150 group-hover/seek:scale-110 peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[var(--gold-light)] motion-reduce:transition-none ${frames === 0 ? 'opacity-40' : ''}`} style={{ left: `${at}%` }} />
    </div>
  )
}

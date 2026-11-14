'use client'

import FullscreenGate from './FullscreenGate'
import { useState } from 'react'
import type { StoryIndexEntry, Texts } from '@/lib/story-map'
import BackButton from './BackButton'
import { useFullScreen } from './StoryClient'
import { useStoryProgress } from '@/features/story/hooks/useStoryProgress'
import { isExtraPart, isHiddenChapter, storyOrder } from '@/features/story'

type Lang = 'ko' | 'en' | 'ja'

const L = {
  ko: { title: '스토리 맵', home: '홈으로', reveal: '눌러서 이 장 보기', spoiler: '스포일러에 주의하세요', chapter: (n: string) => `${n}장` },
  en: { title: 'Story Map', home: 'Home', reveal: 'Show this chapter', spoiler: 'Beware of spoilers', chapter: (n: string) => `Ch.${n}` },
  ja: { title: 'ストーリーマップ', home: 'ホームへ', reveal: 'この章を表示', spoiler: 'ネタバレにご注意ください', chapter: (n: string) => `${n}章` },
}

const text = (t: Texts | null | undefined, lang: Lang) => t?.[lang] ?? t?.ko ?? t?.en ?? ''

/** Chapter select: the chapters as the game's Drive cards in one column on the left; behind them the pointed chapter's
 * own stage map, where its first stage sits, crossfading as the pointer or focus moves down the list. */
export default function StorySelect({ lang, index, base }: { lang: Lang; index: StoryIndexEntry[]; base: string }) {
  useFullScreen()
  const s = L[lang]
  // Extra parts (10장's second subchapter) are reached from their chapter's map, not listed.
  const oldestFirst = storyOrder(index).filter(e => !isExtraPart(index, e))
  const order = oldestFirst.map(e => e.id)
  // The game's Drive list: newest on top, opened scrolled to the bottom where the story starts (chapter 0).
  // The last two backgrounds stay mounted so the new one fades in over the old one.
  const [progress, setProgress] = useStoryProgress()
  const hidden = (id: number) => isHiddenChapter(order, progress, id)
  // One step at a time: the opened chapters and, as ???, only the next one; the rest is not listed yet.
  const at = Math.max(0, order.indexOf(progress ?? -1))
  // Background and big title start on the furthest chapter opened; pointing at a card moves them.
  const [active, setActive] = useState<number>()
  const activeId = active ?? order[at]
  const [shown, setShown] = useState<number[]>([])
  const bgIds = shown.length ? shown : activeId != null ? [activeId] : []
  const list = oldestFirst.slice(0, at + 2).reverse()
  const point = (id: number) => {
    setActive(id)
    setShown(ids => ids[ids.length - 1] === id ? ids : [...ids.filter(x => x !== id).slice(-1), id])
  }
  const current = index.find(e => e.id === activeId)
  // The game files the intervals under the same part, so the header names the main chapters' part.
  const partTitle = text(index.find(e => e.part !== 91)?.partTitle, lang)
  return (
    // Full window like the game's Drive screen: nav and footer hidden (story.css), the back button leads home.
    <div className="story-landscape [container-type:size] fixed inset-0 overflow-hidden bg-black">
      <FullscreenGate lang={lang} />
      {bgIds.map(id => {
        const e = index.find(x => x.id === id)
        if (!e?.cover && !e?.coverImg) return null
        return (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={id} src={e.coverImg ? `${base}/cover/${e.id}.webp` : `${base}/map/${e.mapId}/${e.cover![0]}_${e.cover![1]}.webp`} alt="" aria-hidden
            className={`story-bg-in absolute inset-0 h-full w-full object-cover ${hidden(id) ? 'blur-xl brightness-50' : ''}`} />
        )
      })}
      {/* The list side stays dark enough to read; the map shows on the right. */}
      <div aria-hidden className="absolute inset-0 bg-[linear-gradient(90deg,#000_0%,#000d_30rem,#0006_62%,#0003)]" />

      {/* Spoiler notice: the chapter tabs' red (#c2302b), lifted to read on the dark map; a hairline leads in from the left */}
      <p role="note" className="pointer-events-none absolute right-4 top-[1.6rem] z-10 flex items-center gap-2 @3xl:right-10 @3xl:top-7 @3xl:gap-2.5 [text-shadow:0_1px_10px_#000,0_0_2px_#000]">
        <span aria-hidden className="hidden h-px w-14 bg-[linear-gradient(90deg,transparent,#e2483d)] @min-[40rem]:block" />
        <svg aria-hidden viewBox="0 0 24 24" className="h-[1.15em] w-[1.15em] shrink-0 text-[#e2483d] @3xl:text-[1.25rem]" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round">
          <path d="M12 3.5 22 20.5H2Z" />
          <path d="M12 10v5" strokeLinecap="round" />
          <circle cx="12" cy="17.6" r="0.4" fill="currentColor" />
        </svg>
        <span className="font-[family-name:var(--font-heading)] text-[1rem] leading-none tracking-[0.02em] text-[#e2483d] @3xl:text-[1.25rem]">{s.spoiler}</span>
      </p>

      {current && (
        <div aria-hidden key={current.id} className="story-panel-in pointer-events-none absolute bottom-10 right-10 hidden max-w-[40rem] text-right [text-shadow:0_2px_12px_#000] @3xl:block">
          <div className="font-[family-name:var(--font-heading)] text-[1.25rem] text-[var(--gold-light)]">{s.chapter(current.number)}</div>
          <div className="break-keep font-[family-name:var(--font-heading)] text-[3.5rem] leading-tight text-[#f3e4cb]">{hidden(current.id) ? '???' : text(current.title, lang)}</div>
          <div className="mt-1 text-[1rem] text-[#d8ccb6]">{`${text(current.company, lang)} ${text(current.area, lang)}`.trim()}</div>
        </div>
      )}

      <div className="relative flex h-full w-full flex-col @3xl:w-[30rem]">
        <div className="flex shrink-0 items-center gap-3 px-3 pb-4 pt-3 @3xl:px-6">
          <BackButton href={`/${lang}`} base={base} label={s.home} />
          <h1 className="font-[family-name:var(--font-heading)] text-[1.5rem] text-[var(--gold)] @3xl:text-[1.875rem]">{s.title}</h1>
        </div>
        {/* overflow-x hidden: the tilted tabs and the selected glow stick out of the cards and must not scroll the list
            sideways; the padding leaves them room. */}
        <ul className="min-h-0 flex-1 space-y-3 overflow-y-auto overflow-x-hidden overscroll-contain px-5 pb-10 pt-4 @3xl:px-7">
          {partTitle && (
            // The game's part header: the Drive ChapterTicket with the part's name (StagePartText: 지옥).
            <li className="story-ticket-in relative mb-5 aspect-[1000/323] w-full">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`${base}/ui/part-ticket.webp`} alt="" aria-hidden className="absolute inset-0 h-full w-full" />
              <h2 className="absolute bottom-[30%] right-[7%] font-[family-name:var(--font-heading)] text-[2.75rem] leading-[1.2] text-[#f3e4cb] [text-shadow:0_2px_4px_#000]">{partTitle}</h2>
            </li>
          )}
          {(() => {
            // the cards come in from the chapter in view (the one returned from, where the list is scrolled), not from the
            // top: a list scrolled to its bottom showed its last cards last; at most 6 steps of delay
            const from = Math.max(0, list.findIndex(e => e.id === activeId))
            const stagger = (i: number) => Math.min(Math.abs(i - from), 6)
            return list.map((e, i) => (
            <li key={e.id} className="story-ticket-in" style={{ '--i': stagger(i) } as React.CSSProperties}
              onPointerEnter={() => point(e.id)} onFocus={() => point(e.id)}>
              <ChapterCard entry={e} base={base} lang={lang} chapter={s.chapter(e.number)} active={e.id === activeId} hidden={hidden(e.id)}
                reveal={s.reveal} onReveal={() => setProgress(e.id)} />
            </li>
            ))
          })()}
        </ul>
      </div>
    </div>
  )
}

/** The game's Drive chapter card: the chapter picture in the LittleChapterTicket frame, the red TicketLabel tab with
 * the chapter number, the in-story date in red, the title at the bottom right. Intervals are narrower and sit right. */
function ChapterCard({ entry, base, lang, chapter, active, hidden, reveal, onReveal }: {
  entry: StoryIndexEntry; base: string; lang: Lang; chapter: string; active: boolean; hidden: boolean; reveal: string; onReveal: () => void
}) {
  return (
    // Spoilers: a chapter past the furthest one opened shows ???; the first click on it opens it here (and every
    // chapter before it), the next click goes in. A plain link (a full page load): the chapter pages are postponed in
    // the cache, and a client-side move into one sometimes got its RSC stream cut ("Connection closed", React #412).
    <a href={`/${lang}/story/${entry.id}`} aria-label={hidden ? reveal : undefined}
      onClick={hidden ? e => { e.preventDefault(); onReveal() } : undefined}
      // Narrow cards for the in-between stories (3.5, LC-PC …); a whole number is a chapter even when it is filed under
      // part 91 (9128 carries the rest of chapter 10).
      className={`group relative block aspect-[625/208] focus-visible:outline-none ${/^\d+$/.test(entry.number) ? 'w-full' : 'ml-auto w-[82%]'}`}>
      {/* The picture inside the frame's cut corners. */}
      <span className="absolute inset-[3%_1.6%] overflow-hidden bg-[var(--bg-panel)] [clip-path:polygon(3%_0,97%_0,100%_14%,100%_86%,97%_100%,3%_100%,0_86%,0_14%)]">
        {entry.illust && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={`${base}/illust/${entry.id}.webp`} alt="" loading="lazy" className={`h-full w-full object-cover group-hover:scale-[1.03] ${hidden ? 'scale-110 blur-md brightness-50' : ''} [transition:filter_.5s,transform_.3s]`} />
        )}
        <span aria-hidden className="absolute inset-0 bg-[linear-gradient(180deg,transparent_35%,#000b)]" />
      </span>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`${base}/ui/chapter-frame.webp`} alt="" aria-hidden className="pointer-events-none absolute inset-0 h-full w-full" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`${base}/ui/chapter-focus.webp`} alt="" aria-hidden
        className={`pointer-events-none absolute -inset-[1.5%] h-[103%] w-[103%] max-w-none transition-opacity duration-200 ${active ? 'opacity-100' : 'opacity-0 group-focus-visible:opacity-100'}`} />
      {/* The red tab, tilted as in the game, over the frame's top-left corner. */}
      <span className="absolute -left-[2%] -top-[9%] flex h-[24%] min-w-[26%] -rotate-[4deg] items-center justify-center bg-no-repeat px-[3%] [background-size:100%_100%]"
        style={{ backgroundImage: `url(${base}/ui/chapter-tab.webp)` }}>
        <span className="whitespace-nowrap font-[family-name:var(--font-heading)] text-[1rem] leading-none text-[#f3e4cb] [text-shadow:0_1px_1px_#000]">{chapter}</span>
      </span>
      {entry.timeline && (
        <span className="absolute right-[5%] top-[10%] font-[family-name:var(--font-title)] text-[1.125rem] leading-none text-[#e8302a] [text-shadow:0_1px_2px_#000]">{entry.timeline}</span>
      )}
      {/* No overflow clipping on the title: a clipping box cuts the tops of KOTRA's tall letters. Long titles wrap. */}
      <span className="absolute bottom-[8%] right-[5%] max-w-[85%] break-keep text-right font-[family-name:var(--font-heading)] text-[1.5rem] leading-[1.3] text-[#f3e4cb] [text-shadow:0_0_2px_#000,0_1px_3px_#000,0_0_8px_#000]">
        {hidden ? '???' : text(entry.title, lang)}
      </span>
    </a>
  )
}

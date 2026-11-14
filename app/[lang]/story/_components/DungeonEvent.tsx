'use client'

import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import type { DungeonEvent, DungeonEventGift, StorySubchapter } from '@/lib/story-map'
import GiftDetailModal from '@/features/mirror-dungeon/components/GiftDetailModal'
import BaseModal from '@/components/ui/BaseModal'
import { buttonClass } from '@/components/ui/Button'
import { isTouch } from '@/features/story/hooks/useTurnedTouchScroll'
import { CheckChain, CheckStep, Choices, Outcome, ResultBox, Rich, SectionTitle } from './DungeonEventOutcome'
import { GIFT_KEYWORD, L, giftArt, monitorText, nine, pickText, ui, type Ctx, type Lang, type Step } from '@/features/story'

/** The site's gift window for an event gift: the game's name and effect text. */
export function EventGiftModal({ id, g, base, lang, onClose }: { id: string; g: DungeonEventGift; base: string; lang: Lang; onClose: () => void }) {
  return (
    <GiftDetailModal lang={lang} onClose={onClose} zIndex={90} gift={{
      name: pickText(g.name, lang), art: giftArt(id, g, base, lang), keyword: g.keyword ? GIFT_KEYWORD[g.keyword] ?? null : null,
      effects: [pickText(g.desc, lang) || null, null, null],
    }} />
  )
}

/** The camera's running time on the monitor (00:MM:SS:cc), as the game's event window counts it from when it opens. */
function Timecode() {
  const [t, setT] = useState(0)
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const start = performance.now()
    const id = window.setInterval(() => setT(performance.now() - start), 50)
    return () => window.clearInterval(id)
  }, [])
  const cs = Math.floor(t / 10)
  const p = (n: number) => String(n).padStart(2, '0')
  return <>{`00:${p(Math.floor(cs / 6000) % 60)}:${p(Math.floor(cs / 100) % 60)}:${p(cs % 100)}`}</>
}

/** The event monitor: brass housing, the picture under the camera's corners / REC / time, the scene text on the scan lines. */
function Monitor({ picSrc, picKey, text }: { picSrc: string | null; picKey: number | null; text: string }) {
  return (
    <section className={`flex min-h-0 flex-col ${picSrc == null ? 'self-start' : ''}`} style={nine('housing', '90', '1.5rem')}>
      <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden bg-[#050403]">
        {picSrc != null && (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={picKey} src={picSrc} alt="" className="story-panel-in aspect-[16/9] w-full shrink-0 object-cover [mask-image:linear-gradient(#000_78%,transparent)]" />
        )}
        {/* the camera's frame over the whole screen */}
        <div aria-hidden className="pointer-events-none absolute inset-3 z-10">
          {(['tl', 'tr', 'bl', 'br'] as const).map(c => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={c} src={ui(`corner-${c}`)} alt="" className={`absolute h-7 w-7 object-contain opacity-80 ${c[0] === 't' ? 'top-0' : 'bottom-0'} ${c[1] === 'l' ? 'left-0' : 'right-0'}`} />
          ))}
          <span className="absolute left-9 top-3.5 font-[family-name:var(--font-body)] text-[0.8125rem] tabular-nums tracking-[0.06em] text-[#e8e2d6] [text-shadow:0_1px_2px_#000]"><Timecode /></span>
          <span className="absolute right-9 top-4 flex items-center gap-1.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={ui('rec-dot')} alt="" className="h-2 w-2 motion-safe:animate-[event-rec_1.2s_steps(1)_infinite]" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={ui('rec')} alt="" className="h-3 w-auto opacity-90" />
          </span>
        </div>
        <div className="relative min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain bg-[length:100%_100%] px-7 pb-12 pt-4"
          style={{ backgroundImage: `url(${ui('scan')})` }}>
          <p key={text} className="story-panel-in whitespace-pre-line break-keep font-[family-name:var(--font-game-text)] text-[0.9375rem] leading-[1.85] text-[#efe6d6] [text-shadow:0_1px_2px_#000]"><Rich text={text} /></p>
        </div>
      </div>
    </section>
  )
}

/**
 * An EVENT room as the game's event window, full screen: on the left the event picture (ChoiceEvent_<id>) over the
 * scene text; on the right the options, each with what it can give at a glance, and the picked one's results in full.
 * "이야기 보기" follows the story as the game tells it, step by step; back steps out.
 */
export default function DungeonEventWindow({ events, gifts, pics, first, title, lang, sub, base, onClose }: {
  events: Record<string, DungeonEvent>; gifts?: Record<string, DungeonEventGift>; pics?: number[]; first: number; title: string
  lang: Lang; sub: StorySubchapter; base: string; onClose: () => void
}) {
  const s = L[lang]
  const [gift, setGift] = useState<string | null>(null)
  // phones take the half-size event picture (event/h); set after mount, so a server-drawn window matches at first
  // (null until then: no full-size picture is fetched first on a phone)
  const [small, setSmall] = useState<string | null>(null)
  useEffect(() => { setSmall(isTouch() ? 'h/' : '') }, [])
  const [steps, setSteps] = useState<Step[]>([{ t: 'event', id: first }])
  if (!events[String(first)]) return null
  const ctx: Ctx = { events, gifts: gifts ?? {}, lang, sub, base, openGift: setGift, go: st => setSteps(v => [...v, st]) }
  const g = gift ? ctx.gifts[gift] : null
  const step = steps[steps.length - 1]
  // the picture: the latest event on the way that has one
  const picId = [...steps].reverse().map(st => st.id).find(i => pics?.includes(i)) ?? null
  // the monitor's text: this step's, else the last one on the way that has some
  const text = [...steps].reverse().map(st => monitorText(st, ctx)).find(Boolean) ?? ''
  return (
    <>
      <BaseModal open onClose={onClose} title={title || s.title} maxWidth="min(120rem,98cqw)" zIndex={80}>
        <div className="flex h-[96cqh] flex-col bg-[var(--bg-deep)]">
          <div className="flex shrink-0 items-center gap-2 border-b border-[var(--border)] px-3 py-2">
            {steps.length > 1
              ? <button type="button" onClick={() => setSteps(v => v.slice(0, -1))} aria-label={s.back} className={buttonClass({ variant: 'ghost', iconOnly: true })}><ChevronLeft size={20} /></button>
              : <span className="w-11" />}
            <h2 className="min-w-0 flex-1 truncate text-center font-[family-name:var(--font-heading)] text-[1.25rem] leading-none text-[var(--text-primary)]">{title}</h2>
            <button type="button" onClick={onClose} aria-label={s.close} className={buttonClass({ variant: 'ghost', iconOnly: true })}><X size={20} /></button>
          </div>
          <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] gap-5 overflow-hidden p-4 @5xl:gap-8 @5xl:p-6">
            <Monitor picSrc={picId != null && small != null ? `${base}/event/${small}${picId}.webp` : null} picKey={picId} text={text} />
            <section key={steps.length} className="story-panel-in min-h-0 overflow-y-auto overflow-x-hidden overscroll-contain py-1 pl-3 pr-2">
              <Side step={step} ctx={ctx} />
            </section>
          </div>
        </div>
      </BaseModal>
      {g && gift && <EventGiftModal id={gift} g={g} base={base} lang={lang} onClose={() => setGift(null)} />}
    </>
  )
}

function Side({ step, ctx }: { step: Step; ctx: Ctx }) {
  const s = L[ctx.lang]
  const ev = ctx.events[String(step.id)]
  if (!ev) return null
  if (step.t === 'event' && ev.kind === 'choice') return <Choices ev={ev} ctx={ctx} />
  if (step.t === 'event' && ev.kind === 'check') return (
    <>
      <SectionTitle aside={
        <button type="button" onClick={() => ctx.go({ t: 'judge', id: ev.id })} className={buttonClass({ variant: 'ghost', size: 'sm' })}>
          {s.story}<ChevronRight size={16} aria-hidden />
        </button>
      }>{s.check}</SectionTitle>
      <CheckChain first={ev} ctx={ctx} seen={new Set()} boxed />
    </>
  )
  if (step.t === 'judge' && ev.kind === 'check') return <CheckStep ev={ev} ctx={ctx} />
  if (step.t === 'option' && ev.kind === 'choice') {
    const o = ev.options[step.idx]
    return (
      <>
        <SectionTitle>{s.result}</SectionTitle>
        {/* the picked option on its plate, as the game's result screen shows it */}
        <p className="mt-3 flex min-h-[4.25rem] items-center break-keep px-4 py-1.5 font-[family-name:var(--font-heading)] text-[1.125rem] leading-snug text-[#f6ead6]"
          style={nine('option', '45', '0.875rem')}><Rich text={pickText(o.text, ctx.lang)} /></p>
        <ResultBox className="mt-4"><Outcome results={o.results} ctx={ctx} seen={new Set([ev.id])} story /></ResultBox>
      </>
    )
  }
  if (step.t === 'outcome' && ev.kind === 'check') {
    const side = step.side === 'success' ? ev.success : ev.failure
    return (
      <>
        <SectionTitle>{s.result}</SectionTitle>
        <p className={`mt-3 flex min-h-[4.25rem] items-center px-4 py-1.5 font-[family-name:var(--font-heading)] text-[1.375rem] leading-none ${step.side === 'success' ? 'text-[var(--gold-light)]' : 'text-[var(--error-text)]'}`}
          style={nine('option', '45', '0.875rem')}>
          {step.side === 'success' ? s.success : s.fail}
        </p>
        <ResultBox className="mt-4"><Outcome results={side.results} ctx={ctx} seen={new Set([ev.id])} story /></ResultBox>
      </>
    )
  }
  return null
}


'use client'

import { useMemo, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import type { DungeonEvent, DungeonEventGift, DungeonEventResult, Texts } from '@/lib/story-map'
import GiftCard from '@/features/mirror-dungeon/components/GiftCard'
import { EventGiftModal, giftArt } from './DungeonEvent'

type Lang = 'ko' | 'en' | 'ja'
const pickText = (t: Texts | null | undefined, lang: Lang) => t?.[lang] ?? t?.ko ?? t?.en ?? ''
const L = { ko: { title: '획득 가능 기프트', count: (n: number) => `최대 ${n}개` }, en: { title: 'Obtainable gifts', count: (n: number) => `Up to ${n}` },
  ja: { title: '獲得可能なギフト', count: (n: number) => `最大${n}個` } }

type Tally = Map<string, number>
const maxInto = (into: Tally, m: Tally) => { for (const [k, v] of m) into.set(k, Math.max(into.get(k) ?? 0, v)) }

/**
 * The most of each gift a dungeon's events can give: in one event, the best branch for that gift (options and results
 * are alternatives; a check's success or failure; what follows adds on), summed over its EVENT rooms. A gift effect
 * gives itemReward.num (1 when unset); destroying or losing one does not count.
 */
export function giftTally(events: Record<string, DungeonEvent>, firsts: number[]): Tally {
  const ofResults = (rs: DungeonEventResult[], seen: Set<number>): Tally => {
    const out: Tally = new Map()
    for (const r of rs) {
      const m: Tally = new Map()
      for (const f of r.effects ?? []) {
        const rw = f.itemReward as { type?: string; rewardId?: number; num?: number } | undefined
        if (rw?.type !== 'EGO_GIFT' || rw.rewardId == null || /^(Destroy|Lose)/.test(f.resultEffect ?? '')) continue
        m.set(String(rw.rewardId), (m.get(String(rw.rewardId)) ?? 0) + Math.max(1, rw.num ?? 1))
      }
      if (r.next != null && !seen.has(r.next)) for (const [k, v] of ofEvent(r.next, seen)) m.set(k, (m.get(k) ?? 0) + v)
      maxInto(out, m)
    }
    return out
  }
  const ofEvent = (id: number, seen: Set<number>): Tally => {
    const ev = events[String(id)]
    const next = new Set(seen).add(id)
    const out: Tally = new Map()
    if (!ev) return out
    if (ev.kind === 'choice') for (const o of ev.options) maxInto(out, ofResults(o.results, next))
    else { maxInto(out, ofResults(ev.success.results, next)); maxInto(out, ofResults(ev.failure.results, next)) }
    return out
  }
  const total: Tally = new Map()
  for (const f of firsts) for (const [k, v] of ofEvent(f, new Set())) total.set(k, (total.get(k) ?? 0) + v)
  return total
}

/** The dungeon's obtainable gifts at the top right of its view: the site's gift cards, ×N the most one can get. */
export default function DungeonGifts({ events, gifts, firsts, lang, base }: {
  events: Record<string, DungeonEvent>; gifts: Record<string, DungeonEventGift>; firsts: number[]; lang: Lang; base: string
}) {
  const s = L[lang]
  const [open, setOpen] = useState<string | null>(null)
  // folded at first: the list covers the board on a phone (USER 2026-11-09)
  const [shown, setShown] = useState(false)
  const list = useMemo(() => [...giftTally(events, firsts)].filter(([id]) => gifts[id]), [events, gifts, firsts])
  if (!list.length) return null
  const g = open ? gifts[open] : null
  return (
    <section aria-label={s.title} className="pointer-events-auto ml-auto w-fit bg-[#0b0906]/80 px-3 py-1 shadow-[0_2px_10px_#000a] backdrop-blur-sm">
      {/* the title row folds the list away and back */}
      <button type="button" aria-expanded={shown} onClick={() => setShown(v => !v)}
        className="group flex min-h-10 w-full min-w-[14rem] items-center gap-2 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--gold)]">
        <h3 className="shrink-0 font-[family-name:var(--font-heading)] text-[0.9375rem] leading-none text-[#e8dcc8] group-hover:text-[#f3e4cb]">{s.title}</h3>
        <span aria-hidden className="h-px flex-1 bg-[#3a2a15]" />
        <span className="font-[family-name:var(--font-title)] text-[1.125rem] leading-none text-[#e8b030]">{list.length}</span>
        <ChevronDown size={16} aria-hidden className={`shrink-0 text-[#94887a] transition-transform duration-200 group-hover:text-[#e8b030] ${shown ? 'rotate-180' : ''}`} />
      </button>
      {/* no scroll box: a card grows on hover, which would make one scroll; pt / pr: room for the ×N badges; up to 8
          cards a row (8 x 3rem + 7 gaps + the badge room), right aligned: the box is as wide as its cards */}
      {shown && <ul className="story-panel-in flex max-w-[min(28.75rem,46cqw)] flex-wrap justify-end gap-2.5 pb-2.5 pr-1.5 pt-1.5">
        {list.map(([id, n]) => {
          const name = pickText(gifts[id].name, lang)
          return (
            <li key={id} className="relative">
              <GiftCard gift={giftArt(id, gifts[id], base, lang)} onClick={() => setOpen(id)} size="3rem" showName={false}
                ariaLabel={n > 1 ? `${name} ${s.count(n)}` : name} title={n > 1 ? `${name} — ${s.count(n)}` : name} />
              {n > 1 && (
                <span aria-hidden className="pointer-events-none absolute -right-1 -top-1 z-10 bg-[#8a0b0b] px-1 py-0.5 font-[family-name:var(--font-title)] text-[0.9375rem] leading-none text-[#f3e4cb] shadow-[0_1px_3px_#000]">×{n}</span>
              )}
            </li>
          )
        })}
      </ul>}
      {g && open && <EventGiftModal id={open} g={g} base={base} lang={lang} onClose={() => setOpen(null)} />}
    </section>
  )
}

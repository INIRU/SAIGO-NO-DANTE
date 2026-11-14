'use client'

import { useState, type CSSProperties } from 'react'
import { ChevronRight, Lock, Swords } from 'lucide-react'
import type { DungeonEventEffect, DungeonEventResult } from '@/lib/story-map'
import GiftCard from '@/features/mirror-dungeon/components/GiftCard'
import GiftArtwork from '@/components/ui/GiftArtwork'
import { buttonClass } from '@/components/ui/Button'
import {
  INK, L, SIN_ICON, TONE, checkChain, condLabel, giftArt, lockGifts, nine, pickText, reach, ui,
  type CheckEvent, type ChoiceEvent, type Ctx, type Reward,
} from '@/features/story'

/** The game's TextMeshPro rich text (color, size, i, b, u, ruby, noparse; nested) as spans in the site's tones, line breaks kept.
 *  Anything else in angle brackets is not a tag to TextMeshPro either, so it stays as text. */
export function Rich({ text, ink }: { text: string; ink?: boolean }) {
  const map = ink ? INK : TONE
  const re = /<noparse>([\s\S]*?)<\/noparse>|<ruby=("?)([^>]*?)\2>([\s\S]*?)<\/ruby>|<(\/?)(color|size|i|b|u)(?:=([^>]+))?>/g
  type Frame = { style?: CSSProperties; tag: string; kids: React.ReactNode[] }
  const stack: Frame[] = [{ tag: '', kids: [] }]
  const top = () => stack[stack.length - 1]
  let at = 0, k = 0, m: RegExpExecArray | null
  while ((m = re.exec(text))) {
    if (m.index > at) top().kids.push(text.slice(at, m.index))
    at = m.index + m[0].length
    if (m[1] !== undefined) top().kids.push(m[1])
    else if (m[4] !== undefined) top().kids.push(<ruby key={k++}>{m[4]}<rt>{m[3]}</rt></ruby>)
    else if (m[5]) {  // a closing tag closes up to its own opener; a stray one is dropped
      const i = stack.findLastIndex(f => f.tag === m![6])
      while (i > 0 && stack.length > i) {
        const f = stack.pop()!
        top().kids.push(<span key={k++} style={f.style}>{f.kids}</span>)
      }
    } else {
      const [tag, v = ''] = [m[6], m[7]?.replace(/"/g, '')]
      const hex = /^#([0-9a-fA-F]{6})/.exec(v)?.[1]
      const style: CSSProperties = tag === 'color' ? { color: hex ? map[hex.toLowerCase()] ?? `#${hex}` : v }
        : tag === 'size' ? { fontSize: v.endsWith('%') ? `${parseFloat(v) / 100}em` : v.endsWith('em') ? v : undefined }
        : tag === 'i' ? { fontStyle: 'italic' } : tag === 'b' ? { fontWeight: 700 } : { textDecoration: 'underline' }
      stack.push({ tag, style, kids: [] })
    }
  }
  if (at < text.length) top().kids.push(text.slice(at))
  while (stack.length > 1) { const f = stack.pop()!; top().kids.push(<span key={k++} style={f.style}>{f.kids}</span>) }
  return <>{stack[0].kids}</>
}

/** A section's title on the game's brushed bronze tag (the event window's 결과 / 선택지 band), an aside at the row's end. */
export function SectionTitle({ children, aside }: { children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <div className="flex min-h-11 items-center gap-3">
      <h3 className="-ml-3 flex h-11 shrink-0 items-center gap-2 bg-[length:100%_100%] bg-no-repeat pl-7 pr-14 font-[family-name:var(--font-heading)] text-[1.25rem] leading-none text-[#fff1d8] [text-shadow:0_1px_2px_#000c]"
        style={{ backgroundImage: `url(${ui('tag')})` }}>{children}</h3>
      <span className="flex-1" />
      {aside}
    </div>
  )
}

/** The game's red button (5_17, lit 5_18 on hover, 5_21 pressed) with its words. */
function GameButton({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick}
      className="group relative inline-flex min-h-12 min-w-[10.5rem] items-center justify-center gap-1.5 px-7 pb-1.5 font-[family-name:var(--font-heading)] text-[1.0625rem] leading-none text-[#fff2dc] [text-shadow:0_1px_2px_#0009] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--gold)]">
      {(['button', 'button-hover', 'button-press'] as const).map((k, i) => (
        <span key={k} aria-hidden className={`absolute inset-0 transition-opacity duration-150 ${i === 0 ? '' : i === 1 ? 'opacity-0 group-hover:opacity-100' : 'opacity-0 group-active:opacity-100'}`}
          style={nine(k, '65 65 75 65', '1rem 1rem 1.25rem 1rem')} />
      ))}
      <span className="relative flex items-center gap-1.5">{children}</span>
    </button>
  )
}
/** The options: a bar each (the game's choice text and hint; the icons of what it can give), the picked one's results
 * below in full. */
export function Choices({ ev, ctx }: { ev: ChoiceEvent; ctx: Ctx }) {
  const s = L[ctx.lang]
  const [sel, setSel] = useState(0)
  const o = ev.options[sel]
  const needs = lockGifts(o.lock).filter(id => ctx.gifts[id])
  return (
    <>
      <SectionTitle>{s.choices}</SectionTitle>
      <div className="mt-3 space-y-2.5" role="tablist">
        {ev.options.map((opt, i) => {
          const on = i === sel
          const r = reach(opt.results, ctx, new Set([ev.id]))
          const gifts = [...r.gifts]
          return (
            <div key={i} className="relative pl-7">
              {/* the game's pointer (7_14, turned to point at the plate) on the picked option */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={ui('pointer')} alt="" aria-hidden className={`absolute left-0 top-1/2 h-5 w-auto -translate-y-1/2 -scale-x-100 transition-[opacity,translate] duration-200 ease-out ${on ? 'opacity-100' : '-translate-x-1.5 opacity-0'}`} />
              <button type="button" role="tab" aria-selected={on} onClick={() => setSel(i)}
                className={`flex min-h-[4.25rem] w-full items-center gap-4 px-3 py-1.5 text-left transition-[filter] duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--gold)] ${on ? 'brightness-110' : 'brightness-[.82] hover:brightness-100'}`}
                style={nine('option', '45', '0.875rem')}>
                <span className={`w-7 shrink-0 text-center font-[family-name:var(--font-title)] text-[1.75rem] leading-none ${on ? 'text-[var(--gold-light)]' : 'text-[#b9a27e]'}`}>{i + 1}</span>
                <span className="min-w-0 flex-1">
                  <span className="block break-keep font-[family-name:var(--font-heading)] text-[1.0625rem] leading-snug text-[#f6ead6]"><Rich text={pickText(opt.text, ctx.lang)} /></span>
                  {pickText(opt.sub, ctx.lang) && <span className="mt-1 block break-keep text-[0.8125rem] leading-snug text-[#c9b597]"><Rich text={pickText(opt.sub, ctx.lang)} /></span>}
                </span>
                {/* at a glance: the check's sins, a battle, the gifts it can give */}
                <span className="flex shrink-0 items-center gap-1.5">
                  {lockGifts(opt.lock).length > 0 && <Lock size={14} aria-label={s.needs} className="text-[#c9b597]" />}
                  {[...r.sins].filter(x => SIN_ICON[x]).map(x => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img key={x} src={ui(SIN_ICON[x])} alt="" className="h-6 w-6 object-contain" />
                  ))}
                  {r.battle && <Swords size={17} aria-label={s.battle} className="text-[#ec6a5e]" />}
                  {gifts.slice(0, 4).map(id => (
                    <span key={id} className="relative block w-9">
                      <GiftArtwork gift={giftArt(id, ctx.gifts[id], ctx.base, ctx.lang)} displayName={pickText(ctx.gifts[id].name, ctx.lang)} sizes="36px" />
                    </span>
                  ))}
                  {gifts.length > 4 && <span className="font-[family-name:var(--font-title)] text-[1rem] leading-none text-[var(--gold-light)]">+{gifts.length - 4}</span>}
                </span>
              </button>
            </div>
          )
        })}
      </div>

      {/* the picked option's results in full */}
      <div key={sel} role="tabpanel" className="story-panel-in mt-7">
        <SectionTitle aside={
          <button type="button" onClick={() => ctx.go({ t: 'option', id: ev.id, idx: sel })} className={buttonClass({ variant: 'ghost', size: 'sm' })}>
            {s.story}<ChevronRight size={16} aria-hidden />
          </button>
        }>
          <span className="font-[family-name:var(--font-title)] text-[1.5rem] leading-none text-[var(--gold-light)]">{sel + 1}</span>{s.result}
        </SectionTitle>
        <ResultBox>
          {needs.length > 0 && (
            <div className="mb-1 flex items-center gap-3">
              <span className="flex gap-2">{needs.map(id => <Gift key={id} id={id} ctx={ctx} />)}</span>
              <span className="text-[0.8125rem] text-[var(--text-secondary)]">{s.needs}</span>
            </div>
          )}
          <Outcome results={o.results} ctx={ctx} seen={new Set([ev.id])} />
        </ResultBox>
      </div>
    </>
  )
}

/** The game's result box (8_0: halftone dark, brass edge) behind what a choice or a check gives. */
export function ResultBox({ children, className = 'mt-3' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`relative px-6 pb-5 pt-3 ${className}`}>
      <span aria-hidden className="pointer-events-none absolute inset-0" style={nine('result', '230 285 230 285', '2.25rem 2.75rem')} />
      <div className="relative">{children}</div>
    </div>
  )
}

/** A value box of the check panel (7_21) with its title on the bronze band: 성공 값 and the up / down arrow (7_32). */
function ValueBox({ label, value, arrow, dim }: { label: string; value: number; arrow?: 'up' | 'down'; dim?: boolean }) {
  return (
    <div className="relative flex min-w-[7.5rem] flex-col items-center px-4 pb-2.5 pt-2">
      <span aria-hidden className="pointer-events-none absolute inset-0" style={nine('value', '30', '0.5rem')} />
      <span className="relative bg-[length:100%_100%] bg-no-repeat px-4 py-0.5 font-[family-name:var(--font-heading)] text-[0.8125rem] leading-tight text-[#fff1d8] [text-shadow:0_1px_1px_#000a]"
        style={{ backgroundImage: `url(${ui('tag')})` }}>{label}</span>
      <span className={`relative mt-1 flex items-center gap-1.5 font-[family-name:var(--font-title)] text-[2.25rem] leading-none ${dim ? 'text-[#cbbfae]' : 'text-[#fff1d8]'} [text-shadow:0_2px_3px_#000b]`}>
        {value}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {arrow && <img src={ui('arrow-up')} alt="" className={`h-6 w-auto ${arrow === 'down' ? 'rotate-180' : ''}`} />}
      </span>
    </div>
  )
}

/** Tabs as the site's info windows draw them: words on one line, the chosen one in gold over a 2px rule. */
function Tabs({ tabs, value, onChange, small }: { tabs: { key: string; label: string; tone?: string }[]; value: string; onChange: (k: string) => void; small?: boolean }) {
  return (
    // small: tabs inside other tabs (a check's branches), without the full-width rule
    <div role="tablist" className={`flex flex-wrap ${small ? 'gap-x-4' : 'gap-x-5 border-b border-[var(--border)]'}`}>
      {tabs.map(t => {
        const on = t.key === value
        const tone = t.tone ?? 'var(--gold-light)'
        return (
          <button key={t.key} type="button" role="tab" aria-selected={on} onClick={() => onChange(t.key)}
            className={`-mb-px border-b-2 font-[family-name:var(--font-heading)] transition-colors ${small ? 'min-h-9 text-[0.8125rem]' : 'min-h-10 text-[0.9375rem]'} focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--gold)] ${on ? '' : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-secondary)]'}`}
            style={on ? { color: tone, borderColor: tone } : undefined}>
            {t.label}
          </button>
        )
      })}
    </div>
  )
}

/**
 * What results give: branches (by probability or the sinner picked) as tabs; the effect lines with gift cards and a
 * battle's enemies; a check that follows as its line with 판정 성공 / 판정 실패 as tabs; a choice that follows as a button
 * to it. story: the step view, where whatever follows is 다음으로.
 */
export function Outcome({ results, ctx, seen, story, nested, chain }: { results: DungeonEventResult[]; ctx: Ctx; seen: Set<number>; story?: boolean; nested?: boolean
  /** the check chain this outcome sits in: a check of it that follows is named (판정 N), not drawn again */
  chain?: Map<number, number> }) {
  const s = L[ctx.lang]
  const [at, setAt] = useState(0)
  const r = results[Math.min(at, results.length - 1)]
  if (!r) return null
  const lines = (r.effects ?? []).filter(f => pickText(f.text, ctx.lang))
  const inChain = !story && r.next != null ? chain?.get(r.next) : undefined
  const next = inChain == null && r.next != null && !seen.has(r.next) ? ctx.events[String(r.next)] : undefined
  return (
    <div className="mt-3">
      {results.length > 1 && (
        <Tabs tabs={results.map((x, i) => ({ key: String(i), label: condLabel(x.cond, ctx.lang) ?? String(i + 1) }))} value={String(at)} onChange={k => setAt(Number(k))} small={nested} />
      )}
      <div key={at}>
        {lines.length > 0 && (
          <ul className="mt-3 space-y-2.5 font-[family-name:var(--font-game-text)] text-[0.875rem] leading-snug text-[var(--text-primary)]">
            {lines.map((f, k) => <Effect key={k} f={f} ctx={ctx} />)}
          </ul>
        )}
        {next && story && (
          <div className="mt-6 flex justify-end">
            <GameButton onClick={() => ctx.go({ t: next.kind === 'check' ? 'judge' : 'event', id: next.id })}>{s.next}</GameButton>
          </div>
        )}
        {inChain != null && (
          <p className="mt-2.5 flex items-center gap-1 font-[family-name:var(--font-heading)] text-[0.8125rem] text-[var(--text-secondary)]">
            <ChevronRight size={14} aria-hidden />{s.toCheck(inChain)}
          </p>
        )}
        {next && !story && next.kind === 'check' && <div className="mt-5"><CheckChain first={next} ctx={ctx} seen={seen} /></div>}
        {next && !story && next.kind === 'choice' && (
          <button type="button" onClick={() => ctx.go({ t: 'event', id: next.id })} className={`mt-3 ${buttonClass({ variant: 'outline', size: 'sm' })}`}>
            {s.more(next.options.length)}<ChevronRight size={16} aria-hidden />
          </button>
        )}
      </div>
    </div>
  )
}

/** A check's line (PersonalityChoiceEventJudgementTitleUI): the sins' icons, 유리 / 불리 판정 with the sins, 성공 값
 * (inclusiveValue for those sins, exclusiveValue for any other) with its up / down arrow; the bonuses under it. */
function CheckLine({ ev, ctx }: { ev: CheckEvent; ctx: Ctx }) {
  const s = L[ctx.lang]
  const j = ev.judge
  const up = (j.upDownType ?? 1) > 0
  return (
    <div>
      {/* the game's paper plate (5_20): the sins and 유리 / 불리 판정, the question under it */}
      <div className="relative px-7 pb-4 pt-3.5 text-center">
        <span aria-hidden className="pointer-events-none absolute inset-0" style={nine('paper', '120', '1.75rem')} />
        <p className="relative flex items-center justify-center gap-2 font-[family-name:var(--font-heading)] text-[1.3125rem] leading-none text-[#2b1d12]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {ev.sins.filter(x => SIN_ICON[x]).map(x => <img key={x} src={ui(SIN_ICON[x])} alt="" className="h-8 w-8 object-contain" />)}
          <Rich text={pickText(ev.judgeText, ctx.lang)} ink />
        </p>
        {pickText(ev.behave, ctx.lang) && <p className="relative mt-2 break-keep font-[family-name:var(--font-game-text)] text-[0.9375rem] leading-snug text-[#3b2a1c]"><Rich text={pickText(ev.behave, ctx.lang)} ink /></p>}
      </div>
      <div className="mt-2.5 flex flex-wrap items-center gap-2.5">
        <ValueBox label={s.threshold} value={j.inclusiveValue} arrow={up ? 'up' : 'down'} />
        {j.exclusiveValue != null && j.exclusiveValue !== j.inclusiveValue && ev.sins.length > 0 && <ValueBox label={s.others} value={j.exclusiveValue} dim />}
        {ev.bonus.length > 0 && (
          <ul className="ml-2 space-y-1 text-[0.8125rem] leading-snug text-[var(--text-secondary)]">
            {ev.bonus.map((b, i) => <li key={i}><Rich text={pickText(b.text, ctx.lang)} /></li>)}
          </ul>
        )}
      </div>
    </div>
  )
}

/**
 * Checks as the game runs them, one after another (ChoiceEventController: a Sinner is picked for each, their Identity's
 * skill rolls against 성공 값, 다음으로 to the next): each check's line, then what 판정 성공 and 판정 실패 give side by
 * side; an outcome that goes on to a later check names it (판정 N).
 */
export function CheckChain({ first, ctx, seen, boxed }: { first: CheckEvent; ctx: Ctx; seen: Set<number>
  /** the window's own check (not inside an option's result box): its outcomes get the result box */
  boxed?: boolean }) {
  const s = L[ctx.lang]
  const list = checkChain(first, ctx, seen)
  const index = new Map(list.map((ev, i) => [ev.id, i + 1]))
  const all = new Set([...seen, ...list.map(ev => ev.id)])
  const outcomes = (ev: CheckEvent) => (
    <div className="grid grid-cols-2 divide-x divide-[var(--border)]">
      {(['success', 'fail'] as const).map(side => (
        <div key={side} className={`min-w-0 ${side === 'success' ? 'pr-5' : 'pl-5'}`}>
          <p className={`pt-1 font-[family-name:var(--font-heading)] text-[1rem] leading-none ${side === 'success' ? 'text-[var(--gold-light)]' : 'text-[var(--error-text)]'}`}>
            {side === 'success' ? s.success : s.fail}
          </p>
          <Outcome results={(side === 'success' ? ev.success : ev.failure).results} ctx={ctx} seen={all} chain={index} nested />
        </div>
      ))}
    </div>
  )
  return (
    <div className="mt-3">
      <p className="break-keep text-[0.8125rem] leading-snug text-[var(--text-secondary)]">{s.howCheck}</p>
      <ol className="mt-5 space-y-8">
        {list.map((ev, i) => (
          <li key={ev.id}>
            {list.length > 1 && (
              <p className="mb-2.5 flex items-baseline gap-1.5 font-[family-name:var(--font-heading)] text-[0.9375rem] leading-none text-[var(--text-secondary)]">
                {s.check}<span className="font-[family-name:var(--font-title)] text-[1.5rem] text-[var(--gold-light)]">{i + 1}</span>
                <span className="font-[family-name:var(--font-title)] text-[1rem] text-[var(--text-muted)]">/ {list.length}</span>
              </p>
            )}
            <CheckLine ev={ev} ctx={ctx} />
            {boxed ? <ResultBox className="mt-3">{outcomes(ev)}</ResultBox> : <div className="mt-4">{outcomes(ev)}</div>}
          </li>
        ))}
      </ol>
    </div>
  )
}

/** A check as a story step: the game's prompt to pick the Identity, the check's line, and the two outcomes to follow. */
export function CheckStep({ ev, ctx }: { ev: CheckEvent; ctx: Ctx }) {
  const s = L[ctx.lang]
  return (
    <>
      <SectionTitle>{s.check}</SectionTitle>
      <div className="mt-3"><CheckLine ev={ev} ctx={ctx} /></div>
      <p className="mt-5 font-[family-name:var(--font-heading)] text-[1rem] text-[var(--text-primary)]">{s.pickSinner}</p>
      <div className="mt-4 flex flex-wrap gap-3">
        <GameButton onClick={() => ctx.go({ t: 'outcome', id: ev.id, side: 'success' })}>{s.ifSuccess}</GameButton>
        <GameButton onClick={() => ctx.go({ t: 'outcome', id: ev.id, side: 'fail' })}>{s.ifFail}</GameButton>
      </div>
    </>
  )
}

/** A gift as the site's gift card; pressing it opens the gift's effect window. */
function Gift({ id, ctx, size = '3rem' }: { id: string; ctx: Ctx; size?: string }) {
  const g = ctx.gifts[id]
  if (!g) return null
  const name = pickText(g.name, ctx.lang)
  return <GiftCard gift={giftArt(id, g, ctx.base, ctx.lang)} onClick={() => ctx.openGift(id)} size={size} showName={false} ariaLabel={name} title={name} />
}

/** One effect line in the game's words; a gift it gives or takes as its card (press for its effect), a battle's enemies. */
function Effect({ f, ctx }: { f: DungeonEventEffect; ctx: Ctx }) {
  const reward = f.itemReward as Reward | undefined
  const gid = reward?.type === 'EGO_GIFT' && reward.rewardId != null && ctx.gifts[String(reward.rewardId)] ? String(reward.rewardId) : null
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-2">
      {gid && <Gift id={gid} ctx={ctx} />}
      <span className="min-w-0"><Rich text={pickText(f.text, ctx.lang)} /></span>
      {f.battle && <Battle effect={f} ctx={ctx} />}
    </li>
  )
}

/** A battle an effect starts: its enemies as small portrait cards in the stage panel's bronze frame (names on hover). */
function Battle({ effect, ctx }: { effect: DungeonEventEffect; ctx: Ctx }) {
  const s = L[ctx.lang]
  const units = [...new Map((effect.battle?.waves ?? []).flat().filter(u => !u.hidden).map(u => [u.id, u])).values()]
  if (!units.length) return null
  return (
    <ul aria-label={s.battle} className="flex flex-wrap gap-1.5">
      {units.map(u => {
        const e = ctx.sub.enemies[String(u.id)]
        const name = pickText(e?.name, ctx.lang) || '???'
        return (
          <li key={u.id} className="w-10" title={name}>
            <div className="relative aspect-[279/361]">
              <div className="absolute inset-[5%] overflow-hidden bg-[var(--bg-card)]">
                {e?.portrait
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={`${ctx.base}/portrait/${e.portrait}.webp`} alt={name} loading="lazy" className="absolute left-1/2 top-[-4%] h-[170%] w-auto max-w-none -translate-x-1/2" />
                  : <span className="flex h-full items-center justify-center font-[family-name:var(--font-title)] text-[1rem] text-[var(--text-muted)]">?</span>}
              </div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`${ctx.base}/ui/enemy-frame.webp`} alt="" aria-hidden className="pointer-events-none absolute inset-0 h-full w-full" />
            </div>
          </li>
        )
      })}
    </ul>
  )
}

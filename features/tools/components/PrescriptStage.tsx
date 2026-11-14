'use client'

import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { gradeOf, prescriptPoints, type Prescript, type PrescriptCard, type PrescriptGoal, type PrescriptRun, type PrescriptScope } from '@/features/tools/lib/prescript'
import type { PrescriptOffer } from '@/features/tools/hooks/usePrescript'
import styles from './prescript.module.css'
import { getGiftKeywordColor } from '@/lib/constants/gift'

const ASSET = '/assets/fun/prescript'
const POINTS = [0, 5, 10, 20, 35, 60]

/** One cell of the game's 5x7 prescript glyph sheet (Fx_T_Shape_Retro_Number, 13x5 cells), picked at random. */
const cell = () => { const i = Math.floor(Math.random() * 65); return `${(i % 13) / 12 * 100}% ${Math.floor(i / 13) / 4 * 100}%` }

/** How long the glyphs roll before the letters come, and how long the letters take: the sounds follow the same clock. */
const ROLL = 800, SETTLE = 800

/** The terminal's sound level (0 to 1, 0 is silent), kept in this browser. */
const VOLUME_KEY = 'prescript-volume'
export function readVolume(): number {
  try {
    const stored = window.localStorage.getItem(VOLUME_KEY)
    const value = Number(stored)
    return stored !== null && Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0.5
  } catch { return 0.5 }
}
let volume = typeof window === 'undefined' ? 0.5 : readVolume()
export function setVolume(value: number) {
  volume = Math.min(1, Math.max(0, value))
  try { window.localStorage.setItem(VOLUME_KEY, String(volume)) } catch { /* kept for this page only */ }
  if (sounds) for (const audio of [sounds.first, sounds.second]) audio.volume = volume
}

/** The two arrival sounds, fetched once when the stage is first drawn so they are not late on the first prescript. */
let sounds: { first: HTMLAudioElement; second: HTMLAudioElement } | null = null
function loadSounds() {
  try {
    if (!sounds) {
      sounds = { first: new Audio(`${ASSET}/index_message_1.ogg`), second: new Audio(`${ASSET}/index_message_2.ogg`) }
      for (const audio of [sounds.first, sounds.second]) { audio.preload = 'auto'; audio.volume = volume; audio.load() }
    }
  } catch { /* no audio: the prescript still shows */ }
  return sounds
}

/** The prescript arriving (Fx_Mon_Index_Buff_BuffScript_IndexPrescript_Ex): sound 1 while the glyphs roll, then sound 2 eight
 * times, 0.1 s apart, while the letters settle. */
export function playArrival(): () => void {
  const timers: number[] = []
  const loaded = loadSounds()
  if (!loaded || volume === 0) return () => {}
  const { first, second } = loaded
  first.currentTime = 0
  void first.play().catch(() => {})
  timers.push(window.setTimeout(() => {
    first.pause()
    for (let i = 0; i < 8; i++) timers.push(window.setTimeout(() => {
      const beep = second.cloneNode() as HTMLAudioElement // its own copy, so the beeps do not cut each other off
      beep.volume = second.volume
      void beep.play().catch(() => {})
    }, i * (SETTLE / 8)))
  }, ROLL))
  return () => { timers.forEach(window.clearTimeout); first.pause() }
}

/** A verdict's beeps: fulfilled once, violated three times fast (the arrival's beep); a recall is silent. */
export function playVerdict(status: Prescript['status']) {
  const loaded = loadSounds()
  if (!loaded || volume === 0 || status === 'void' || status === 'active') return
  for (let i = 0; i < (status === 'done' ? 1 : 3); i++) window.setTimeout(() => {
    const beep = loaded.second.cloneNode() as HTMLAudioElement
    beep.volume = loaded.second.volume
    void beep.play().catch(() => {})
  }, i * 90)
}

/** How long a verdict stays on the stage, and a room's prescript arriving (its glyphs roll, settle, then it is read). */
const VERDICT_MS = 2400
const ARRIVAL_MS = ROLL + SETTLE + 1800

/**
 * Prescripts that came to `which` since the stage was drawn, one at a time, each shown for `ms` (a reload or a run
 * read back shows none again): the verdicts (이행 / 위반 / 회수) and a ? room's prescript, which comes without cards.
 */
function useNewPrescripts(run: PrescriptRun, which: (p: Prescript) => boolean, ms: number) {
  const seen = useRef<Set<number> | null>(null)
  const [queue, setQueue] = useState<Prescript[]>([])
  useEffect(() => {
    const now = run.prescripts.filter(which)
    if (!seen.current) { seen.current = new Set(now.map(p => p.id)); return }
    const fresh = now.filter(p => !seen.current!.has(p.id))
    for (const p of now) seen.current.add(p.id)
    if (fresh.length) setQueue(current => [...current, ...fresh])
  }, [run.prescripts, which])
  const shown = queue[0] ?? null
  useEffect(() => {
    if (!shown) return
    const timer = window.setTimeout(() => setQueue(current => current.slice(1)), ms)
    return () => window.clearTimeout(timer)
  }, [shown, ms])
  return shown
}
const settledShown = (p: Prescript) => p.status !== 'active' && p.goal.kind !== 'no-answer'
const roomArrived = (p: Prescript) => (p.scope === 'event' || p.scope === 'start' || p.penance === true) && p.status === 'active'

/** `gift`: a gift's id (its image goes before the name, the name in its keyword's colour); `keyword`: a keyword's own colour. */
interface Part { text: string; em: boolean; gift?: number; keyword?: string }
/** A label's marked names and numbers (\u0001…\u0002) as parts to set apart; a mark may open with a tag (\u0007g:id\u0007 or
 * \u0007k:keyword\u0007) naming a gift or a keyword. */
const partsOf = (text: string): Part[] => text.split(/(\u0001[^\u0002]*\u0002)/).filter(Boolean).map(piece => {
  if (!piece.startsWith('\u0001')) return { text: piece, em: false }
  const tag = /^\u0007([gk]):([^\u0007]*)\u0007/.exec(piece.slice(1, -1))
  const text = tag ? piece.slice(1 + tag[0].length, -1) : piece.slice(1, -1)
  return tag?.[1] === 'g' ? { text, em: true, gift: Number(tag[2]) } : tag ? { text, em: true, keyword: tag[2] } : { text, em: true }
})
const plain = (text: string) => text.replace(/\u0007[^\u0007]*\u0007/g, '').replace(/[\u0001\u0002]/g, '')

/** A gift's image and keyword, by its id (the page's gift data). */
type GiftLook = (id: number) => { image: string | null; keyword: string | null } | undefined
const GiftLookContext = createContext<GiftLook>(() => undefined)

/** The prescript text itself: every letter a rolling glyph for `roll` ms, then changing into the text letter by letter over
 * `ms`; still without them, and at once when motion is reduced. */
function Settle({ parts, roll, ms }: { parts: Part[]; roll?: number; ms?: number }) {
  const look = useContext(GiftLookContext)
  const length = parts.reduce((sum, part) => sum + part.text.length, 0)
  const key = parts.map(part => part.text).join('\u0003')
  const [settled, setSettled] = useState(length)
  const [, setTick] = useState(0)
  useEffect(() => {
    if (roll === undefined || ms === undefined || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) { setSettled(length); return }
    const start = performance.now()
    let frame = 0
    const step = (now: number) => {
      const k = now - start < roll ? 0 : Math.floor(Math.min(1, (now - start - roll) / ms) * length)
      setSettled(k)
      setTick(Math.floor((now - start) / 60)) // new glyphs every 60 ms
      if (k < length) frame = requestAnimationFrame(step)
    }
    setSettled(0)
    frame = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frame)
  }, [key, length, roll, ms])
  let at = 0
  return <span aria-hidden="true">{parts.map((part, i) => {
    const shown = Math.max(0, Math.min(part.text.length, settled - at))
    at += part.text.length
    // a rolling glyph is drawn over its own letter, kept but unseen, so the lines never change while the letters come
    const body = <>{part.text.slice(0, shown)}{[...part.text.slice(shown)].map((c, j) => c === ' ' ? c
      : <span key={j} className={styles.gli} style={{ backgroundPosition: cell() }}>{c}</span>)}</>
    if (part.gift !== undefined) {
      const gift = look(part.gift)
      return <b key={i} className={styles.em} style={gift?.keyword ? { color: getGiftKeywordColor(gift.keyword) } : undefined}>
        {/* eslint-disable-next-line @next/next/no-img-element -- the gift's icon from the game data, inline in the text */}
        {gift?.image && <img className={styles.gimg} src={gift.image} alt="" loading="lazy" />}{body}</b>
    }
    if (part.keyword) return <b key={i} className={styles.em} style={{ color: getGiftKeywordColor(part.keyword) }}>{body}</b>
    return part.em ? <b key={i} className={styles.em}>{body}</b> : <span key={i}>{body}</span>
  })}</span>
}

/** The offer's reply deadline: a bar running out and the seconds left (the terminal chooses at zero). */
function Countdown({ issuedAt, replyMs, label }: { issuedAt: number; replyMs: number; label: (seconds: number) => string }) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => { const id = window.setInterval(() => setNow(Date.now()), 250); return () => window.clearInterval(id) }, [])
  const left = Math.max(0, replyMs - (now - issuedAt))
  return <div className={styles.due2}>
    <div className={styles.dueBar}><span style={{ transform: `scaleX(${left / replyMs})` }} /></div>
    <span>{label(Math.ceil(left / 1000))}</span>
  </div>
}

const Flower = () => <svg viewBox="-12 -12 24 24" aria-hidden="true"><g fill="#3d7fe0">{[0, 72, 144, 216, 288].map(r =>
  <ellipse key={r} cx="0" cy="-6" rx="3.6" ry="6" transform={`rotate(${r})`} />)}</g><circle r="2" fill="#f1f4f8" /></svg>

const KIND: Record<PrescriptGoal['kind'], string> = {
  'sell-keyword': 'kind_sell', 'sell-tier': 'kind_sell', 'fuse-gift': 'kind_fuse', 'fuse-tier': 'kind_fuse', 'get-keyword': 'kind_gather',
  'no-sale': 'kind_floor', 'pick-theme': 'kind_theme', 'buy-gift': 'kind_shop', 'buy-leftmost': 'kind_shop', 'no-answer': 'kind_floor', 'event-choice': 'kind_event', 'swap-identity': 'kind_formation', 'formation-keyword': 'kind_formation', 'field-identity': 'kind_formation', 'front-identity': 'kind_formation', 'start-formation': 'kind_formation', 'start-gift': 'kind_start', 'observe-gift': 'kind_start',
}

interface Props {
  run: PrescriptRun
  offers: PrescriptOffer[]
  label: (goal: PrescriptGoal) => string
  onChoose: (card: PrescriptCard) => void
  /** Whether a card can still be carried out now (its occasion may have passed while the offer waited). */
  canChoose: (card: PrescriptCard) => boolean
  onReroll: (scope: PrescriptScope) => boolean
  onRefuse: (scope: PrescriptScope) => void
  /** The PiP shows the stage and what is held, without the record. */
  pip?: boolean
  /** A verdict shown as a preview (the settings' test), over the stage like a real one. */
  preview?: Prescript | null
  /** The gifts' images and keywords for the names in the text. */
  giftLook?: GiftLook
}

export default function PrescriptStage({ giftLook, ...props }: Props) {
  return <GiftLookContext.Provider value={giftLook ?? (() => undefined)}><Stage {...props} /></GiftLookContext.Provider>
}

function Stage({ run, offers, label, onChoose, canChoose, onReroll, onRefuse, pip = false, preview = null }: Omit<Props, 'giftLook'>) {
  const t = useTranslations('prescriptMode')
  const offer = offers[0] ?? null
  const offerKey = offer ? `${offer.scope}:${offer.floor}:${offer.cards.map(c => JSON.stringify(c.goal)).join('|')}` : ''
  useEffect(() => { if (!pip) loadSounds() }, [pip])
  const cued = useRef('')
  useEffect(() => {
    if (!offerKey || offerKey === cued.current) return
    cued.current = offerKey
    return pip ? undefined : playArrival()
  }, [offerKey, pip])
  const verdict = useNewPrescripts(run, settledShown, VERDICT_MS) ?? preview
  useEffect(() => { if (verdict && !pip) playVerdict(verdict.status) }, [verdict, pip])
  // a ? room's prescript comes without cards to choose: it arrives on the stage with the arrival's sound
  const arrival = useNewPrescripts(run, roomArrived, ARRIVAL_MS)
  useEffect(() => (arrival && !pip ? playArrival() : undefined), [arrival, pip])
  const held = run.prescripts.filter(p => p.status === 'active')
  const settled = run.prescripts.filter(p => p.status !== 'active').slice().reverse()
  // the game's form: the order in 【】, then its deadline (Faust: "기한은 여섯 달 이내")
  // a pack prescript is due on its own floor, whatever kind it came as
  const deadline = (goal: PrescriptGoal, scope: PrescriptScope) => goal.kind === 'pick-theme' ? t('deadline_pick', { floor: goal.floor })
    : goal.kind === 'start-formation' ? t('deadline_start_formation') : t(`deadline_${scope}`)
  const quote = (goal: PrescriptGoal, scope: PrescriptScope) => `【${plain(label(goal))}】 ${deadline(goal, scope)}`
  // a plain function, not a component made in this render: one would be new on every render and roll its text again
  const text = (goal: PrescriptGoal, scope: PrescriptScope, roll?: number, ms?: number) =>
    <span className={styles.pt}>
      <span className={styles.order}>【<Settle parts={partsOf(label(goal))} roll={roll} ms={ms} />】</span>
      <span className={styles.due}><Settle parts={[{ text: deadline(goal, scope), em: false }]} roll={roll} ms={ms} /></span>
    </span>
  const progress = (p: Prescript) => p.goal.kind === 'get-keyword' ? `${p.progress}/${p.goal.count}` : ''

  return <div className={pip ? styles.pip : undefined}>
    <section className={`${styles.stage} ${offer ? styles.on : ''}`} aria-live="polite" data-prescript-stage>
      {pip && <div className={styles.pipStats}><span><b>{run.score}</b>{t('scoreUnit')}</span><span><b>{run.streak}</b>{t('streakUnit')}</span></div>}
      {/* the terminal is always there, lit when a prescript comes in, so nothing below moves */}
      <p className={styles.call}>
        {/* eslint-disable-next-line @next/next/no-img-element -- the game's prescript (terminal) keyword icon from public/ */}
        <img className={styles.term} src={`${ASSET}/prescript_terminal.png`} alt="" width={40} height={40} />
        {t(run.ended ? 'ended' : offer ? 'arrived' : 'waiting')}
      </p>
      {offer && <>
        <Countdown issuedAt={offer.shownAt ?? Date.now()} replyMs={gradeOf(run).replyMs} label={seconds => t('replyIn', { seconds })} />
        <div className={styles.cards} role="group" aria-label={t(offer.scope)}>
          {offer.cards.map(card => {
            const points = prescriptPoints(card.strength, card.scope, run.streak + 1, run.grade)
            const open = canChoose(card)
            return <button key={JSON.stringify(card.goal)} type="button" className={styles.c} onClick={() => onChoose(card)} disabled={!open}
              aria-label={t('cardLabel', { strength: card.strength, kind: t(KIND[card.goal.kind]), points, text: quote(card.goal, card.scope) })}>
              {!open && <div className={styles.expired}>{t('cardExpired')}</div>}
              <div className={styles.ban}>{t(offer.scope)}</div>
              <div className={styles.lv}><b>{card.strength}</b>{Array.from({ length: card.strength }, (_, i) => <Flower key={i} />)}</div>
              <div className={styles.d}>{text(card.goal, card.scope, ROLL, SETTLE)}</div>
              <div className={styles.f}><span>{t(KIND[card.goal.kind])}</span><b>{points}</b></div>
            </button>
          })}
        </div>
        <div className={styles.acts}>
          <button type="button" className={styles.b} disabled={run.rerollsLeft === 0} onClick={() => onReroll(offer.scope)}>{t('reroll', { count: run.rerollsLeft })}</button>
          {gradeOf(run).refuse && <button type="button" className={styles.b} onClick={() => onRefuse(offer.scope)}>{t('refuse')}</button>}
        </div>
      </>}
      {arrival && !verdict && <div key={`a${arrival.id}`} className={`${styles.verdict} ${styles.vArrive}`} role="status">
        <p className={styles.call}>
          {/* eslint-disable-next-line @next/next/no-img-element -- the game's prescript (terminal) keyword icon from public/ */}
          <img className={styles.term} src={`${ASSET}/prescript_terminal.png`} alt="" width={40} height={40} />
          {t(arrival.penance ? 'penanceArrived' : arrival.scope === 'start' ? 'startArrived' : 'roomArrived')}
        </p>
        <div className={styles.vText}>{text(arrival.goal, arrival.scope, ROLL, SETTLE)}</div>
      </div>}
      {verdict && <div key={verdict.id} className={`${styles.verdict} ${verdict.status === 'done' ? styles.vOk : verdict.status === 'failed' ? styles.vNo : styles.vRe}`}
        role="status">
        {verdict.status !== 'void' && <span className={styles.vWord} aria-hidden="true">
          <Settle parts={[{ text: verdict.status === 'done' ? 'CLEAR' : 'FAIL', em: false }]} roll={300} ms={300} />
        </span>}
        <span className={styles.stamp}>{t(verdict.penance && verdict.status === 'done' ? 'status_atoned' : `status_${verdict.status}`)}</span>
        <span className={styles.vOrder}>【{plain(label(verdict.goal))}】</span>
        {verdict.status === 'done' ? <span className={styles.vPts}>+{verdict.points} {t('scoreUnit')}{verdict.bonus ? ` · ${t('streakBonus', { count: run.streak, bonus: verdict.bonus })}` : ''}</span>
          : verdict.status === 'failed' && verdict.points ? <span className={styles.vWhy}>{t('graceLost', { points: -verdict.points })}</span>
          : verdict.reason ? <span className={styles.vWhy}>{t(`void_${verdict.reason.replace(/-/g, '_')}`)}</span> : null}
      </div>}
    </section>

    <h2 className={styles.sect}>{t('held')}</h2>
    {held.length ? <ul className={styles.held} data-prescript-held>
      {held.map(p => <li key={p.id} className={styles.h}>
        <span className={styles.k}>{t(p.penance ? 'penance' : p.scope)}</span>
        <span className={styles.tx}><span className="sr-only">{quote(p.goal, p.scope)}</span>{text(p.goal, p.scope)}</span>
        <span className={styles.p}>{progress(p) || POINTS[p.strength]}</span>
      </li>)}
    </ul> : <p className={styles.empty}>{t('noneHeld')}</p>}

    {!pip && <>
      <h2 className={styles.sect}>{t('record')}</h2>
      <div className={styles.log} data-prescript-log>
        {settled.length ? settled.map(p => <div key={p.id} className={styles.row}>
          <span className={styles.fl}>{p.floor}F</span>
          <span className={styles.tx}><span className="sr-only">{quote(p.goal, p.scope)}</span>{text(p.goal, p.scope)}{p.reason && <span className={styles.why}>{t(`void_${p.reason.replace(/-/g, '_')}`)}</span>}</span>
          <span className={`${styles.rs} ${p.status === 'done' ? styles.ok : p.status === 'failed' ? styles.no : styles.re}`}>{t(`status_${p.status}`)}</span>
          <span className={styles.sc}>{p.status === 'done' ? `+${p.points}` : ''}</span>
        </div>) : <p className={styles.empty}>{t('noRecord')}</p>}
      </div>
    </>}
  </div>
}

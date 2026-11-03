'use client'

import { useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { prescriptPoints, type Prescript, type PrescriptCard, type PrescriptGoal, type PrescriptRun, type PrescriptScope } from '@/lib/fun/prescript'
import type { PrescriptOffer } from '@/lib/hooks/usePrescript'
import styles from './prescript.module.css'

const ASSET = '/assets/fun/prescript'
const POINTS = [0, 5, 10, 20, 35, 60]

/** One cell of the game's 5x7 prescript glyph sheet (Fx_T_Shape_Retro_Number, 13x5 cells), picked at random. */
const cell = () => { const i = Math.floor(Math.random() * 65); return `${(i % 13) / 12 * 100}% ${Math.floor(i / 13) / 4 * 100}%` }

/** How long the glyphs roll before the letters come, and how long the letters take: the sounds follow the same clock. */
const ROLL = 800, SETTLE = 800

/** The two arrival sounds, fetched once when the stage is first drawn so they are not late on the first prescript. */
let sounds: { first: HTMLAudioElement; second: HTMLAudioElement } | null = null
function loadSounds() {
  try {
    if (!sounds) {
      sounds = { first: new Audio(`${ASSET}/index_message_1.ogg`), second: new Audio(`${ASSET}/index_message_2.ogg`) }
      for (const audio of [sounds.first, sounds.second]) { audio.preload = 'auto'; audio.volume = 0.5; audio.load() }
    }
  } catch { /* no audio: the prescript still shows */ }
  return sounds
}

/** The prescript arriving (Fx_Mon_Index_Buff_BuffScript_IndexPrescript_Ex): sound 1 while the glyphs roll, then sound 2 eight
 * times, 0.1 s apart, while the letters settle. */
function playArrival(): () => void {
  const timers: number[] = []
  const loaded = loadSounds()
  if (!loaded) return () => {}
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

interface Part { text: string; em: boolean }
/** A label's marked names and numbers (\u0001…\u0002) as parts to set apart. */
const partsOf = (text: string): Part[] => text.split(/(\u0001[^\u0002]*\u0002)/).filter(Boolean)
  .map(piece => piece.startsWith('\u0001') ? { text: piece.slice(1, -1), em: true } : { text: piece, em: false })
const plain = (text: string) => text.replace(/[\u0001\u0002]/g, '')

/** The prescript text itself: every letter a rolling glyph for `roll` ms, then changing into the text letter by letter over
 * `ms`; still without them, and at once when motion is reduced. */
function Settle({ parts, roll, ms }: { parts: Part[]; roll?: number; ms?: number }) {
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
    return part.em ? <b key={i} className={styles.em}>{body}</b> : <span key={i}>{body}</span>
  })}</span>
}

const Flower = () => <svg viewBox="-12 -12 24 24" aria-hidden="true"><g fill="#3d7fe0">{[0, 72, 144, 216, 288].map(r =>
  <ellipse key={r} cx="0" cy="-6" rx="3.6" ry="6" transform={`rotate(${r})`} />)}</g><circle r="2" fill="#f1f4f8" /></svg>

const KIND: Record<PrescriptGoal['kind'], string> = {
  'sell-keyword': 'kind_sell', 'sell-tier': 'kind_sell', 'fuse-gift': 'kind_fuse', 'fuse-tier': 'kind_fuse', 'get-keyword': 'kind_gather',
  'no-sale': 'kind_floor', 'pick-theme': 'kind_theme', 'buy-gift': 'kind_shop', 'buy-leftmost': 'kind_shop',
}

interface Props {
  run: PrescriptRun
  offers: PrescriptOffer[]
  label: (goal: PrescriptGoal) => string
  onChoose: (card: PrescriptCard) => void
  onReroll: (scope: PrescriptScope) => boolean
  onRefuse: (scope: PrescriptScope) => void
  /** The PiP shows the stage and what is held, without the record. */
  pip?: boolean
}

export default function PrescriptStage({ run, offers, label, onChoose, onReroll, onRefuse, pip = false }: Props) {
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
  const held = run.prescripts.filter(p => p.status === 'active')
  const settled = run.prescripts.filter(p => p.status !== 'active').slice().reverse()
  // the game's form: the order in 【】, then its deadline (Faust: "기한은 여섯 달 이내")
  // a pack prescript is due on its own floor, whatever kind it came as
  const deadline = (goal: PrescriptGoal, scope: PrescriptScope) => goal.kind === 'pick-theme' ? t('deadline_pick', { floor: goal.floor }) : t(`deadline_${scope}`)
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
        {t(offer ? 'arrived' : 'waiting')}
      </p>
      {offer && <>
        <div className={styles.cards} role="group" aria-label={t(offer.scope)}>
          {offer.cards.map(card => {
            const points = prescriptPoints(card.strength, card.scope, run.streak + 1)
            return <button key={JSON.stringify(card.goal)} type="button" className={styles.c} onClick={() => onChoose(card)}
              aria-label={t('cardLabel', { strength: card.strength, kind: t(KIND[card.goal.kind]), points, text: quote(card.goal, card.scope) })}>
              <div className={styles.ban}>{t(offer.scope)}</div>
              <div className={styles.lv}><b>{card.strength}</b>{Array.from({ length: card.strength }, (_, i) => <Flower key={i} />)}</div>
              <div className={styles.d}>{text(card.goal, card.scope, ROLL, SETTLE)}</div>
              <div className={styles.f}><span>{t(KIND[card.goal.kind])}</span><b>{points}</b></div>
            </button>
          })}
        </div>
        <div className={styles.acts}>
          <button type="button" className={styles.b} disabled={run.rerollsLeft === 0} onClick={() => onReroll(offer.scope)}>{t('reroll', { count: run.rerollsLeft })}</button>
          <button type="button" className={styles.b} onClick={() => onRefuse(offer.scope)}>{t('refuse')}</button>
        </div>
      </>}
    </section>

    <h2 className={styles.sect}>{t('held')}</h2>
    {held.length ? <ul className={styles.held} data-prescript-held>
      {held.map(p => <li key={p.id} className={styles.h}>
        <span className={styles.k}>{t(p.scope)}</span>
        <span className={styles.tx}><span className="sr-only">{quote(p.goal, p.scope)}</span>{text(p.goal, p.scope)}</span>
        <span className={styles.p}>{progress(p) || POINTS[p.strength]}</span>
      </li>)}
    </ul> : <p className={styles.empty}>{t('noneHeld')}</p>}

    {!pip && <>
      <h2 className={styles.sect}>{t('record')}</h2>
      <div className={styles.log} data-prescript-log>
        {settled.length ? settled.map(p => <div key={p.id} className={styles.row}>
          <span className={styles.fl}>{p.floor}F</span>
          <span className={styles.tx}><span className="sr-only">{quote(p.goal, p.scope)}</span>{text(p.goal, p.scope)}{p.status === 'void' && p.reason && <span className={styles.why}>{t(`void_${p.reason.replace(/-/g, '_')}`)}</span>}</span>
          <span className={`${styles.rs} ${p.status === 'done' ? styles.ok : p.status === 'failed' ? styles.no : styles.re}`}>{t(`status_${p.status}`)}</span>
          <span className={styles.sc}>{p.status === 'done' ? `+${p.points}` : ''}</span>
        </div>) : <p className={styles.empty}>{t('noRecord')}</p>}
      </div>
    </>}
  </div>
}

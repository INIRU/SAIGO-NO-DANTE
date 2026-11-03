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

/** The prescript arriving (Fx_Mon_Index_Buff_BuffScript_IndexPrescript_Ex): 0.6 s, sound 1; 0.8 s later sound 2 eight times, 0.1 s apart. */
function playArrival(): () => void {
  const timers: number[] = []
  try {
    const first = new Audio(`${ASSET}/index_message_1.ogg`), second = new Audio(`${ASSET}/index_message_2.ogg`)
    first.volume = second.volume = 0.5
    timers.push(window.setTimeout(() => { void first.play().catch(() => {}) }, 600))
    timers.push(window.setTimeout(() => {
      first.pause()
      for (let i = 0; i < 8; i++) timers.push(window.setTimeout(() => { second.currentTime = 0; void second.play().catch(() => {}) }, i * 100))
    }, 1400))
  } catch { /* no audio: the prescript still shows */ }
  return () => timers.forEach(window.clearTimeout)
}

/** Text settling letter by letter out of glyph cells; at once when motion is reduced. */
function Settle({ text, ms }: { text: string; ms: number }) {
  const [settled, setSettled] = useState(text.length)
  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) { setSettled(text.length); return }
    const start = performance.now()
    let frame = 0
    const step = (now: number) => {
      const k = Math.floor(Math.min(1, (now - start) / ms) * text.length)
      setSettled(k)
      if (k < text.length) frame = requestAnimationFrame(step)
    }
    setSettled(0)
    frame = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frame)
  }, [text, ms])
  return <span aria-hidden="true">{[...text].map((c, i) => i < settled || c === ' ' ? c
    : <span key={i} className={styles.gli} style={{ backgroundPosition: cell() }} />)}</span>
}

/** The glyph strip that runs while a prescript comes through. */
function Wire({ on }: { on: boolean }) {
  const [cells, setCells] = useState<string[]>([])
  useEffect(() => {
    if (!on || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) { setCells([]); return }
    const id = window.setInterval(() => setCells(Array.from({ length: 40 }, cell)), 50)
    return () => window.clearInterval(id)
  }, [on])
  return <div className={styles.wire} aria-hidden="true">{cells.map((p, i) => <span key={i} className={styles.gl} style={{ backgroundPosition: p }} />)}</div>
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
  const [arriving, setArriving] = useState(false)
  const cued = useRef('')
  useEffect(() => {
    if (!offerKey || offerKey === cued.current) return
    cued.current = offerKey
    setArriving(true)
    const stop = pip ? () => {} : playArrival()
    const done = window.setTimeout(() => setArriving(false), 1600)
    return () => { stop(); window.clearTimeout(done) }
  }, [offerKey, pip])
  const held = run.prescripts.filter(p => p.status === 'active')
  const settled = run.prescripts.filter(p => p.status !== 'active').slice().reverse()
  // the game's form: the order, then its deadline (Faust: "기한은 여섯 달 이내"), inside 【】
  const quote = (goal: PrescriptGoal, scope: PrescriptScope) => `【${label(goal)}. ${t(`deadline_${scope}`)}】`
  const progress = (p: Prescript) => p.goal.kind === 'get-keyword' ? `${p.progress}/${p.goal.count}` : ''

  return <div className={pip ? styles.pip : undefined}>
    <section className={`${styles.stage} ${offer ? styles.on : ''} ${arriving ? styles.rolling : ''}`} aria-live="polite" data-prescript-stage>
      {/* eslint-disable-next-line @next/next/no-img-element -- a small game emblem from public/ */}
      <img className={styles.mark} src={`${ASSET}/index_emblem_color_256.png`} alt="" width={92} height={92} />
      <Wire on={arriving} />
      <p className={styles.call}>{offer ? <><span className="sr-only">{t('arrived')}</span><Settle text={t('arrived')} ms={900} /></> : t('waiting')}</p>
      {offer && <>
        <div className={styles.cards} role="group" aria-label={t(offer.scope)}>
          {offer.cards.map(card => {
            const text = quote(card.goal, card.scope)
            const points = prescriptPoints(card.strength, card.scope, run.streak + 1)
            return <button key={JSON.stringify(card.goal)} type="button" className={styles.c} onClick={() => onChoose(card)}
              aria-label={t('cardLabel', { strength: card.strength, kind: t(KIND[card.goal.kind]), points, text })}>
              <div className={styles.ban}>{t(offer.scope)}</div>
              <div className={styles.lv}><b>{card.strength}</b>{Array.from({ length: card.strength }, (_, i) => <Flower key={i} />)}</div>
              <div className={styles.d}><Settle text={text} ms={800} /></div>
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
        <span className={styles.tx}>{quote(p.goal, p.scope)}</span>
        <span className={styles.p}>{progress(p) || POINTS[p.strength]}</span>
      </li>)}
    </ul> : <p className={styles.empty}>{t('noneHeld')}</p>}

    {!pip && <>
      <h2 className={styles.sect}>{t('record')}</h2>
      <div className={styles.log} data-prescript-log>
        {settled.length ? settled.map(p => <div key={p.id} className={styles.row}>
          <span className={styles.fl}>{p.floor}F</span>
          <span className={styles.tx}>{quote(p.goal, p.scope)}{p.status === 'void' && p.reason && <span className={styles.why}>{t(`void_${p.reason.replace(/-/g, '_')}`)}</span>}</span>
          <span className={`${styles.rs} ${p.status === 'done' ? styles.ok : p.status === 'failed' ? styles.no : styles.re}`}>{t(`status_${p.status}`)}</span>
          <span className={styles.sc}>{p.status === 'done' ? `+${p.points}` : ''}</span>
        </div>) : <p className={styles.empty}>{t('noRecord')}</p>}
      </div>
    </>}
  </div>
}

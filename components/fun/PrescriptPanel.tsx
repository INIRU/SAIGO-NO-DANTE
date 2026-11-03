'use client'

import { useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import type { Prescript, PrescriptCard, PrescriptGoal, PrescriptRun, PrescriptScope } from '@/lib/fun/prescript'
import type { PrescriptOffer } from '@/lib/hooks/usePrescript'

const ASSET = '/assets/fun/prescript'
const GLYPHS = 'ㄱㄴㄷㄹㅁㅂㅅㅇㅈㅊㅋㅌㅍㅎ0123456789#%&*+=<>?'
const STARS = ['★', '★★', '★★★', '★★★★', '★★★★★']

/** The game's prescript cue (AbilityEffect_IndexPrescript): sound 1, then at 0.45 s sound 1 stops and sound 2 plays. */
function playCue() {
  try {
    const first = new Audio(`${ASSET}/index_ad1.ogg`), second = new Audio(`${ASSET}/index_ad2.ogg`)
    first.volume = second.volume = 0.5
    void first.play().catch(() => {})
    window.setTimeout(() => { first.pause(); void second.play().catch(() => {}) }, 450)
  } catch { /* no audio: the prescript still shows */ }
}

/** The text settles letter by letter out of scrambled glyphs; shown at once when motion is reduced. */
function ScrambleText({ text }: { text: string }) {
  const [shown, setShown] = useState(text)
  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) { setShown(text); return }
    const start = performance.now(), length = 700
    let frame = 0
    const step = (now: number) => {
      const settled = Math.floor(Math.min(1, (now - start) / length) * text.length)
      setShown(text.slice(0, settled) + [...text.slice(settled)].map(c => c === ' ' ? ' ' : GLYPHS[Math.floor(Math.random() * GLYPHS.length)]).join(''))
      if (settled < text.length) frame = requestAnimationFrame(step)
    }
    frame = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frame)
  }, [text])
  return <span aria-hidden="true">{shown}</span>
}

interface Props {
  run: PrescriptRun
  offers: PrescriptOffer[]
  label: (goal: PrescriptGoal) => string
  onChoose: (card: PrescriptCard) => void
  onReroll: (scope: PrescriptScope) => boolean
  onRefuse: (scope: PrescriptScope) => void
  /** The PiP shows the cards and what is active, without the record. */
  compact?: boolean
}

export default function PrescriptPanel({ run, offers, label, onChoose, onReroll, onRefuse, compact = false }: Props) {
  const t = useTranslations('prescriptMode')
  const cueFor = useRef('')
  const offerKey = offers.map(o => `${o.scope}:${o.floor}:${o.cards.map(c => JSON.stringify(c.goal)).join('|')}`).join(',')
  useEffect(() => { if (offerKey && offerKey !== cueFor.current && !compact) { cueFor.current = offerKey; playCue() } }, [offerKey, compact])
  const active = run.prescripts.filter(p => p.status === 'active')
  const settled = run.prescripts.filter(p => p.status !== 'active').slice().reverse()
  const scopeName = (scope: PrescriptScope) => t(scope)
  const progressText = (p: Prescript) => p.goal.kind === 'get-keyword' ? ` (${p.progress}/${p.goal.count})` : ''

  return <section data-prescript-panel aria-label={t('title')} className="rounded-lg border border-[var(--border)] bg-[var(--bg-card)] p-3">
    <header className="flex flex-wrap items-center gap-x-3 gap-y-1">
      {/* eslint-disable-next-line @next/next/no-img-element -- a small game emblem from public/ */}
      <img src={`${ASSET}/index_emblem_color_256.png`} alt="" width={28} height={28} className="h-7 w-7 shrink-0 object-contain" />
      <h2 className="font-[family-name:var(--font-heading)] text-base text-[var(--gold-light)]">{t('title')}</h2>
      <p className="ml-auto text-xs text-[var(--text-secondary)]" data-prescript-score>
        {t('score', { score: run.score })} · {t('streak', { count: run.streak })} · {t('rerolls', { count: run.rerollsLeft })}
      </p>
    </header>

    {offers.map(o => <div key={o.scope} role="group" aria-label={t('offerTitle', { scope: scopeName(o.scope) })} data-prescript-offer={o.scope} className="mt-3">
      <p className="mb-1.5 text-xs font-bold text-[var(--gold-light)]">{t('offerTitle', { scope: scopeName(o.scope) })}</p>
      <div className={`grid gap-2 ${compact ? 'grid-cols-1' : 'sm:grid-cols-3'}`}>
        {o.cards.map(card => {
          const text = label(card.goal)
          return <button key={JSON.stringify(card.goal)} type="button" onClick={() => onChoose(card)}
            className="min-h-11 rounded-md border border-[var(--border-gold)] bg-[var(--bg-panel)] p-2 text-left hover:border-[var(--gold)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--gold-light)]">
            <span className="block text-[0.6875rem] text-[var(--gold)]">{STARS[card.strength - 1]} {t(`strength${card.strength}`)}</span>
            <span className="mt-0.5 block break-keep text-sm leading-5 text-[var(--text-primary)]"><span className="sr-only">{text}</span><ScrambleText text={text} /></span>
          </button>
        })}
      </div>
      <div className="mt-1.5 flex gap-2 text-xs">
        <button type="button" disabled={run.rerollsLeft === 0} onClick={() => onReroll(o.scope)}
          className="min-h-9 rounded-md border border-[var(--border)] px-3 text-[var(--text-secondary)] hover:text-[var(--text-primary)] disabled:text-[var(--text-muted)] focus-visible:outline-2 focus-visible:outline-[var(--gold-light)]">{t('reroll')}</button>
        <button type="button" onClick={() => onRefuse(o.scope)}
          className="min-h-9 rounded-md border border-[var(--border)] px-3 text-[var(--text-secondary)] hover:text-[var(--text-primary)] focus-visible:outline-2 focus-visible:outline-[var(--gold-light)]">{t('refuse')}</button>
      </div>
    </div>)}

    {active.length > 0 && <ul className="mt-3 space-y-1.5" data-prescript-active>
      {active.map(p => <li key={p.id} className="rounded-md border border-[var(--border)] bg-[var(--bg-panel)] px-2.5 py-1.5 text-sm">
        <span className="mr-2 text-[0.6875rem] font-bold text-[var(--gold)]">{scopeName(p.scope)} {STARS[p.strength - 1]}</span>
        <span className="break-keep text-[var(--text-primary)]">{label(p.goal)}{progressText(p)}</span>
      </li>)}
    </ul>}
    {!offers.length && !active.length && <p className="mt-3 text-xs text-[var(--text-secondary)]">{t('waiting')}</p>}

    {!compact && settled.length > 0 && <details className="mt-3 text-xs" data-prescript-log>
      <summary className="cursor-pointer text-[var(--text-secondary)]">{t('log', { count: settled.length })}</summary>
      <ul className="mt-1.5 space-y-1">
        {settled.map(p => <li key={p.id} className="flex gap-2">
          <span className={p.status === 'done' ? 'text-[var(--gold-light)]' : p.status === 'failed' ? 'text-[var(--error-text)]' : 'text-[var(--text-muted)]'}>
            {t(`status_${p.status}`)}{p.status === 'done' ? ` +${p.points}` : ''}
          </span>
          <span className="min-w-0 break-keep text-[var(--text-secondary)]">{p.floor}F · {label(p.goal)}{p.status === 'void' && p.reason ? ` — ${t(`void_${p.reason.replace(/-/g, '_')}`)}` : ''}</span>
        </li>)}
      </ul>
    </details>}
  </section>
}

'use client'

import { useEffect, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Play, Square } from 'lucide-react'
import Switch from '@/components/ui/Switch'
import QuietImage from '@/components/ui/QuietImage'
import { mostDead, pickLinkState, toggleDeadState, type MotionPartner, type MotionState } from '@/lib/motion/catalog'
import type { VoiceLink } from '@/lib/motion/soundbuttons'
import styles from './MotionDeck.module.css'

const fullName = (p: MotionPartner) => (p.sinner ? `${p.name} ${p.sinner}` : p.name)
const row = 'flex min-h-11 w-full items-center gap-3 rounded-md px-3 py-2 text-left text-[0.9375rem] leading-snug transition-[color,background-color] duration-150 hover:bg-[rgba(200,144,10,0.06)] hover:text-[var(--text-primary)] aria-pressed:bg-[rgba(200,144,10,0.12)] aria-pressed:text-[var(--gold-light)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--gold-light)] text-[var(--text-secondary)] motion-reduce:transition-none'

function Face({ person }: { person: MotionPartner }) {
  return <span className={styles.face}>{person.portrait && <QuietImage src={person.portrait} alt="" fill sizes="4.5rem" />}</span>
}

/**
 * One line per video of a skill. A link is one line with its partners' faces, whose normal and max videos are one switch
 * under the chosen line; the dead allies of 공간참 - 잔 are portrait cards to turn on and off; the identity's link lines
 * (voice_links.json) follow as sound buttons.
 */
export default function MotionScenarios({ states, current, onPick, voices, onVoice, onVoiceStop }: {
  states: readonly MotionState[]
  current: string
  onPick: (state: string) => void
  /** The link lines of this identity. */
  voices: readonly VoiceLink[]
  /** Plays a line (inside the press); resolves when it ends or is stopped. */
  onVoice: (link: VoiceLink) => Promise<void>
  onVoiceStop: () => void
}) {
  const t = useTranslations('motionPage')
  const lang = useLocale()
  const plain = states.filter(s => !s.link && !s.dead)
  const links = [...new Map(states.flatMap(s => (s.link ? [[s.link.id, s.link] as const] : []))).values()]
  const cards = mostDead(states)?.dead ?? []
  const shown = states.find(s => s.state === current)
  const dead = new Set(shown?.dead?.map(d => d.gameId))
  const chosen = shown?.link
  const pickLink = (id: string, max: boolean) => {
    const next = pickLinkState(states, id, max)
    if (next) onPick(next.state)
  }
  const toggleDead = (gameId: string) => {
    const next = toggleDeadState(states, current, gameId)
    if (next) onPick(next)
  }
  // The line playing; another skill (this component's key) stops it.
  const [speaking, setSpeaking] = useState<string | null>(null)
  useEffect(() => onVoiceStop, [onVoiceStop])
  const speak = (line: VoiceLink) => {
    if (speaking === line.id) { onVoiceStop(); setSpeaking(null); return }
    setSpeaking(line.id)
    void onVoice(line).then(() => setSpeaking(id => (id === line.id ? null : id)))
  }

  return (
    <div className="flex flex-col gap-4">
      <div role="group" aria-label={t('scenarios')} className="flex flex-col">
        {plain.map(s => <button key={s.state} type="button" aria-pressed={s.state === current} data-scenario={s.state} title={s.label} className={row} onClick={() => onPick(s.state)}><span className="min-w-0 flex-1 break-keep">{s.label}</span></button>)}
        {links.map(l => {
          const names = l.partners.map(fullName).join(' · ')
          return (
            <div key={l.id}>
              <button type="button" aria-pressed={chosen?.id === l.id} data-partner={l.id} title={names} className={row} onClick={() => pickLink(l.id, chosen?.max ?? false)}>
                <span className="grid shrink-0 grid-flow-col gap-1" style={{ gridAutoColumns: '2rem' }}>{l.partners.map(p => <Face key={p.gameId} person={p} />)}</span>
                <span className="min-w-0 flex-1 break-keep">{names}</span>
              </button>
              {chosen?.id === l.id && (
                <label className={`${styles.maxSwitch} w-full justify-between px-3 py-2`} data-on={chosen.max || undefined}>
                  <span>{t('maxState')}</span>
                  <Switch size="sm" checked={chosen.max} onChange={() => pickLink(l.id, !chosen.max)} />
                </label>
              )}
            </div>
          )
        })}
      </div>
      {cards.length > 0 && (
        <section aria-label={t('deadAllies')} className="px-3">
          <h3 className="mb-2 text-[0.8125rem] text-[var(--text-tertiary)]">{t('deadAllies')}</h3>
          <div className={styles.partners}>
            {cards.map(p => (
              <button key={p.gameId} type="button" aria-pressed={dead.has(p.gameId)} data-dead={p.gameId} aria-label={fullName(p)} title={fullName(p)} className={styles.partner} onClick={() => toggleDead(p.gameId)}>
                <span className={styles.faces}><Face person={p} /></span>
                <span>{p.sinner ?? p.name}</span>
              </button>
            ))}
          </div>
        </section>
      )}
      {voices.length > 0 && (
        <section aria-label={t('voiceLines')} className="border-t border-[#2e2417] pt-3">
          <h3 className="mb-1 px-3 text-[0.8125rem] text-[var(--text-tertiary)]">{t('voiceLines')}</h3>
          {voices.map(line => {
            const label = (lang === 'ko' ? line.label : line.labelEn) || line.label
            const Icon = speaking === line.id ? Square : Play
            return (
              <button key={line.id} type="button" aria-pressed={speaking === line.id} data-voice={line.id} title={label} className={row} onClick={() => speak(line)}>
                <Icon className="h-3.5 w-3.5 shrink-0 fill-current" aria-hidden="true" />
                <span className="min-w-0 flex-1 break-keep">{label}</span>
              </button>
            )
          })}
        </section>
      )}
    </div>
  )
}

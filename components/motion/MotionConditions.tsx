'use client'

import { useEffect, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Play, Square } from 'lucide-react'
import { FilterChoice, FilterSection, filterStyles } from '@/components/board/FilterControls'
import Switch from '@/components/ui/Switch'
import QuietImage from '@/components/ui/QuietImage'
import { mostDead, pickLinkState, toggleDeadState, type MotionPartner, type MotionState } from '@/lib/motion/catalog'
import type { VoiceLink } from '@/lib/motion/soundbuttons'
import styles from './MotionDeck.module.css'

const fullName = (p: MotionPartner) => (p.sinner ? `${p.name} ${p.sinner}` : p.name)

/** A portrait tile: one face per identity, side by side, the sinners under them. */
function Faces({ people }: { people: readonly MotionPartner[] }) {
  return <>
    <span className={styles.faces}>
      {people.map(p => <span key={p.gameId} className={styles.face}>{p.portrait && <QuietImage src={p.portrait} alt="" fill sizes="4.5rem" />}</span>)}
    </span>
    <span>{people.map(p => p.sinner ?? p.name).join(' · ')}</span>
  </>
}

/**
 * A skill's conditions under its name: its own states as text choices (기본, a buff, 최고 상태); the dead 아비 of
 * 공간참 - 잔 as portrait cards to turn on and off; its links as one portrait tile per link (every partner's face), with one
 * switch between a link's normal and max video; and the identity's link lines (voice_links.json) as sound buttons.
 */
export default function MotionConditions({ states, current, onPick, voices, onVoice, onVoiceStop }: {
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
  const dead = new Set(states.find(s => s.state === current)?.dead?.map(d => d.gameId))
  const chosen = states.find(s => s.state === current)?.link
  // With no link playing, the switch holds the choice for the next link pressed.
  const [wantMax, setWantMax] = useState(false)
  const max = chosen ? chosen.max : wantMax
  const pickLink = (id: string, toMax: boolean) => {
    const next = pickLinkState(states, id, toMax)
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
    <div className={styles.conditions}>
      {(plain.length > 1 || (plain.length > 0 && (links.length > 0 || cards.length > 0))) && (
        <div role="group" aria-label={t('states')} className={filterStyles.choices}>
          {plain.map(s => <FilterChoice key={s.state} active={s.state === current} title={s.label} onClick={() => onPick(s.state)}>{s.label}</FilterChoice>)}
        </div>
      )}
      {cards.length > 0 && (
        <FilterSection label={t('deadAllies')}>
          <div className={styles.partners}>
            {cards.map(p => (
              <button key={p.gameId} type="button" aria-pressed={dead.has(p.gameId)} data-dead={p.gameId} aria-label={fullName(p)} title={fullName(p)}
                className={styles.partner} onClick={() => toggleDead(p.gameId)}>
                <Faces people={[p]} />
              </button>
            ))}
          </div>
        </FilterSection>
      )}
      {(links.length > 0 || voices.length > 0) && (
        <FilterSection label={t('link')} end={links.length > 0 && (
          <label className={styles.maxSwitch} data-on={max || undefined}>
            <span>{t('maxState')}</span>
            <Switch size="sm" checked={max} onChange={() => (chosen ? pickLink(chosen.id, !max) : setWantMax(!max))} />
          </label>
        )}>
          {links.length > 0 && (
            <div className={styles.partners}>
              {links.map(l => (
                <button key={l.id} type="button" aria-pressed={chosen?.id === l.id} aria-label={l.partners.map(fullName).join(' · ')} data-partner={l.id} title={l.partners.map(fullName).join(' · ')}
                  className={styles.partner} style={l.partners.length > 1 ? { gridColumn: `span ${l.partners.length}` } : undefined} onClick={() => pickLink(l.id, max)}>
                  <Faces people={l.partners} />
                </button>
              ))}
            </div>
          )}
          {voices.length > 0 && (
            <div className={`${filterStyles.choices} ${links.length > 0 ? 'mt-3' : ''}`}>
              {voices.map(line => {
                const label = (lang === 'ko' ? line.label : line.labelEn) || line.label
                return (
                  <FilterChoice key={line.id} active={speaking === line.id} data-voice={line.id} title={label} onClick={() => speak(line)}>
                    {speaking === line.id ? <Square className="mr-1.5 inline h-3.5 w-3.5 fill-current align-[-0.125rem]" aria-hidden="true" /> : <Play className="mr-1.5 inline h-3.5 w-3.5 fill-current align-[-0.125rem]" aria-hidden="true" />}
                    {label}
                  </FilterChoice>
                )
              })}
            </div>
          )}
        </FilterSection>
      )}
    </div>
  )
}

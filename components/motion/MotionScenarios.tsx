'use client'

import { useEffect, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Play, Square } from 'lucide-react'
import Switch from '@/components/ui/Switch'
import QuietImage from '@/components/ui/QuietImage'
import { isBase, pickLinkState, type MotionPartner, type MotionState } from '@/lib/motion/catalog'
import type { VoiceLink } from '@/lib/motion/soundbuttons'
import styles from './MotionDeck.module.css'

const fullName = (p: MotionPartner) => (p.sinner ? `${p.name} ${p.sinner}` : p.name)
const row = 'flex min-h-11 w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-[0.9375rem] leading-snug transition-[color,background-color] duration-150 hover:bg-[rgba(200,144,10,0.06)] hover:text-[var(--text-primary)] aria-pressed:bg-[rgba(200,144,10,0.12)] aria-pressed:text-[var(--gold-light)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--gold-light)] text-[var(--text-secondary)] motion-reduce:transition-none'

function Face({ person, dead }: { person: MotionPartner; dead?: boolean }) {
  return <span data-dead={dead || undefined} title={fullName(person)} className={styles.face}>{person.portrait && <QuietImage src={person.portrait} alt="" fill sizes="2rem" />}</span>
}

const Faces = ({ people, dead }: { people: readonly MotionPartner[]; dead?: boolean }) => people.length > 0 && <span className="flex shrink-0 -space-x-2">{people.map(p => <Face key={p.gameId} person={p} dead={dead} />)}</span>

const peopleOf = (state: MotionState, ally?: MotionPartner) => { const person = state.ally ?? ally; return person ? [person] : state.dead ?? [] }
/** What identifies a scenario on screen: two scenarios the same in it need their own text. */
const signature = (state: MotionState, ally?: MotionPartner) => [peopleOf(state, ally).map(p => p.gameId), state.conditions?.map(c => [c.name, c.stack]), state.extras]

/**
 * A scenario in values of the game only, so it reads in every language: the faces, then each buff's icon, name and stack,
 * then the words of its labelKey. `fallback` is for the few the data says nothing about.
 */
function Scenario({ state, ally, fallback, current, onPick }: { state: MotionState; ally?: MotionPartner; fallback: string | null; current: boolean; onPick: () => void }) {
  const t = useTranslations('motionPage')
  const people = peopleOf(state, ally)
  const buffs = isBase(state.state) ? [] : state.conditions ?? []
  const extras = isBase(state.state) ? [] : state.extras ?? []
  const text = fallback ?? (isBase(state.state) ? t('normal') : !buffs.length && !extras.length ? people.map(p => p.sinner ?? p.name).join(' · ') : null)
  return (
    <button type="button" aria-pressed={current} data-scenario={state.state} className={row} onClick={onPick}>
      <Faces people={people} dead={!state.ally && !ally && Boolean(state.dead?.length)} />
      <span className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1">
        {!fallback && buffs.map(c => (
          <span key={c.name} data-condition={c.name} className="inline-flex items-center gap-1.5">
            {c.icon && <span className="relative h-6 w-6 shrink-0"><QuietImage src={c.icon} alt="" fill sizes="1.5rem" className="object-contain" /></span>}
            <span className="break-keep">{c.name}</span>
            {c.stack && <span className="font-[family-name:var(--font-title)] text-[1rem] tabular-nums tracking-wide">{c.stack}</span>}
          </span>
        ))}
        {!fallback && extras.map(extra => (
          <span key={extra.text} className="inline-flex items-center gap-1.5">
            {extra.icon && <span className="relative h-6 w-6 shrink-0"><QuietImage src={extra.icon} alt="" fill sizes="1.5rem" className="object-contain" /></span>}
            <span className="break-keep">{extra.text}</span>
          </span>
        ))}
        {text && <span className="break-keep">{text}</span>}
      </span>
    </button>
  )
}

/**
 * One line per video of a skill, in one list. A link is one line whose normal and max videos are one switch under the
 * chosen line; the identity's link lines (voice_links.json) follow as sound buttons.
 */
export default function MotionScenarios({ states, current, allies, onPick, voices, onVoice, onVoiceStop }: {
  states: readonly MotionState[]
  current: string
  /** The allies of the cut-in scenarios, by state. */
  allies?: Readonly<Record<string, MotionPartner>>
  onPick: (state: string) => void
  /** The link lines of this identity. */
  voices: readonly VoiceLink[]
  /** Plays a line (inside the press); resolves when it ends or is stopped. */
  onVoice: (link: VoiceLink) => Promise<void>
  onVoiceStop: () => void
}) {
  const t = useTranslations('motionPage')
  const lang = useLocale()
  const plain = states.filter(s => !s.link)
  const signatures = plain.map(s => JSON.stringify(signature(s, allies?.[s.state])))
  // The data says nothing about it, or the same as another: the index's sentence in Korean, a number elsewhere.
  const fallback = (s: MotionState, k: number) => {
    const told = isBase(s.state) || s.conditions?.length || s.extras?.length || peopleOf(s, allies?.[s.state]).length
    if (told && signatures.indexOf(signatures[k]) === signatures.lastIndexOf(signatures[k])) return null
    return lang === 'ko' ? s.label : t('scenarioNumber', { n: k + 1 })
  }
  const links = [...new Map(states.flatMap(s => (s.link ? [[s.link.id, s.link] as const] : []))).values()]
  const chosen = states.find(s => s.state === current)?.link
  const pickLink = (id: string, max: boolean) => {
    const next = pickLinkState(states, id, max)
    if (next) onPick(next.state)
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
    <div className="flex flex-col">
      {plain.map((s, k) => <Scenario key={s.state} state={s} ally={allies?.[s.state]} fallback={fallback(s, k)} current={s.state === current} onPick={() => onPick(s.state)} />)}
      {links.map(l => {
        const names = l.partners.map(fullName).join(' · ')
        return (
          <div key={l.id}>
            <button type="button" aria-pressed={chosen?.id === l.id} data-partner={l.id} className={row} onClick={() => pickLink(l.id, chosen?.max ?? false)}>
              <Faces people={l.partners} />
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
    </div>
  )
}

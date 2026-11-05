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
const row = `${styles.scenario} hit-target`

/** A face of a scenario: an ally who plays along, or one dead in it (grey). */
type FaceOf = { person: MotionPartner; dead?: boolean }

function Face({ person, dead }: FaceOf) {
  return <span data-dead={dead || undefined} title={fullName(person)} className={styles.face}>{person.portrait && <QuietImage src={person.portrait} alt="" fill sizes="2rem" />}</span>
}

/** One face full size; two to four as a small 2×2 group in the same square, so the column keeps one width. */
const Faces = ({ faces }: { faces: readonly FaceOf[] }) => (
  <span data-many={faces.length > 1 || undefined} className={styles.faces}>{faces.slice(0, 4).map(f => <Face key={f.person.gameId} {...f} />)}</span>
)

/** A buff, a sin's resonance or a word of the scenario, in one shape: its picture, its name, its value in the number font. */
function Chip({ icon, name, value }: { icon?: string | null; name: string; value?: string | null }) {
  return (
    <span data-plain={!icon || undefined} className={styles.chip}>
      {icon && <span className={styles.chipIcon}><QuietImage src={icon} alt="" fill sizes="1.5rem" className="object-contain" /></span>}
      <span className="break-keep">{name}</span>
      {value && <span className={styles.chipValue}>{value}</span>}
    </span>
  )
}

/** The allies of a scenario (its own, and a cut-in's from the video), each once, then the dead. */
const facesOf = (state: MotionState, ally?: MotionPartner): FaceOf[] => [
  ...[...(state.allies ?? []), ...(ally ? [ally] : [])].filter((p, k, all) => all.findIndex(q => q.gameId === p.gameId) === k).map(person => ({ person })),
  ...(state.dead ?? []).map(person => ({ person, dead: true })),
]
/** What identifies a scenario on screen: two scenarios the same in it need their own text. */
const signature = (state: MotionState, ally?: MotionPartner) => [facesOf(state, ally).map(f => [f.person.gameId, !!f.dead]), state.conditions?.map(c => [c.name, c.stack]), state.extras]
/** The faces column, when a row of the list has a face. */
const leadWidth = (faces: number) => (faces ? '2.5rem' : null)

/**
 * A scenario in values of the game only, so it reads in every language: the faces in a column of their own (so every row's
 * words start on one line), then each buff and word as a chip. `fallback` is for the few the data says nothing about.
 */
function Scenario({ state, ally, lead, fallback, current, onPick }: { state: MotionState; ally?: MotionPartner; lead: string | null; fallback: string | null; current: boolean; onPick: () => void }) {
  const t = useTranslations('motionPage')
  const faces = facesOf(state, ally)
  const buffs = isBase(state.state) ? [] : state.conditions ?? []
  const extras = isBase(state.state) ? [] : state.extras ?? []
  const text = fallback ?? (isBase(state.state) ? t('normal') : !buffs.length && !extras.length ? faces.map(f => f.person.sinner ?? f.person.name).join(', ') : null)
  return (
    <button type="button" aria-pressed={current} data-scenario={state.state} className={row} style={lead ? { gridTemplateColumns: `${lead} minmax(0, 1fr)` } : undefined} onClick={onPick}>
      {lead && <Faces faces={faces} />}
      <span className={styles.chips}>
        {!fallback && buffs.map(c => <span key={c.name} data-condition={c.name} className="contents"><Chip icon={c.icon} name={c.name} value={c.stack} /></span>)}
        {!fallback && extras.map(extra => <Chip key={extra.text} icon={extra.icon} name={extra.text} />)}
        {text && <span className={styles.scenarioText}>{text}</span>}
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
    const told = isBase(s.state) || s.conditions?.length || s.extras?.length || facesOf(s, allies?.[s.state]).length
    if (told && signatures.indexOf(signatures[k]) === signatures.lastIndexOf(signatures[k])) return null
    return lang === 'ko' ? s.sentence ?? s.label : t('scenarioNumber', { n: k + 1 })
  }
  const links = [...new Map(states.flatMap(s => (s.link ? [[s.link.id, s.link] as const] : []))).values()]
  // One faces column for the whole list (links included), as wide as its most faces; a play icon sits in it for a line.
  const lead = leadWidth(Math.max(0, ...plain.map(s => facesOf(s, allies?.[s.state]).length), ...links.map(l => l.partners.length)))
  const grid = lead ? { gridTemplateColumns: `${lead} minmax(0, 1fr)` } : undefined
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
    <div className={styles.scenarios}>
      {plain.map((s, k) => <Scenario key={s.state} state={s} ally={allies?.[s.state]} lead={lead} fallback={fallback(s, k)} current={s.state === current} onPick={() => onPick(s.state)} />)}
      {links.map(l => {
        const names = l.partners.map(fullName).join(', ')
        return (
          <div key={l.id}>
            <button type="button" aria-pressed={chosen?.id === l.id} data-partner={l.id} className={row} style={grid} onClick={() => pickLink(l.id, chosen?.max ?? false)}>
              {lead && <Faces faces={l.partners.map(person => ({ person }))} />}
              <span className={styles.scenarioText}>{names}</span>
            </button>
            {chosen?.id === l.id && (
              <label className={`${styles.maxSwitch} w-full justify-between py-2 pr-3`} style={{ paddingLeft: lead ? `calc(${lead} + 1.5rem)` : '0.75rem' }} data-on={chosen.max || undefined}>
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
          <button key={line.id} type="button" aria-pressed={speaking === line.id} data-voice={line.id} title={label} className={row} style={{ gridTemplateColumns: `${lead ?? '1rem'} minmax(0, 1fr)` }} onClick={() => speak(line)}>
            <span className="grid place-items-center"><Icon className="h-3.5 w-3.5 fill-current" aria-hidden="true" /></span>
            <span className={styles.scenarioText}>{label}</span>
          </button>
        )
      })}
    </div>
  )
}

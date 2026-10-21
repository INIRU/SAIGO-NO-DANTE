'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { FilterChoice, FilterSection, filterStyles } from '@/components/board/FilterControls'
import QuietImage from '@/components/ui/QuietImage'
import { pickLinkState, type MotionLink, type MotionState } from '@/lib/motion/catalog'
import styles from './MotionDeck.module.css'

/**
 * A skill's conditions under its name: its own states as text choices (기본, a buff, 최고 상태), and its links as one
 * portrait tile per identity it links with, with one switch between a link's normal and max video.
 */
export default function MotionConditions({ states, current, onPick }: { states: readonly MotionState[]; current: string; onPick: (state: string) => void }) {
  const t = useTranslations('motionPage')
  const plain = states.filter(s => !s.link)
  const partners = [...new Map(states.flatMap(s => (s.link ? [[s.link.gameId, s.link] as const] : []))).values()]
  const chosen = states.find(s => s.state === current)?.link
  // With no link playing, the switch holds the choice for the next partner pressed.
  const [wantMax, setWantMax] = useState(false)
  const max = chosen ? chosen.max : wantMax
  const pickPartner = (gameId: string, toMax: boolean) => {
    const next = pickLinkState(states, gameId, toMax)
    if (next) onPick(next.state)
  }
  const fullName = (p: MotionLink) => (p.sinner ? `${p.name} ${p.sinner}` : p.name)

  return (
    <div className={styles.conditions}>
      {(plain.length > 1 || (plain.length > 0 && partners.length > 0)) && (
        <div role="group" aria-label={t('states')} className={filterStyles.choices}>
          {plain.map(s => <FilterChoice key={s.state} active={s.state === current} title={s.label} onClick={() => onPick(s.state)}>{s.label}</FilterChoice>)}
        </div>
      )}
      {partners.length > 0 && (
        <FilterSection label={t('link')} end={
          <label className={styles.switch} data-on={max || undefined}>
            <span>{t('maxState')}</span>
            <input type="checkbox" role="switch" checked={max} onChange={() => (chosen ? pickPartner(chosen.gameId, !max) : setWantMax(!max))} />
          </label>
        }>
          <div className={styles.partners}>
            {partners.map(p => (
              <button key={p.gameId} type="button" aria-pressed={chosen?.gameId === p.gameId} aria-label={fullName(p)} data-partner={p.gameId} title={fullName(p)}
                className={styles.partner} onClick={() => pickPartner(p.gameId, max)}>
                <span className={styles.face}>{p.portrait && <QuietImage src={p.portrait} alt="" fill sizes="4.5rem" />}</span>
                <span>{p.sinner ?? p.name}</span>
              </button>
            ))}
          </div>
        </FilterSection>
      )}
    </div>
  )
}

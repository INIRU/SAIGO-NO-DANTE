'use client'

import Image from 'next/image'
import { useReducedMotion } from 'motion/react'
import * as m from 'motion/react-m'
import { useLocale, useTranslations } from 'next-intl'
import { RefreshCw } from 'lucide-react'
import IdentityFrameCard from '@/components/ui/IdentityFrameCard'
import { getEgoGradeBannerUrl, getSinnerLogoUrl } from '@/lib/utils/images'
import { SIN_COLORS, normalizeSin } from '@/lib/constants/sin'
import { getLocalizedName } from '@/lib/i18n'
import type { SupportedLang } from '@/lib/i18n/types'
import type { Sinner, Identity } from '@/lib/types'
import type { RandomResult } from '@/lib/random/engine'
import board from '@/components/decks/FormationBoard.module.css'
import styles from './random.module.css'

const GRADES = ['ZAYIN', 'TETH', 'HE', 'WAW', 'ALEPH']
const EASE = [0.22, 1, 0.36, 1] as const

/**
 * The 12 sinners on the formation board grid, as identity cards or as E.G.O slots (same cell size, so switching tabs
 * doesn't move anything). Empty slots hold their size before the first roll. A full roll flips the cells in one by one;
 * a reroll flips just that card.
 */
export default function ResultGrid({ sinners, pools, result, view, rollId, rerolledSinnerId, onReroll }: {
  sinners: Sinner[]
  pools: Record<string, Identity[]>
  result: RandomResult | null
  view: 'identity' | 'ego'
  rollId: number
  rerolledSinnerId: string | null
  onReroll: (sinnerId: string) => void
}) {
  const t = useTranslations('randomPage')
  const lang = useLocale() as SupportedLang
  const reduceMotion = useReducedMotion()
  const enter = (delay: number, from: Record<string, number>) => reduceMotion ? {} : {
    initial: { opacity: 0, ...from },
    animate: { opacity: 1, rotateY: 0, x: 0, y: 0 },
    transition: { duration: 0.42, delay, ease: EASE },
  }
  return (
    <ol className={`${board.grid} ${styles.board}`} id="random-board" role="tabpanel">
      {sinners.map((sinner, index) => {
        const sinnerName = getLocalizedName(sinner, lang)
        const delay = rerolledSinnerId === sinner.id ? 0 : index * 0.045
        if (view === 'ego') {
          const egos = result?.egos[sinner.id] ?? []
          return (
            <li key={sinner.id} className={styles.cell}>
              <div className={styles.egoCell}>
                <p className={styles.egoHead}>
                  <Image src={getSinnerLogoUrl(sinner.id)} alt="" width={20} height={20} />
                  <span>{sinnerName}</span>
                </p>
                <ul className={styles.egos}>
                  {GRADES.map(grade => {
                    const ego = egos.find(e => e.grade === grade)
                    const sin = normalizeSin(ego?.sin_affinity ?? null)
                    const egoName = ego ? getLocalizedName({ name_kr: ego.name_kr || ego.name, name_en: ego.name_en, name_jp: ego.name_jp }, lang) : ''
                    return (
                      <li key={grade} className={styles.ego} data-empty={!ego || undefined} style={sin ? { '--sin': SIN_COLORS[sin] } as React.CSSProperties : undefined}>
                        {ego ? (
                          <m.span key={`${rollId}:${ego.id}`} className={styles.egoBody} title={egoName} {...enter(delay, { x: -6 })}>
                            <span className={styles.thumb}>
                              {ego.image_url && <Image src={ego.image_url} alt="" width={64} height={64} className={styles.egoArt} />}
                              <Image src={getEgoGradeBannerUrl(grade)} alt={grade} width={48} height={22} unoptimized className={styles.grade} />
                            </span>
                            <span className={styles.egoName}>{egoName}</span>
                          </m.span>
                        ) : (
                          <span className={styles.egoBody}>
                            <span className={styles.thumb}><Image src={getEgoGradeBannerUrl(grade)} alt={grade} width={48} height={22} unoptimized className={styles.grade} /></span>
                          </span>
                        )}
                      </li>
                    )
                  })}
                </ul>
              </div>
            </li>
          )
        }
        const identity = result?.identities[sinner.id] ?? null
        const name = identity ? getLocalizedName(identity, lang) : ''
        const canReroll = (pools[sinner.id]?.length ?? 0) > 1
        return (
          <li key={sinner.id} className={styles.cell}>
            {identity ? (
              <m.button key={`${rollId}:${identity.id}`} type="button" className={`${board.tile} ${styles.card}`} {...enter(delay, { rotateY: -75, y: 6 })}
                onClick={() => onReroll(sinner.id)} disabled={!canReroll} aria-label={t('reroll', { name })} title={canReroll ? t('reroll', { name }) : name}>
                <IdentityFrameCard identity={identity} name={name} sizes="(max-width: 40rem) 30vw, 9rem" />
                {canReroll && <span className={styles.reroll} aria-hidden="true"><RefreshCw /></span>}
              </m.button>
            ) : (
              <span className={board.empty}><Image src={getSinnerLogoUrl(sinner.id)} alt={sinnerName} width={32} height={32} /></span>
            )}
          </li>
        )
      })}
    </ol>
  )
}

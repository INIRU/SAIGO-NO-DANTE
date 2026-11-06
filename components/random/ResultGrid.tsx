'use client'

import type { CSSProperties, Ref } from 'react'
import Image from 'next/image'
import { useLocale, useTranslations } from 'next-intl'
import { Lock, LockOpen, RefreshCw } from 'lucide-react'
import IdentityFrameCard from '@/features/catalog/components/IdentityFrameCard'
import { getEgoGradeBannerUrl, getSinnerLogoUrl } from '@/lib/utils/images'
import { SIN_COLORS, normalizeSin } from '@/lib/constants/sin'
import { getLocalizedName } from '@/lib/i18n'
import type { SupportedLang } from '@/lib/i18n/types'
import type { Sinner, Identity } from '@/lib/types'
import type { RandomResult } from '@/lib/random/engine'
import { EGO_GRADES, isRareEgo, isRareIdentity, revealRanks } from '@/lib/random/display'
import board from '@/components/decks/FormationBoard.module.css'
import styles from './random.module.css'

/**
 * The 12 sinners on the formation board grid, as identity cards or as E.G.O slots (same cell size, so switching tabs
 * doesn't move anything). Empty slots hold their size before the first roll. While `revealing`, the cards drawn by the
 * latest action (`fresh`) come in one by one in `--rank` order (CSS only); a lock button on every card keeps its
 * sinner as it is through the next roll. With a formation order the cards carry their number and SELECTED/BACKUP banner.
 */
export default function ResultGrid({ sinners, pools, result, view, revealing, fresh, stamps, marks, boardRef, onReroll, onToggleMark }: {
  sinners: Sinner[]
  pools: Record<string, Identity[]>
  result: RandomResult | null
  view: 'identity' | 'ego'
  revealing: boolean
  fresh: ReadonlySet<string>
  stamps: Record<string, number>
  marks: string[]
  boardRef?: Ref<HTMLOListElement>
  onReroll: (sinnerId: string) => void
  onToggleMark: (sinnerId: string) => void
}) {
  const t = useTranslations('randomPage')
  const lang = useLocale() as SupportedLang
  const sinnerIds = sinners.map(sinner => sinner.id)
  // Ranks only among the cards that come in, so a kept (locked) card leaves no gap in the sequence.
  const freshIds = sinnerIds.filter(id => fresh.has(id))
  const ranks = revealRanks(freshIds, result?.order?.filter(id => fresh.has(id)) ?? null)
  return (
    <ol className={`${board.grid} ${styles.board}`} id="random-board" role="tabpanel" ref={boardRef} data-reveal={revealing || undefined}>
      {sinners.map(sinner => {
        const sinnerName = getLocalizedName(sinner, lang)
        const locked = marks.includes(sinner.id)
        const cellProps = {
          className: styles.cell,
          'data-fresh': fresh.has(sinner.id) || undefined,
          'data-locked': locked || undefined,
          style: { '--rank': ranks[sinner.id] ?? 0 } as CSSProperties,
        }
        const lockButton = (name: string, className: string) => (
          <button type="button" className={className} aria-pressed={locked} aria-label={t(locked ? 'unlock' : 'lock', { name })} title={t(locked ? 'unlock' : 'lock', { name })}
            onClick={() => onToggleMark(sinner.id)} data-html2canvas-ignore="true">
            {locked ? <Lock aria-hidden="true" /> : <LockOpen aria-hidden="true" />}
          </button>
        )
        if (view === 'ego') {
          const egos = result?.egos[sinner.id] ?? []
          return (
            <li key={sinner.id} {...cellProps}>
              <div key={stamps[sinner.id]} className={styles.egoCell}>
                <p className={styles.egoHead}>
                  <Image src={getSinnerLogoUrl(sinner.id)} alt="" width={20} height={20} />
                  <span>{sinnerName}</span>
                  {egos.length > 0 && lockButton(sinnerName, styles.lockSmall)}
                </p>
                <ul className={styles.egos}>
                  {EGO_GRADES.map((grade, row) => {
                    const ego = egos.find(e => e.grade === grade)
                    const sin = normalizeSin(ego?.sin_affinity ?? null)
                    const egoName = ego ? getLocalizedName({ name_kr: ego.name_kr, name_en: ego.name_en, name_jp: ego.name_jp }, lang) : ''
                    return (
                      <li key={grade} className={styles.ego} data-empty={!ego || undefined} data-rare={isRareEgo(ego) || undefined}
                        style={{ '--row': row, ...(sin ? { '--sin': SIN_COLORS[sin] } : {}) } as CSSProperties}>
                        {ego ? (
                          <span className={styles.egoBody} title={egoName}>
                            <span className={styles.thumb}>
                              {ego.image_url && <Image src={ego.image_url} alt="" width={64} height={64} className={styles.egoArt} />}
                              <Image src={getEgoGradeBannerUrl(grade)} alt={grade} width={48} height={22} unoptimized className={styles.grade} />
                            </span>
                            <span className={styles.egoName}>{egoName}</span>
                          </span>
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
        const canReroll = (pools[sinner.id]?.length ?? 0) > 1 && !locked
        const number = result?.order ? result.order.indexOf(sinner.id) : -1
        return (
          <li key={sinner.id} {...cellProps}>
            {identity ? (
              <div key={stamps[sinner.id]} className={styles.slot} data-rare={isRareIdentity(identity) || undefined}>
                <button type="button" className={`${board.tile} ${styles.card}`} onClick={() => onReroll(sinner.id)} disabled={!canReroll}
                  aria-label={t('reroll', { name })} title={canReroll ? t('reroll', { name }) : name}>
                  <IdentityFrameCard identity={identity} name={name} order={result?.order ? (number >= 0 ? number : null) : undefined} sizes="(max-width: 40rem) 30vw, 9rem" />
                  {canReroll && <span className={styles.reroll} aria-hidden="true" data-html2canvas-ignore="true"><RefreshCw /></span>}
                </button>
                {lockButton(name, styles.lock)}
              </div>
            ) : (
              <span className={board.empty}><Image src={getSinnerLogoUrl(sinner.id)} alt={sinnerName} width={32} height={32} /></span>
            )}
          </li>
        )
      })}
    </ol>
  )
}

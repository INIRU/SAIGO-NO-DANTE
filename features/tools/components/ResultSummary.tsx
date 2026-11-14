import Image from 'next/image'
import { useTranslations } from 'next-intl'
import { RARITY_ICON_MAP } from '@/lib/constants/game'
import { getEgoGradeBannerUrl } from '@/lib/utils/images'
import { EGO_GRADES, summarize } from '@/features/tools/lib/random/display'
import type { RandomResult } from '@/features/tools/lib/random/engine'
import styles from '@/features/tools/components/RandomClient.module.css'

const RARITIES = [3, 2, 1] as const

/** Counts under the board: 000 / 00 / 0 identities and E.G.O per grade, with the game's rarity and grade images. Zeros before the first roll keep the line's height. */
export default function ResultSummary({ result, identityEnabled, egoEnabled }: { result: RandomResult | null; identityEnabled: boolean; egoEnabled: boolean }) {
  const t = useTranslations('randomPage')
  const summary = summarize(result)
  return (
    <div className={styles.summary} role="group" aria-label={t('summaryLabel')}>
      {identityEnabled && (
        <ul className={styles.sumGroup}>
          {RARITIES.map(rarity => (
            <li key={rarity} className={styles.sumItem} data-zero={summary.rarity[rarity] === 0 || undefined}>
              <Image src={RARITY_ICON_MAP[rarity]} alt={`${rarity}`} width={rarity * 24} height={24} unoptimized />
              <span className={styles.sumTimes} aria-hidden="true">×</span>
              <b className={styles.sumNum}>{summary.rarity[rarity]}</b>
            </li>
          ))}
        </ul>
      )}
      {egoEnabled && (
        <ul className={styles.sumGroup}>
          {EGO_GRADES.map(grade => (
            <li key={grade} className={styles.sumItem} data-zero={summary.grades[grade] === 0 || undefined}>
              <Image src={getEgoGradeBannerUrl(grade)} alt={grade} width={48} height={22} unoptimized />
              <span className={styles.sumTimes} aria-hidden="true">×</span>
              <b className={styles.sumNum}>{summary.grades[grade]}</b>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

import Image from 'next/image'
import { useTranslations } from 'next-intl'
import { getGameUiAsset } from '@/lib/utils/game-ui'
import styles from './CoinBadge.module.css'

interface CoinBadgeProps {
  number: number
  /** Marker size; the numeral scales with it. */
  size?: string
}

/** The coin slot of a skill as the game marks it: its bronze octagon with the coin's Roman numeral (I..X). */
export default function CoinBadge({ number, size = '1.75rem' }: CoinBadgeProps) {
  const t = useTranslations()
  const label = `${t('identity.skills.coin')} ${number}`
  return (
    <span className={styles.coin} style={{ '--coin-size': size } as React.CSSProperties} role="img" aria-label={label} title={label}>
      <Image src={getGameUiAsset('coins/frame')} alt="" width={227} height={222} className={styles.frame} />
      {number >= 1 && number <= 10
        ? <Image src={getGameUiAsset(`coins/numerals/${number}`)} alt="" width={64} height={122} className={styles.numeral} />
        : <span className={styles.digits} aria-hidden="true">{number}</span>}
    </span>
  )
}

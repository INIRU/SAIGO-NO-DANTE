import Image from 'next/image'
import { getLocale, getTranslations } from 'next-intl/server'
import { Link } from '@/lib/i18n/navigation'
import { getLocalizedName } from '@/lib/i18n'
import type { SupportedLang } from '@/lib/i18n/types'
import { type Sinner, BLUR_PLACEHOLDER, getSinnerLogoUrl, getSinnerProfileUrl } from '@/lib/data/sinners'
import { getBlurDataURL } from '@/lib/utils/thumbhash'
import { getGameUiAsset } from '@/lib/utils/game-ui'
import { sinnerColor } from '@/lib/constants/sinner-colors'
import styles from './SinnerLineup.module.css'

/**
 * The twelve as one lineup: on a wide screen twelve tall columns side by side, the one under the pointer or focus widening
 * to show its name; on a phone one wide row each. The game's own number plate (No.01 …) stands at the top of every column.
 */
export default async function SinnerLineup({ sinners }: { sinners: Sinner[] }) {
  const [t, locale] = await Promise.all([getTranslations(), getLocale()])
  return (
    <ol className={styles.lineup}>
      {sinners.map((sinner, i) => {
        const art = getSinnerProfileUrl(sinner.id)
        const number = String(sinner.order_num >= 10 ? sinner.order_num + 1 : sinner.order_num).padStart(2, '0')
        return (
          <li key={sinner.id} className={styles.slot} style={{ '--i': i, '--sinner': sinnerColor(sinner.id) } as React.CSSProperties}>
            <Link href={`/sinners/${sinner.id}`} className={styles.column}>
              {art && (
                <span className={styles.artBox}>
                <Image
                  src={art}
                  alt=""
                  fill
                  sizes="(min-width: 1024px) 34rem, 100vw"
                  quality={80}
                  placeholder="blur"
                  blurDataURL={getBlurDataURL(art) ?? BLUR_PLACEHOLDER}
                  loading={i < 6 ? 'eager' : 'lazy'}
                  fetchPriority={i < 4 ? 'high' : undefined}
                  className={styles.art}
                />
                </span>
              )}
              <span className={styles.shade} aria-hidden="true" />
              <Image src={getGameUiAsset(`sinners/${sinner.id}`)} alt={`No.${number}`} width={389} height={1023} sizes="6rem" loading="eager" className={styles.plate} />
              <span className={styles.label} aria-hidden="true">{getLocalizedName(sinner, locale as SupportedLang)}</span>
              <span className={styles.text}>
                <Image src={getSinnerLogoUrl(sinner.id)} alt="" width={28} height={28} className={styles.logo} />
                <span className={styles.name}>{getLocalizedName(sinner, locale as SupportedLang)}</span>
                <span className={styles.latin}>{sinner.name}</span>
                <span className={styles.source}>{t(`sinner.source.${sinner.id}`)}</span>
              </span>
            </Link>
          </li>
        )
      })}
    </ol>
  )
}

import Image from 'next/image'
import { useTranslations } from 'next-intl'
import { ArrowLeft, ChevronLeft, ChevronRight } from 'lucide-react'
import { Link } from '@/lib/i18n/navigation'
import { type Sinner, BLUR_PLACEHOLDER, SINNER_SLUGS, getSinnerLogoUrl, getSinnerProfileUrl } from '@/lib/data/sinners'
import { getBlurDataURL } from '@/lib/utils/thumbhash'
import { getGameUiAsset } from '@/lib/utils/game-ui'
import { sinnerColor } from '@/lib/constants/sinner-colors'
import styles from './SinnerHero.module.css'

/**
 * Top of a sinner's page: the base illustration across the width, fading into the page on the left where the number
 * plate, name (in the sinner's own colour), description and source stand; the neighbours in the bus order below.
 */
export default function SinnerHero({ sinner, name, description, source }: { sinner: Sinner; name: string; description: string; source: string }) {
  const t = useTranslations()
  const art = getSinnerProfileUrl(sinner.id)
  const at = SINNER_SLUGS.indexOf(sinner.id)
  const prev = at >= 0 ? SINNER_SLUGS[(at + SINNER_SLUGS.length - 1) % SINNER_SLUGS.length] : null
  const next = at >= 0 ? SINNER_SLUGS[(at + 1) % SINNER_SLUGS.length] : null
  const number = String(sinner.order_num >= 10 ? sinner.order_num + 1 : sinner.order_num).padStart(2, '0')
  return (
    <section className={styles.hero} data-ad-rail-below style={{ '--sinner': sinnerColor(sinner.id) } as React.CSSProperties}>
      {/* the art and its shade, behind the text */}
        <div className={styles.backdrop}>
          {art && (
            <div className={styles.art}>
              <Image src={art} alt="" fill priority sizes="100vw" quality={85} placeholder="blur" blurDataURL={getBlurDataURL(art) ?? BLUR_PLACEHOLDER} className={styles.artImage} />
            </div>
          )}
          <div className={styles.shade} aria-hidden="true" />
        </div>
      <div className={styles.inner}>
        <Link href="/sinners" className={styles.back}><ArrowLeft size={16} aria-hidden />{t('sinners.title')}</Link>
        <div className={styles.body}>
          <Image src={getGameUiAsset(`sinners/${sinner.id}`)} alt={`No.${number}`} width={389} height={1023} sizes="5rem" className={styles.plate} priority />
          <div className={styles.text}>
            <div className={styles.titleRow}>
              <Image src={getSinnerLogoUrl(sinner.id)} alt="" width={48} height={48} className={styles.logo} />
              <h1 className={styles.name}>{name}</h1>
            </div>
            <p className={styles.latin}>{sinner.name}</p>
            <p className={styles.description}>{description}</p>
            <p className={styles.source}>{source}</p>
          </div>
        </div>
        {prev && next && (
          <nav className={styles.siblings} aria-label={t('sinners.title')}>
            <Link href={`/sinners/${prev}`} className={styles.sibling}><ChevronLeft size={16} aria-hidden />{t(`sinner.${prev}`)}</Link>
            <Link href={`/sinners/${next}`} className={styles.sibling}>{t(`sinner.${next}`)}<ChevronRight size={16} aria-hidden /></Link>
          </nav>
        )}
      </div>
    </section>
  )
}

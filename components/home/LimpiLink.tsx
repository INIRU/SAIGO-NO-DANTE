import Image from 'next/image'
import { useTranslations } from 'next-intl'
import { ArrowUpRight } from 'lucide-react'
import styles from './LimpiLink.module.css'

/** The partner Discord bot's own site. */
const LIMPI_URL = 'https://limpi.site'

function Runner({ className = '' }: { className?: string }) {
  // Pixel art from the Limpi site (public/limpi/runner.png there): never resampled, so it is served as it is.
  return <Image src="/assets/limpi/runner.png" alt="" width={1032} height={1232} unoptimized className={`${styles.runner} ${className}`} />
}

function Papers() {
  return (
    <span className={styles.papers} aria-hidden="true">
      <Image src="/assets/limpi/paper-1.png" alt="" width={192} height={152} unoptimized className={styles.paper} />
      <Image src="/assets/limpi/paper-2.png" alt="" width={140} height={212} unoptimized className={styles.paper} />
    </span>
  )
}

/** Link from the home hero to the Limpi Discord bot's site: a slip of the news paper its runner carries. */
export default function LimpiLink() {
  const t = useTranslations('home.limpi')
  return (
    <a href={LIMPI_URL} target="_blank" rel="noopener noreferrer" aria-label={t('open')} data-limpi-link className={styles.link}>
      <span className={styles.stage} aria-hidden="true">
        <Papers />
        <Runner />
      </span>
      <span className={styles.text}>
        <strong>{t('name')}</strong>
        <small>{t('kind')}</small>
      </span>
      <ArrowUpRight className={styles.arrow} size={18} aria-hidden="true" />
    </a>
  )
}

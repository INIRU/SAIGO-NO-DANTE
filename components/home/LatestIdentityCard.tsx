'use client'

import { Link } from '@/lib/i18n/navigation'
import type { IdentityWithSinner } from '@/lib/types'
import { useLocale } from 'next-intl'
import IdentityCard from '@/components/sinners/IdentityCard'
import styles from './HomeStaticSections.module.css'

export function LatestIdentityCard({ identity }: { identity: IdentityWithSinner }) {
  const locale = useLocale()
  const sinner = identity.sinner
  const name = locale === 'en' ? sinner?.name_en || sinner?.name_kr : locale === 'ja' ? sinner?.name_jp || sinner?.name_kr : sinner?.name_kr
  return (
    <Link href={`/sinners/${identity.sinner_id}/identities/${identity.id}`} className={styles.identity}>
      <IdentityCard identity={identity} compact disableHoverEffects />
      {name && <span className={styles.sinnerName}>{name}</span>}
    </Link>
  )
}

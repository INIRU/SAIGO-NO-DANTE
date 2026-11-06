'use client'

import { useMemo } from 'react'
import { Trash2 } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import FormationThumbnail from '@/components/ui/FormationThumbnail'
import { refOf } from '@/features/tools/lib/random/roll'
import type { RecentRoll } from '@/features/tools/lib/random/history'
import type { Identity, Sinner } from '@/lib/types'
import styles from './random.module.css'

/** The last rolls of this browser as 6x2 portrait thumbnails (formation numbers first, like the board cards); click to bring one back. */
export default function RecentRolls({ recent, sinners, identities, currentSeed, onRestore, onClear }: {
  recent: RecentRoll[]
  sinners: Sinner[]
  identities: Identity[]
  currentSeed: string | null
  onRestore: (entry: RecentRoll) => void
  onClear: () => void
}) {
  const t = useTranslations('randomPage')
  const locale = useLocale()
  const identityByRef = useMemo(() => new Map(identities.map(identity => [refOf(identity), identity])), [identities])
  if (recent.length === 0) return null
  return (
    <section className={styles.recent} aria-label={t('recent')}>
      <header className={styles.recentHead}>
        <h2 className={styles.label}>{t('recent')}</h2>
        <button type="button" className={styles.clear} onClick={onClear}><Trash2 aria-hidden="true" />{t('clearRecent')}</button>
      </header>
      <ol className={styles.recentList}>
        {recent.map((entry, index) => (
          <li key={entry.seed}>
            <button type="button" className={styles.recentItem} aria-current={entry.seed === currentSeed || undefined}
              aria-label={t('restoreRecent', { index: index + 1 })} title={new Date(entry.at).toLocaleString(locale)} onClick={() => onRestore(entry)}>
              <FormationThumbnail slots={sinners.map((sinner, i) => {
                const identity = identityByRef.get(entry.ids[i] ?? '')
                return identity ? { sinner_id: sinner.id, folder_name: identity.folder_name, game_id: identity.game_id, slot_order: entry.nums[i] ? entry.nums[i] - 1 : 99 } : null
              })} />
            </button>
          </li>
        ))}
      </ol>
    </section>
  )
}

'use client'

import { useLocale } from 'next-intl'
import AchievementBadge from './AchievementBadge'
import { ACHIEVEMENT_COPY, type AchievementProgress } from '@/features/community/lib/achievements'
import styles from './AchievementGrid.module.css'

// Not in the feature entry: ACHIEVEMENTS is built with a top-level call, so a barrel import would keep it in every client bundle that imports the entry.
export { achievementProgress } from '@/features/community/lib/achievements'

/**
 * Badge cards; unearned ones show their condition and progress, hidden ones (easter eggs) stay secret until found.
 * `bare`: the badge art alone (public profiles), name on hover only, so how an easter egg is found stays private.
 */
export default function AchievementGrid({ items, bare = false }: { items: AchievementProgress[]; bare?: boolean }) {
  const locale = useLocale()
  const copy = ACHIEVEMENT_COPY[locale === 'en' || locale === 'ja' ? locale : 'ko']
  if (bare) return (
    <ul className={styles.bareGrid}>
      {items.map(item => (
        <li key={item.id} title={copy.name[item.id]} aria-label={copy.name[item.id]}>
          <AchievementBadge glyph={item.glyph} tier={item.tier} goal={item.goal} earned={item.earned} className={styles.bareArt} />
        </li>
      ))}
    </ul>
  )
  return (
    <ul className={styles.grid}>
      {items.map(item => {
        const secret = item.hidden && !item.earned
        const condition = item.hidden
          ? (item.earned ? copy.secret[item.id] : copy.hiddenCondition)
          : copy.condition[item.glyph as keyof typeof copy.condition].replace('{goal}', item.goal.toLocaleString(locale))
        return (
          <li key={item.id} className={styles.badge} data-earned={item.earned || undefined} data-secret={secret || undefined} title={condition}>
            <AchievementBadge glyph={item.glyph} tier={item.tier} goal={item.goal} earned={item.earned} secret={secret} className={styles.art} />
            <span className={styles.name}>{secret ? copy.hiddenName : copy.name[item.id]}</span>
            <span className={styles.condition}>{condition}</span>
            {!item.earned && !item.hidden && (
              <span className={styles.progress} aria-label={`${item.value} / ${item.goal}`}>
                <span className={styles.bar}><span style={{ width: `${(item.value / item.goal) * 100}%` }} /></span>
                <span className={styles.count}>{item.value.toLocaleString(locale)}/{item.goal.toLocaleString(locale)}</span>
              </span>
            )}
          </li>
        )
      })}
    </ul>
  )
}

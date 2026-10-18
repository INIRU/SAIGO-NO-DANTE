'use client'

import Image from 'next/image'
import { useLocale } from 'next-intl'
import { ArrowUpRight, BookOpenCheck, Copy, Heart, Layers, Map as MapIcon, Pencil } from 'lucide-react'
import { Link } from '@/lib/i18n/navigation'
import { DEFAULT_AVATAR_URL } from '@/lib/constants/game'
import { getCommunityCopy } from '@/lib/community/copy'
import { ACHIEVEMENT_COPY, nextPointsBadge } from '@/lib/community/achievements'
import type { CommunityProfile } from '@/lib/community/rules'
import { FollowSummary } from '@/components/community/Follows'
import { showError, showSuccess } from '@/lib/toast'
import styles from '@/components/community/profile.module.css'

const STATS = [
  { key: 'deck', icon: Layers },
  { key: 'plan', icon: MapIcon },
  { key: 'like', icon: Heart },
  { key: 'contribution', icon: BookOpenCheck },
] as const

/** The profile card of my page and public profiles: identity, follows, activity score. Owner-only controls when onEdit is set. */
export default function ProfileRail({ data, onEdit, onOpenFollows }: {
  data: CommunityProfile
  onEdit?: () => void
  onOpenFollows?: (kind: 'following' | 'followers') => void
}) {
  const locale = useLocale()
  const t = getCommunityCopy(locale)
  const badgeCopy = ACHIEVEMENT_COPY[locale === 'en' || locale === 'ja' ? locale : 'ko']
  const { profile, stats } = data
  const next = nextPointsBadge(stats.points)
  async function share() {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/${locale}/users/${profile.id}`)
      showSuccess(t.copied)
    } catch {
      showError(t.saveError)
    }
  }
  return (
    <section className={`${styles.card} relative`} data-testid="community-profile">
      {onEdit && <button type="button" className={`${styles.ghost} ${styles.icon} ${styles.edit}`} onClick={onEdit} aria-label={t.editProfile} title={t.editProfile}><Pencil aria-hidden="true" /></button>}
      <div className={styles.who}>
        <Image src={profile.avatar_url || DEFAULT_AVATAR_URL} alt="" width={72} height={72} className={styles.avatar} />
        <div className="min-w-0">
          <h1 className={styles.name}>{profile.username || t.anonymous}</h1>
          <p className={styles.joined}>{t.joined} {new Date(profile.created_at).toLocaleDateString(locale, { year: 'numeric', month: 'short' })}</p>
        </div>
      </div>
      <p className={styles.bio} data-empty={!profile.bio || undefined}>{profile.bio || t.noBio}</p>
      <FollowSummary id={profile.id} onOpen={onOpenFollows} />
      {onEdit && <div className={styles.links}>
        {profile.public_profile ? (
          <>
            <Link href={`/users/${profile.id}`} className={styles.ghost}>{t.view}<ArrowUpRight aria-hidden="true" /></Link>
            <button type="button" className={`${styles.ghost} ${styles.icon}`} onClick={share} aria-label={t.share} title={t.share}><Copy aria-hidden="true" /></button>
          </>
        ) : (
          <span className={styles.ghost} aria-disabled="true">{t.private}</span>
        )}
      </div>}

      <div className={styles.score}>
        <p className={styles.scoreLabel}>{t.points}</p>
        <strong className={styles.points} data-testid="activity-points">{stats.points.toLocaleString(locale)}</strong>
        {next && <div className={styles.meter} aria-hidden="true"><span style={{ transform: `scaleX(${next.ratio})` }} /></div>}
        <p className={styles.next}>{next ? badgeCopy.nextBadge.replace('{remaining}', next.remaining.toLocaleString(locale)) : badgeCopy.allBadges}</p>
        <dl className={styles.stats}>
          {STATS.map(({ key, icon: Icon }) => (
            <div key={key} className={styles.stat}>
              <dt><Icon aria-hidden="true" />{t[key]}</dt>
              <dd>{stats[key].toLocaleString(locale)}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  )
}

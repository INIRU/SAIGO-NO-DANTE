'use client'

import { useState } from 'react'
import { useLocale } from 'next-intl'
import useSWR from 'swr'
import { Heart, Map as MapIcon, Plus } from 'lucide-react'
import { Link } from '@/lib/i18n/navigation'
import PlanCard, { type PlanSummary } from '@/components/planner/PlanCard'
import Skeleton from '@/components/ui/Skeleton'
import { getCommunityCopy } from '@/lib/community/copy'
import styles from '@/components/community/profile.module.css'

export default function PlannerTab() {
  const t = getCommunityCopy(useLocale())
  const mine = useSWR<{ plans: PlanSummary[] }>('/api/planner?userId=me&limit=50')
  const liked = useSWR<{ plans: PlanSummary[] }>('/api/planner?votedBy=me&limit=50')
  const [subTab, setSubTab] = useState<'mine' | 'liked'>('mine')
  const myPlans = mine.data?.plans ?? []
  const likedPlans = liked.data?.plans ?? []
  const loading = mine.isLoading || liked.isLoading
  const list = subTab === 'mine' ? myPlans : likedPlans
  return (
    <>
      <div className={styles.head}>
        <div className={styles.seg} role="group" aria-label={t.planner}>
          <button type="button" aria-pressed={subTab === 'mine'} onClick={() => setSubTab('mine')}>{t.myPlans}<b>{loading ? '' : myPlans.length}</b></button>
          <button type="button" aria-pressed={subTab === 'liked'} onClick={() => setSubTab('liked')}>{t.likedPlans}<b>{loading ? '' : likedPlans.length}</b></button>
        </div>
        <Link href="/planner" className={styles.primary}><Plus aria-hidden="true" />{t.newPlan}</Link>
      </div>
      {loading ? (
        <div className={styles.list}>{Array.from({ length: 3 }, (_, i) => <Skeleton key={i} line className="h-48 rounded-lg" />)}</div>
      ) : list.length === 0 ? (
        <div className={styles.empty}>
          {subTab === 'mine' ? <MapIcon aria-hidden="true" /> : <Heart aria-hidden="true" />}
          <p>{subTab === 'mine' ? t.emptyPlans : t.emptyLiked}</p>
          <Link href={subTab === 'mine' ? '/planner' : '/planner/community'} className={subTab === 'mine' ? styles.primary : styles.ghost}>
            {subTab === 'mine' ? t.firstPlan : t.browsePlans}
          </Link>
        </div>
      ) : (
        <ul className={styles.list}>{list.map(plan => <li key={plan.id} className={styles.item}><PlanCard plan={plan} /></li>)}</ul>
      )}
    </>
  )
}

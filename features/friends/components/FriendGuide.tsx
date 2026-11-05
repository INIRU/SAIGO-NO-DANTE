'use client'

import { useState } from 'react'
import Image from 'next/image'
import { useTranslations } from 'next-intl'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import BaseModal from '@/components/ui/BaseModal'
import { FRIEND_GUIDE_STEPS } from '@/features/friends/lib/guide'
import styles from './FriendGuide.module.css'

/** For players new to friend codes: where the code is in the game, how to add a friend with it, and where support identities are set. */
export default function FriendGuide({ onClose }: { onClose: () => void }) {
  const t = useTranslations('friends.guide')
  const [at, setAt] = useState(0)
  const step = FRIEND_GUIDE_STEPS[at], last = FRIEND_GUIDE_STEPS.length - 1
  return <BaseModal open onClose={onClose} title={t('title')} maxWidth="64rem" padding="0">
    <div className={styles.guide}>
      <header>
        <h2>{t('title')}</h2>
        <button type="button" onClick={onClose} aria-label={t('close')} title={t('close')}><X size={22} aria-hidden="true" /></button>
      </header>
      <div className={styles.body}>
        <ol className={styles.steps}>
          {FRIEND_GUIDE_STEPS.map((item, index) => <li key={item.key}>
            <button type="button" aria-current={index === at ? 'step' : undefined} onClick={() => setAt(index)}>
              <span aria-hidden="true">{index + 1}</span>{t(`steps.${item.key}`)}
            </button>
          </li>)}
        </ol>
        {/* Every step is a full game screen, so the picture keeps one size and nothing moves between steps. */}
        <figure className={styles.stage}>
          <div key={step.key} className={styles.shot}>
            <Image src={`/assets/guides/friend-codes/${step.key}.webp`} alt={t('imageAlt', { step: t(`steps.${step.key}`) })} fill sizes="(min-width: 64rem) 40rem, 100vw" />
            {step.spots.map((spot, index) => <span key={index} className={styles.spot} style={{ left: `${spot.left}%`, top: `${spot.top}%`, width: `${spot.width}%`, height: `${spot.height}%` }} />)}
          </div>
        </figure>
      </div>
      <footer>
        <button type="button" className={styles.nav} disabled={at === 0} onClick={() => setAt(at - 1)}><ChevronLeft size={18} aria-hidden="true" />{t('prev')}</button>
        <span aria-hidden="true">{at + 1} / {last + 1}</span>
        <button type="button" className={`${styles.nav} ${styles.next}`} disabled={at === last} onClick={() => setAt(at + 1)}>{t('next')}<ChevronRight size={18} aria-hidden="true" /></button>
      </footer>
    </div>
  </BaseModal>
}

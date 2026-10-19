'use client'

import { Download, Link2, Route, Users } from 'lucide-react'
import { useTranslations } from 'next-intl'
import CompactButton from '@/components/ui/CompactButton'
import styles from './random.module.css'

/** What can be done with the result: share its link, open it in the planner or the deck builder, save the board as an image. */
export default function ResultToolbar({ disabled, imageDisabled, saving, onCopyLink, onPlanner, onDeck, onImage }: {
  disabled: boolean
  /** The image saves the identity cards, so it is off on the E.G.O tab and when no identity was drawn. */
  imageDisabled: boolean
  saving: boolean
  onCopyLink: () => void
  onPlanner: () => void
  onDeck: () => void
  onImage: () => void
}) {
  const t = useTranslations('randomPage')
  return (
    <div className={styles.toolbar}>
      <CompactButton icon={Link2} size="md" disabled={disabled} onClick={onCopyLink}>{t('copyLink')}</CompactButton>
      <CompactButton icon={Route} size="md" disabled={disabled} onClick={onPlanner}>{t('toPlanner')}</CompactButton>
      <CompactButton icon={Users} size="md" disabled={disabled} onClick={onDeck}>{t('toDeck')}</CompactButton>
      <CompactButton icon={Download} size="md" disabled={disabled || imageDisabled || saving} onClick={onImage}>{t('saveImage')}</CompactButton>
    </div>
  )
}

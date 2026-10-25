'use client'

import { Download, Link2, Route, Users } from 'lucide-react'
import { useTranslations } from 'next-intl'
import Button from '@/components/ui/Button'
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
      <Button size="sm" variant="outline" icon={Link2} disabled={disabled} onClick={onCopyLink}>{t('copyLink')}</Button>
      <Button size="sm" variant="outline" icon={Route} disabled={disabled} onClick={onPlanner}>{t('toPlanner')}</Button>
      <Button size="sm" variant="outline" icon={Users} disabled={disabled} onClick={onDeck}>{t('toDeck')}</Button>
      <Button size="sm" variant="outline" icon={Download} disabled={disabled || imageDisabled || saving} onClick={onImage}>{t('saveImage')}</Button>
    </div>
  )
}

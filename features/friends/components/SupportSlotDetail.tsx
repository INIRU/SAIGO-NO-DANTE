'use client'

import { useLocale, useTranslations } from 'next-intl'
import useSWR from 'swr'
import { X } from 'lucide-react'
import BaseModal from '@/components/ui/BaseModal'
import EgoDisplayCard from '@/components/sinners/EgoDisplayCard'
import { fetchNoteAssets } from '@/features/notes/components/NoteBlockViewer'
import { assetName } from '@/features/notes'
import { sinnerNumber } from '@/features/friends/lib/codes'
import { EGO_GRADES, SupportStripArt, type SupportSlot } from './SupportStrips'
import styles from './SupportSlotDetail.module.css'

/** One support strip of a post, opened: the identity and the E.G.O set on it, as the site's own E.G.O cards in grade order (ZAYIN to ALEPH). */
export default function SupportSlotDetail({ slot, onClose }: { slot: SupportSlot; onClose: () => void }) {
  const locale = useLocale(), lang = locale === 'en' || locale === 'ja' ? locale : 'ko', t = useTranslations('friends')
  const egos = useSWR('/api/notes/assets?kind=ego&catalog=1', fetchNoteAssets, { revalidateOnFocus: false })
  const byId = new Map((egos.data ?? []).map(asset => [asset.id, asset]))
  const chosen = EGO_GRADES.flatMap(grade => { const asset = slot.egos[grade] ? byId.get(slot.egos[grade]!) : undefined; return asset?.ego ? [asset] : [] })
  return <BaseModal open onClose={onClose} title={slot.name} maxWidth="46rem" padding="0">
    <div className={styles.detail}>
      <header>
        <span>{sinnerNumber(slot.identity.sinner_id)}</span>
        <h2>{slot.name}</h2>
        <button type="button" onClick={onClose} aria-label={t('guide.close')} title={t('guide.close')}><X size={22} aria-hidden="true" /></button>
      </header>
      <div className={styles.body}>
        <div className={styles.art}><SupportStripArt identity={slot.identity} /></div>
        <div className={styles.egos}>
          {chosen.map(asset => <EgoDisplayCard key={asset.id} ego={asset.ego!} sinnerId={slot.identity.sinner_id} name={assetName(asset, lang)} lang={lang} displayOnly />)}
        </div>
      </div>
    </div>
  </BaseModal>
}

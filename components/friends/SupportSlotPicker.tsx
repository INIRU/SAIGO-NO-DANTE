'use client'

import { useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import useSWR from 'swr'
import BaseModal from '@/components/ui/BaseModal'
import IdentityFrameCard from '@/components/ui/IdentityFrameCard'
import { fetchNoteAssets } from '@/components/notes/NoteBlockViewer'
import { SINNER_SLUGS } from '@/lib/constants/game'
import { getSinnerLogoUrl } from '@/lib/utils/images'
import { assetName } from '@/lib/notes/assets'
import { compareReleaseDate } from '@/lib/utils/release-order'
import type { SupportedLang } from '@/lib/i18n/types'
import SupportStrips, { EGO_GRADES, SUPPORT_SLOT_NUMBERS, type EgoGrade, type SupportSlot } from './SupportStrips'
import styles from './SupportSlotPicker.module.css'

/** Picks the identity of one support slot and the E.G.O set on it (one per grade), with the site's own identity and E.G.O cards. */
export default function SupportSlotPicker({ index, value, onDone, onClose }: {
  index: number; value: SupportSlot | null; onDone: (slot: SupportSlot | null) => void; onClose: () => void
}) {
  const lang = useLocale() as SupportedLang, t = useTranslations('sinner')
  // The slot's number names a sinner in the game's order; any sinner may be put there.
  const [sinner, setSinner] = useState<string>(value?.identity.sinner_id ?? SINNER_SLUGS[index] ?? SINNER_SLUGS[0])
  const [slot, setSlot] = useState<SupportSlot | null>(value)
  const identities = useSWR('/api/notes/assets?kind=identity&catalog=1', fetchNoteAssets, { revalidateOnFocus: false })
  const egos = useSWR('/api/notes/assets?kind=ego&catalog=1', fetchNoteAssets, { revalidateOnFocus: false })
  const list = (identities.data ?? []).filter(asset => asset.identity?.sinner_id === sinner)
    .sort((a, b) => compareReleaseDate(a.identity ?? a, b.identity ?? b))
  const chosenSinner = slot?.identity.sinner_id ?? sinner
  const number = SUPPORT_SLOT_NUMBERS[index]
  return <BaseModal open onClose={onClose} title={`${number} 지원 인격`} maxWidth="70rem" padding="0">
    <div className={styles.picker}>
      <header className={styles.head}><span>{number}</span><h2>지원 인격</h2><button type="button" className={styles.btn} onClick={onClose}>닫기</button></header>
      <div className={styles.sinners}>
        {SINNER_SLUGS.map(id => <button type="button" key={id} aria-pressed={sinner === id} onClick={() => setSinner(id)}>
          {/* eslint-disable-next-line @next/next/no-img-element -- small fixed-size game icon */}
          <img src={getSinnerLogoUrl(id)} alt="" width={28} height={28} />{t(id)}
        </button>)}
      </div>
      <div className={styles.body}>
        <div className={styles.identities}>
          {list.map(asset => asset.identity && <button type="button" key={asset.id}
            onClick={() => setSlot({ identityId: asset.id, identity: asset.identity!, name: assetName(asset, lang), egos: slot?.identity.sinner_id === asset.identity!.sinner_id ? slot.egos : {} })}>
            <IdentityFrameCard identity={asset.identity} name={assetName(asset, lang)} selected={slot?.identityId === asset.id} sizes="7rem" />
          </button>)}
        </div>
        <div className={styles.side}>
          <SupportPreview slot={slot} index={index} />
          <div className={`${styles.egos} ${slot ? '' : styles.dim}`}>
            {EGO_GRADES.map(grade => {
              const options = (egos.data ?? []).filter(asset => asset.sinnerId === chosenSinner && asset.ego?.grade?.toUpperCase() === grade)
              return <section key={grade} className={styles.egoRow} data-grade={grade}>
                <span className={styles.grade}>
                  {/* eslint-disable-next-line @next/next/no-img-element -- the game's own grade mark, fixed height */}
                  <img src={`/assets/ego-ui/grade-symbols/grade-${grade.toLowerCase()}-symbol.webp`} alt={grade} />
                </span>
                {options.length ? <div>{options.map(asset => asset.ego && <button type="button" key={asset.id} disabled={!slot} title={assetName(asset, lang)}
                  aria-label={assetName(asset, lang)} aria-pressed={slot?.egos[grade] === asset.id} style={{ backgroundImage: asset.ego.image_url ? `url("${asset.ego.image_url}")` : undefined }}
                  onClick={() => slot && setSlot({ ...slot, egos: toggled(slot.egos, grade, asset.id) })} />)}</div> : <p>없음</p>}
              </section>
            })}
          </div>
        </div>
      </div>
      <footer className={styles.foot}>
        <strong>{slot?.name}</strong>
        <button type="button" className={styles.btn} onClick={() => onDone(null)}>칸 비우기</button>
        <button type="button" className={`${styles.btn} ${styles.primary}`} disabled={!slot} onClick={() => onDone(slot)}>넣기</button>
      </footer>
    </div>
  </BaseModal>
}

/** One E.G.O per grade: choosing the set one again takes it off. */
const toggled = (egos: SupportSlot['egos'], grade: EgoGrade, id: string): SupportSlot['egos'] => {
  const next = { ...egos }
  if (next[grade] === id) delete next[grade]
  else next[grade] = id
  return next
}

/** The slot as it will look in the line-up. */
function SupportPreview({ slot, index }: { slot: SupportSlot | null; index: number }) {
  const slots = Array.from({ length: 12 }, (_, at) => at === index ? slot : null)
  return <div style={{ display: 'grid' }}><div style={{ gridArea: '1 / 1' }}><SinglePreview slots={slots} index={index} /></div></div>
}
function SinglePreview({ slots, index }: { slots: (SupportSlot | null)[]; index: number }) {
  // Only this slot's strip: the others are hidden, the shared component keeps the look identical.
  return <div style={{ overflow: 'hidden' }} data-only={index}>
    <style>{`[data-only="${index}"] > div > :not(:nth-child(${index + 1})) { display: none }`}</style>
    <SupportStrips slots={slots} />
  </div>
}

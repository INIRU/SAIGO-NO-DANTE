'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import useSWR from 'swr'
import { useLocale, useTranslations } from 'next-intl'
import { Plus, RefreshCw, X } from 'lucide-react'
import SkillFrame from '@/features/catalog/components/SkillFrame'
import SkillNameBanner from '@/features/catalog/components/SkillNameBanner'
import IdentityFrameCard from '@/features/catalog/components/IdentityFrameCard'
import { SIN_COLORS } from '@/lib/constants/sin'
import { assetName, type NoteAssetData } from '@/lib/notes/assets'
import type { ToolSkill } from '@/lib/tools/skill-source'
import styles from './SkillLoader.module.css'

// The picker (and its catalog request) loads when it is first opened, the E.G.O card when an E.G.O is picked.
const NoteCharacterPicker = dynamic(() => import('@/components/notes/NoteCharacterPicker'), { ssr: false })
const EgoDisplayCard = dynamic(() => import('@/features/catalog/components/EgoDisplayCard'), { ssr: false })

type Kind = 'identity' | 'ego'
const sinColor = (skill: ToolSkill | undefined) => (skill?.sin ? SIN_COLORS[skill.sin] : '#cccccc')

const fetchSkills = async (url: string): Promise<ToolSkill[]> => {
  const response = await fetch(url)
  if (!response.ok) throw new Error(String(response.status))
  const data = await response.json()
  if (!Array.isArray(data?.skills)) throw new Error('Unexpected response')
  return data.skills
}

/**
 * Where a calculator's skill comes from: two empty slots (identity, E.G.O) open the character picker; once one is picked
 * its art, name and skills in their game frames show, and pressing a frame hands that skill's numbers to the calculator.
 */
export default function SkillLoader({ selectedKey, onSkill }: { selectedKey: string; onSkill: (skill: ToolSkill | null) => void }) {
  const t = useTranslations('toolSkill')
  const lang = useLocale()
  const [picking, setPicking] = useState<Kind | null>(null)
  const [owner, setOwner] = useState<{ kind: Kind; asset: NoteAssetData } | null>(null)
  const { data: skills, error, isLoading, mutate } = useSWR(owner ? `/api/tool-skills/${lang}?kind=${owner.kind}&id=${owner.asset.id}` : null, fetchSkills, {
    revalidateOnFocus: false,
    // The first attack skill is loaded at once; the others wait for a press.
    onSuccess: list => { if (!list.some(skill => skill.key === selectedKey)) onSkill(list.find(skill => !skill.defense) ?? list[0] ?? null) },
  })
  const selected = skills?.find(skill => skill.key === selectedKey)
  const pick = (asset: NoteAssetData) => { if (picking) setOwner({ kind: picking, asset }); setPicking(null) }
  const clear = () => { setOwner(null); onSkill(null) }
  const asset = owner?.asset

  return <div className={styles.loader}>
    {!owner ? <div className={styles.slots}>
      {(['identity', 'ego'] as const).map(kind => <button key={kind} type="button" className={styles.slot} onClick={() => setPicking(kind)}>
        <Plus size={18} aria-hidden="true" /><span>{t(kind === 'identity' ? 'pickIdentity' : 'pickEgo')}</span>
      </button>)}
    </div> : <div className={styles.card} data-kind={owner.kind} style={{ '--sin': sinColor(selected) } as React.CSSProperties}>
      {/* The game's own card: the identity's formation card, or the E.G.O card. Pressing it picks another. */}
      <button type="button" className={styles.art} data-kind={owner.kind} onClick={() => setPicking(owner.kind)} aria-label={t('change')}>
        {owner.kind === 'identity' && asset?.identity
          ? <IdentityFrameCard identity={asset.identity} name={assetName(asset, lang)} sizes="8rem" />
          : asset?.ego && asset.sinnerId && <EgoDisplayCard ego={asset.ego} sinnerId={asset.sinnerId} name={assetName(asset, lang)} lang={lang === 'en' || lang === 'ja' ? lang : 'ko'} displayOnly />}
      </button>
      <div className={styles.body}>
        <div className={styles.head}>
          <span>{t('skills')}</span>
          <button type="button" className={styles.icon} onClick={() => setPicking(owner.kind)} aria-label={t('change')} title={t('change')}><RefreshCw size={16} aria-hidden="true" /></button>
          <button type="button" className={styles.icon} onClick={clear} aria-label={t('clear')} title={t('clear')}><X size={18} aria-hidden="true" /></button>
        </div>
        <div className={styles.strip} role="group" aria-label={t('skills')} aria-busy={isLoading}>
          {skills?.map(skill => <button key={skill.key} type="button" className={styles.skill} aria-pressed={skill.key === selectedKey}
            aria-label={skill.name} title={skill.name} onClick={() => onSkill(skill)}>
            <span className={styles.frame}><SkillFrame skillIconUrl={skill.icon} sin={skill.sin ?? 'neutral'} skillSlot={skill.slot} sinColor={sinColor(skill)}
              attackType={skill.atk} label={owner.kind === 'ego' ? 'EGO' : `S${skill.slot}`} size="100%" eager /></span>
            {skill.corrosion && <span className={styles.corrosion}>{t('corrosion')}</span>}
          </button>)}
          {isLoading && Array.from({ length: owner.kind === 'ego' ? 2 : 4 }, (_, i) => <span key={i} className={styles.placeholder} aria-hidden="true" />)}
          {error && <button type="button" className={styles.retry} onClick={() => void mutate()}>{t('loadError')}</button>}
        </div>
        <div className={styles.banner}>{selected && <SkillNameBanner name={selected.name} sinColor={sinColor(selected)} fontSize="0.9375rem" />}</div>
      </div>
    </div>}
    {picking && <NoteCharacterPicker kind={picking} onSelect={pick} onClose={() => setPicking(null)} />}
  </div>
}

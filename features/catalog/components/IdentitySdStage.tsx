'use client'

import { useState, type CSSProperties } from 'react'
import dynamic from 'next/dynamic'
import { useTranslations } from 'next-intl'
import { useReducedMotion } from 'motion/react'
import SdViewer from '@/features/catalog/components/SdViewer'
import { dataLabel, formLabel, motionsOf, skinSetsOf, type IdentitySpine, type SpineLayer } from '@/features/catalog/lib/spine-pack'
import styles from '@/styles/components/SinnerDetail.module.css'

// The Spine runtime is downloaded with the first SD figure that is shown, not with the page.
const SpineStage = dynamic(() => import('@/features/catalog/components/SpineStage'), { ssr: false })

interface Props {
  sd: IdentitySpine
  /** The identity's name, for the figure's label. */
  name: string
  /** Sets the size: `--sd-height`, and `--sd-max` for the widest it may get. */
  className?: string
}

interface Choice { label: string; hint?: string; on: boolean; pick: () => void }

/**
 * An identity's SD figure playing its idle loop. Tabs pick the form, the skin of each skin set and the animation,
 * each where there is more than one; a click on the figure opens the viewer.
 */
export default function IdentitySdStage({ sd, name, className = '' }: Props) {
  const t = useTranslations()
  const [index, setIndex] = useState(0)
  // what was picked for each form; a form nobody touched plays what its prefab starts with
  const [skins, setSkins] = useState<Record<number, (string | null)[]>>({})
  const [motions, setMotions] = useState<Record<number, string>>({})
  const [viewing, setViewing] = useState(false)
  const [failed, setFailed] = useState(false)
  const still = !!useReducedMotion()
  if (failed) return null

  const form = sd.forms[index] ?? sd.forms[0]
  const rig = form.layers.find((layer): layer is SpineLayer => layer.kind === 'spine')
  const files = rig && sd.skeletons[rig.dir]
  const sets = files ? skinSetsOf(files, rig.skin) : []
  const worn = skins[index] ?? sets.map(set => set.start)
  const moves = files ? motionsOf(files) : []
  const motion = moves.length ? motions[index] ?? (rig?.animation && moves.includes(rig.animation) ? rig.animation : moves[0]) : undefined
  // The box has the skeleton's proportions before anything loads, so the figure fades in without moving the page.
  // Not narrower than 0.7: the pack measures the bare skeleton, and a skin can add wings or a weapon to the sides.
  const shape = files ? ({ '--sd-aspect': Math.max(0.7, files.width / files.height) } as CSSProperties) : undefined
  const label = t('identity.sd.label', { name })

  // The rows of tabs, named as the game data names them. A row with a single choice is not drawn.
  const groups: { key: string; title: string; choices: Choice[] }[] = [
    { key: 'forms', title: t('identity.sd.forms'), choices: sd.forms.map((each, i) => ({ label: formLabel(each, sd.forms), on: i === index, pick: () => setIndex(i) })) },
    ...sets.map((set, n) => ({
      key: `skins-${set.key}`,
      title: t('identity.sd.skins'),
      // a set the prefab leaves unworn can also be taken off
      choices: [...(set.start === null ? [null] : []), ...set.skins].map(skin => ({
        label: skin === null ? '–' : dataLabel(skin),
        hint: skin === null ? t('identity.sd.noSkin') : undefined,
        on: worn[n] === skin,
        pick: () => setSkins(all => ({ ...all, [index]: worn.map((old, at) => (at === n ? skin : old)) })),
      })),
    })),
    { key: 'motions', title: t('identity.sd.motions'), choices: moves.map(move => ({ label: dataLabel(move), on: move === motion, pick: () => setMotions(all => ({ ...all, [index]: move })) })) },
  ].filter(group => group.choices.length > 1)
  const tabs = (titled: boolean) => groups.length > 0 && (
    <div className={`${styles.sdTabs} ${titled ? styles.sdTabsTitled : ''}`}>
      {groups.map(group => (
        <div key={group.key} className={styles.sdTabRow}>
          {titled && <span className={styles.sdTabTitle}>{group.title}</span>}
          <div className={styles.segment} role="group" aria-label={group.title}>
            {group.choices.map(choice => (
              <button key={choice.label} type="button" aria-pressed={choice.on} aria-label={choice.hint} onClick={choice.pick}>{choice.label}</button>
            ))}
          </div>
        </div>
      ))}
    </div>
  )

  return (
    <div className={`${styles.sd} ${className}`} style={shape}>
      {/* The small figure holds its frame while the viewer plays. */}
      <button type="button" className={`${styles.sdFigure} cursor-zoom-in`} aria-haspopup="dialog" aria-label={t('identity.sd.enlarge', { name })} onClick={() => setViewing(true)}>
        <SpineStage key={index} pack={sd} form={form} skins={worn} animation={motion} paused={still || viewing} label={label} className="block h-full w-full" onError={() => setFailed(true)} />
      </button>
      {tabs(false)}

      <SdViewer open={viewing} onClose={() => setViewing(false)} name={name} sd={sd} form={form} formKey={index} skins={worn} animation={motion} still={still}>
        {tabs(true)}
      </SdViewer>
    </div>
  )
}

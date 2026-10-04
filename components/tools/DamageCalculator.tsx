'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { useTranslations } from 'next-intl'
import { RotateCcw } from 'lucide-react'
import { coinDamage, coinPowers, parseSavedModifiers, STAGGER_RESIST, toModifier, type SavedModifier, type StaggerStage } from '@/lib/tools/damage'
import { COIN_IMAGES } from '@/lib/identity/skill-description'
import Dropdown from '@/components/ui/Dropdown'
import PageHeader from '@/components/ui/PageHeader'
import DamageModifiers from './DamageModifiers'
import NumberInput from './NumberInput'
import styles from './DamageCalculator.module.css'

const STORAGE_KEY = 'damage-calculator-modifiers'
const MAX_COINS = 10
const DEFAULTS = {
  basePower: 4, coinPower: 4, coinCount: 3, offenseLevel: 55,
  defenseLevel: 55, physicalResist: 1, sinResist: 1, stagger: 0 as StaggerStage, observationLevel: 0,
  critical: false, clashCount: 0,
}
const ALL_HEADS: boolean[] = Array(MAX_COINS).fill(true)
const dropdownStyle = {width:'100%',justifyContent:'space-between',minHeight:'2.75rem',padding:'.7rem',background:'var(--bg-deep)',borderColor:'var(--border)',fontSize:'.9375rem',color:'var(--text-primary)'}
function NumberField(props: Parameters<typeof NumberInput>[0]) {
  return <label className={styles.field}>{props.label}<NumberInput {...props} /></label>
}

// 2.125 → "×2.125", 1 → "×1"
const factor = (value: number) => `×${Number(value.toFixed(3))}`

export default function DamageCalculator() {
  const t = useTranslations('damage')
  const [form, setForm] = useState(DEFAULTS)
  const [heads, setHeads] = useState(ALL_HEADS)
  const [custom, setCustom] = useState<SavedModifier[]>([])
  // The saved modifiers are read after the first render, so the server and the browser draw the same page.
  const [loaded, setLoaded] = useState(false)
  useEffect(() => {
    try { setCustom(parseSavedModifiers(localStorage.getItem(STORAGE_KEY))) } catch { /* storage blocked: start empty */ }
    setLoaded(true)
  }, [])
  useEffect(() => {
    if (!loaded) return
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(custom)) } catch { /* storage blocked or full: keep them for this visit only */ }
  }, [custom, loaded])

  const set = (patch: Partial<typeof DEFAULTS>) => setForm(current => ({ ...current, ...patch }))
  const staggerResist = STAGGER_RESIST[form.stagger]
  const powers = coinPowers(form.basePower, form.coinPower, heads.slice(0, form.coinCount))
  const modifiers = custom.map(toModifier)
  const results = powers.map(power => coinDamage({ ...form, power, modifiers }))
  const total = results.reduce((sum, result) => sum + result.damage, 0)

  return <div className={styles.page}>
    <PageHeader title={t('title')} description={t('subtitle')} actions={
      <button type="button" className={styles.reset} onClick={() => { setForm(DEFAULTS); setHeads(ALL_HEADS) }}><RotateCcw size={16} aria-hidden="true" />{t('reset')}</button>
    } />
    <div className={styles.workspace}>
      <div className={styles.inputs}>
        <section className={styles.panel} aria-labelledby="damage-skill-heading">
          <h2 id="damage-skill-heading">{t('skill')}</h2>
          <div className={styles.fields}>
            <NumberField label={t('basePower')} value={form.basePower} max={999} onChange={basePower => set({ basePower })} />
            <NumberField label={t('coinPower')} value={form.coinPower} min={-99} max={99} onChange={coinPower => set({ coinPower })} />
            <div className={styles.field}>{t('coinCount')}
              <Dropdown ariaLabel={t('coinCount')} buttonStyle={dropdownStyle} value={String(form.coinCount)}
                options={ALL_HEADS.map((_, index) => ({ value: String(index + 1), label: String(index + 1) }))}
                onChange={value => set({ coinCount: Number(value) })} />
            </div>
            <NumberField label={t('offenseLevel')} value={form.offenseLevel} max={999} onChange={offenseLevel => set({ offenseLevel })} />
          </div>
          <div className={styles.coins} role="group" aria-label={t('coins')}>
            {heads.slice(0, form.coinCount).map((isHeads, index) => (
              // The label names the side, so the button is not also announced as pressed.
              <button key={index} type="button" className={styles.coin} data-heads={isHeads}
                aria-label={t('coinToggle', { index: index + 1, side: t(isHeads ? 'heads' : 'tails') })}
                onClick={() => setHeads(sides => sides.map((side, i) => i === index ? !side : side))}>
                <Image src={COIN_IMAGES.normal} alt="" width={64} height={64} unoptimized />
                <span aria-hidden="true">{t(isHeads ? 'heads' : 'tails')}</span>
              </button>
            ))}
          </div>
        </section>
        <section className={styles.panel} aria-labelledby="damage-target-heading">
          <h2 id="damage-target-heading">{t('target')}</h2>
          <div className={styles.fields}>
            <NumberField label={t('defenseLevel')} value={form.defenseLevel} max={999} onChange={defenseLevel => set({ defenseLevel })} />
            <div className={styles.field}>{t('stagger')}
              <Dropdown ariaLabel={t('stagger')} buttonStyle={dropdownStyle} value={String(form.stagger)}
                options={STAGGER_RESIST.map((_, stage) => ({ value: String(stage), label: t(`staggerOption.${stage as StaggerStage}`) }))}
                onChange={value => set({ stagger: Number(value) as StaggerStage })} />
            </div>
            <NumberField label={t('physicalResist')} value={staggerResist ?? form.physicalResist} max={10} decimal disabled={staggerResist !== null} onChange={physicalResist => set({ physicalResist })} />
            <NumberField label={t('sinResist')} value={form.sinResist} max={10} decimal onChange={sinResist => set({ sinResist })} />
            <NumberField label={t('observation')} value={form.observationLevel} max={10} onChange={observationLevel => set({ observationLevel })} />
          </div>
          {staggerResist !== null && <p className={styles.hint}>{t('staggerFixed', { value: staggerResist })}</p>}
          <p className={styles.hint}>{t('observationHelp')}</p>
        </section>
        <section className={styles.panel} aria-labelledby="damage-modifiers-heading">
          <h2 id="damage-modifiers-heading">{t('modifiers')}</h2>
          <div className={styles.fields}>
            <NumberField label={t('clashCount')} value={form.clashCount} max={99} onChange={clashCount => set({ clashCount })} />
            <label className={styles.check}><input type="checkbox" checked={form.critical} onChange={e => set({ critical: e.target.checked })} />{t('critical')}</label>
          </div>
          <h3>{t('custom')}</h3>
          <DamageModifiers modifiers={custom} setModifiers={setCustom} />
        </section>
      </div>
      <section className={`${styles.panel} ${styles.result}`} aria-labelledby="damage-result-heading">
        <h2 id="damage-result-heading">{t('result')}</h2>
        <div className={styles.total} aria-live="polite" aria-atomic="true"><span>{t('total')}</span><strong key={total} data-testid="damage-total">{total}</strong></div>
        <ol className={styles.coinResults}>
          {results.map((result, index) => <li key={index}>
            <span>{t('coin', { index: index + 1 })}</span><span>{t('power')} {powers[index]}</span><strong key={result.damage} data-testid={`damage-coin-${index + 1}`}>{result.damage}</strong>
          </li>)}
        </ol>
        <dl className={styles.factors}>
          <div><dt>{t('damageFactor')}</dt><dd>{factor(results[0].damageFactor)}</dd></div>
          <div><dt>{t('resistFactor')}</dt><dd>{factor(results[0].resistFactor)}</dd></div>
          {results[0].finalMultiplier !== 1 && <div><dt>{t('finalMultiplier')}</dt><dd>{factor(results[0].finalMultiplier)}</dd></div>}
        </dl>
      </section>
    </div>
    <details className={styles.details}>
      <summary>{t('formula')}</summary>
      <p>{t('formulaBody')}</p><p>{t('formulaResist')}</p><p>{t('formulaLevel')}</p><p>{t('formulaFinal')}</p><p>{t('formulaNote')}</p>
    </details>
  </div>
}

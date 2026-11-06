'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { useTranslations } from 'next-intl'
import { Minus, Plus, RotateCcw } from 'lucide-react'
import { abilityPower, ATTACK_TYPES, SIN_ATTRIBUTES, type SkillTraits } from '@/features/tools/lib/damage-abilities'
import { coinDamage, coinModifiers, coinPowers, MAX_COINS, parseNumberInput, parseSavedModifiers, SIN_RESIST_MAX, STAGGER_RESIST, type SavedModifier, type StaggerStage } from '@/features/tools/lib/damage'
import { COIN_IMAGES } from '@/lib/identity/skill-description'
import { toDamageSkill } from '@/features/tools/lib/skill-source'
import Dropdown from '@/components/ui/Dropdown'
import PageHeader from '@/components/ui/PageHeader'
import DamageModifiers from './DamageModifiers'
import NumberInput from './NumberInput'
import SkillLoader from './SkillLoader'
import styles from './DamageCalculator.module.css'
import arena from './CalculatorArena.module.css'

const STORAGE_KEY = 'damage-calculator-modifiers'
const DEFAULTS = {
  basePower: 4, coinPower: 4, coinCount: 3, offenseLevel: 55,
  defenseLevel: 55, physicalResist: 1, sinResist: 1, stagger: 0 as StaggerStage, observationLevel: 0,
  critical: false, clashCount: 0,
  /** Percent added to a critical hit's 20%, and the critical passives' sum in percent (the bonus is multiplied by 1 + it). */
  critAdder: 0, critPassive: 0,
  /** Flat damage: weighed by the resistances and level difference (damageAdder), or added straight (hpAdder). */
  damageAdder: 0, hpAdder: 0,
  /** The skill's sin and attack type (the game's English names, '' for neither): what a keyword's effect narrowed to one of them waits for. */
  skillSin: '', skillAtk: '',
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
  // The loaded skill (its frame is pressed in the skill card) and a key that empties the card on reset.
  const [skillKey, setSkillKey] = useState('')
  const [resetKey, setResetKey] = useState(0)
  // The saved modifiers are read after the first render, so the server and the browser draw the same page.
  const [loaded, setLoaded] = useState(false)
  useEffect(() => {
    try { setCustom(parseSavedModifiers(localStorage.getItem(STORAGE_KEY))) } catch { /* storage blocked: start empty */ }
    // The clash calculator links here with the number of exchanges its result expects (?clash=3).
    const clash = parseNumberInput(new URLSearchParams(window.location.search).get('clash') ?? '', { min: 0, max: 99 })
    if (clash !== null) setForm(current => ({ ...current, clashCount: clash }))
    setLoaded(true)
  }, [])
  useEffect(() => {
    if (!loaded) return
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(custom)) } catch { /* storage blocked or full: keep them for this visit only */ }
  }, [custom, loaded])

  const set = (patch: Partial<typeof DEFAULTS>) => setForm(current => ({ ...current, ...patch }))
  const staggerResist = STAGGER_RESIST[form.stagger]
  const skill: SkillTraits = { sin: (form.skillSin || undefined) as SkillTraits['sin'], atk: (form.skillAtk || undefined) as SkillTraits['atk'] }
  // Keywords and gifts that add power (a skill's, or the heads coin's) change the power before the damage is figured.
  const added = abilityPower(custom, skill)
  const powers = coinPowers(form.basePower + added.power, form.coinPower + added.coinPower, heads.slice(0, form.coinCount))
  const results = powers.map((power, index) => coinDamage({ ...form, critAdder: form.critAdder / 100, critPassive: form.critPassive / 100, power, modifiers: coinModifiers(custom, index + 1, skill) }))
  const total = results.reduce((sum, result) => sum + result.damage, 0)
  // A modifier set to one coin makes the factors differ from coin to coin: each coin then shows its own.
  const factors = (result: typeof results[number]) => [
    [t('damageFactor'), result.damageFactor], [t('resistFactor'), result.resistFactor],
    ...(result.finalMultiplier !== 1 ? [[t('finalMultiplier'), result.finalMultiplier]] : []),
  ] as [string, number][]
  const sameFactors = results.every(result => (['damageFactor', 'resistFactor', 'finalMultiplier'] as const).every(key => result[key] === results[0][key]))

  const coinCount = (count: number) => set({ coinCount: Math.min(MAX_COINS, Math.max(1, count)) })
  const factorRows = <dl className={styles.factors}>
    {factors(results[0]).map(([name, value]) => <div key={name}><dt>{name}</dt><dd>{factor(value)}</dd></div>)}
  </dl>

  // The attacking skill and the target face each other across the damage, as the clash calculator's sides do; what changes
  // the damage on top of them (clashes, critical, keyword and gift effects) runs the full width under them.
  return <div className={styles.page}>
    <PageHeader title={t('title')} description={t('subtitle')} actions={
      <button type="button" className={styles.reset} onClick={() => { setForm(DEFAULTS); setHeads(ALL_HEADS); setSkillKey(''); setResetKey(key => key + 1) }}><RotateCcw size={16} aria-hidden="true" />{t('reset')}</button>
    } />
    <div className={arena.arena}>
      <section className={styles.panel} aria-labelledby="damage-skill-heading">
        <h2 id="damage-skill-heading">{t('skill')}</h2>
        <SkillLoader key={resetKey} selectedKey={skillKey} onSkill={picked => {
          setSkillKey(picked?.key ?? '')
          if (picked) { set(toDamageSkill(picked, MAX_COINS)); setHeads(ALL_HEADS) }
        }} />
        <div className={`${styles.fields} ${arena.numbers}`}>
          <NumberField label={t('basePower')} value={form.basePower} max={999} onChange={basePower => set({ basePower })} />
          <NumberField label={t('coinPower')} value={form.coinPower} min={-99} max={99} onChange={coinPower => set({ coinPower })} />
          <NumberField label={t('offenseLevel')} value={form.offenseLevel} max={999} onChange={offenseLevel => set({ offenseLevel })} />
          <div className={styles.field}>{t('skillSin')}
            <Dropdown ariaLabel={t('skillSin')} buttonStyle={dropdownStyle} value={form.skillSin}
              options={[{ value: '', label: t('skillNone') }, ...Object.keys(SIN_ATTRIBUTES).map(value => ({ value, label: t(`skillSinOption.${value}`) }))]}
              onChange={skillSin => set({ skillSin })} />
          </div>
          <div className={styles.field}>{t('skillAtk')}
            <Dropdown ariaLabel={t('skillAtk')} buttonStyle={dropdownStyle} value={form.skillAtk}
              options={[{ value: '', label: t('skillNone') }, ...Object.keys(ATTACK_TYPES).map(value => ({ value, label: t(`skillAtkOption.${value}`) }))]}
              onChange={skillAtk => set({ skillAtk })} />
          </div>
        </div>
        <div className={arena.coinHead}>
          <h3>{t('coinTitle')}</h3>
          <div className={styles.stepper} role="group" aria-label={t('coinCount')}>
            <button type="button" aria-label={t('coinLess')} disabled={form.coinCount <= 1} onClick={() => coinCount(form.coinCount - 1)}><Minus size={16} aria-hidden="true" /></button>
            <b>{form.coinCount}</b>
            <button type="button" aria-label={t('coinMore')} disabled={form.coinCount >= MAX_COINS} onClick={() => coinCount(form.coinCount + 1)}><Plus size={16} aria-hidden="true" /></button>
          </div>
        </div>
        {/* Each coin turns over like the game's coin toss: the damage is for the heads and tails shown. */}
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
      <section className={`${arena.versus} ${styles.outcome}`} aria-labelledby="damage-result-heading">
        <h2 id="damage-result-heading" className={arena.versusTitle}>{t('result')}</h2>
        <div className={styles.total} aria-live="polite" aria-atomic="true"><span>{t('total')}</span><strong key={total} data-testid="damage-total">{total}</strong></div>
        <ol className={styles.coinResults}>
          {results.map((result, index) => <li key={index}>
            <span>{t('coin', { index: index + 1 })}</span><span>{t('power')} {powers[index]}</span><strong key={result.damage} data-testid={`damage-coin-${index + 1}`}>{result.damage}</strong>
            {!sameFactors && <small className={styles.coinFactors} data-testid={`damage-coin-factors-${index + 1}`}>{factors(result).map(([name, value]) => `${name} ${factor(value)}`).join(' · ')}</small>}
          </li>)}
        </ol>
        {sameFactors && factorRows}
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
          <NumberField label={t('sinResist')} value={form.sinResist} max={SIN_RESIST_MAX} decimal onChange={sinResist => set({ sinResist })} />
          <NumberField label={t('observation')} value={form.observationLevel} max={10} onChange={observationLevel => set({ observationLevel })} />
        </div>
        {staggerResist !== null && <p className={styles.hint}>{t('staggerFixed', { value: staggerResist })}</p>}
      </section>
    </div>
    <section className={`${styles.panel} ${styles.modifierPanel}`} aria-labelledby="damage-modifiers-heading">
      <h2 id="damage-modifiers-heading">{t('modifiers')}</h2>
      <div className={styles.fields}>
        <NumberField label={t('clashCount')} value={form.clashCount} max={99} onChange={clashCount => set({ clashCount })} />
        <label className={styles.check}><input type="checkbox" checked={form.critical} onChange={e => set({ critical: e.target.checked })} />{t('critical')}</label>
        <NumberField label={t('critAdder')} value={form.critAdder} min={-100} max={999} disabled={!form.critical} onChange={critAdder => set({ critAdder })} />
        <NumberField label={t('critPassive')} value={form.critPassive} min={-100} max={999} disabled={!form.critical} onChange={critPassive => set({ critPassive })} />
        <NumberField label={t('damageAdder')} value={form.damageAdder} min={-999} max={999} onChange={damageAdder => set({ damageAdder })} />
        <NumberField label={t('hpAdder')} value={form.hpAdder} min={-999} max={999} onChange={hpAdder => set({ hpAdder })} />
      </div>
      <h3>{t('custom')}</h3>
      <DamageModifiers modifiers={custom} setModifiers={setCustom} coinCount={form.coinCount} />
    </section>
    <p className={styles.hint}>{t('estimateNote')}</p>
  </div>
}

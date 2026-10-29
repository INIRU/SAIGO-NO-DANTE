'use client'

import { useMemo, useState, type CSSProperties } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useLocale, useTranslations } from 'next-intl'
import { Minus, Plus, RotateCcw } from 'lucide-react'
import PageHeader from '@/components/ui/PageHeader'
import { COIN_IMAGES } from '@/lib/identity/skill-description'
import { coinsOf, damageLink, MAX_CLASH_ROUNDS, PROBABILITY_LIMITS, SANITY_RANGE, solveClash, type ClashCoin, type ClashSide } from '@/lib/tools/clash'
import NumberInput from './NumberInput'
import SkillLoader from './SkillLoader'
import styles from './DamageCalculator.module.css'
import clash from './CalculatorArena.module.css'

type SideForm = Omit<ClashSide, 'coins'> & { coins: ClashCoin[]; skillKey: string }

const MAX_CLASH_COINS = 10
const EMPTY: SideForm = { basePower: 4, coins: [{ scale: 4, operator: 'ADD' }, { scale: 4, operator: 'ADD' }], sanity: 0, probabilityAdder: 0, powerAdder: 0, coinPowerAdder: 0, clashAdder: 0, skillKey: '' }
const SIGN = { ADD: '+', SUB: '−', MUL: '×' } as const
const percent = (value: number) => `${(value * 100).toFixed(value > 0 && value < 0.0005 ? 3 : 1)}%`

function NumberField(props: Parameters<typeof NumberInput>[0]) {
  return <label className={styles.field}>{props.label}<NumberInput {...props} /></label>
}

/**
 * One side of the clash: its skill, coins and the numbers that move its rolls. The sinner's side loads its skill from an identity
 * or E.G.O; the enemy's side is typed in, since enemies are not identities.
 */
function SidePanel({ side, title, form, onChange, resetKey }: { side: 'a' | 'b'; title: string; form: SideForm; onChange: (patch: Partial<SideForm>) => void; resetKey: number }) {
  const t = useTranslations('clash')
  const setCoin = (index: number, patch: Partial<ClashCoin>) => onChange({ coins: form.coins.map((coin, i) => i === index ? { ...coin, ...patch } : coin) })
  // New coins copy the last one, the way a skill's coins usually repeat.
  const resize = (count: number) => onChange({ coins: count < form.coins.length ? form.coins.slice(0, count) : [...form.coins, { ...form.coins[form.coins.length - 1] }] })
  return <section className={`${styles.panel} ${clash.side}`} data-side={side} aria-label={title}>
    <h2>{title}</h2>
    {side === 'a' && <SkillLoader key={resetKey} selectedKey={form.skillKey}
      onSkill={skill => onChange(skill ? { skillKey: skill.key, basePower: skill.base_power, coins: coinsOf(skill).slice(0, MAX_CLASH_COINS) } : { skillKey: '' })} />}
    <div className={clash.numbers}>
      <NumberField label={t('basePower')} value={form.basePower} max={999} onChange={basePower => onChange({ basePower })} />
      <NumberField label={t('sanity')} value={form.sanity} min={-SANITY_RANGE} max={SANITY_RANGE} onChange={sanity => onChange({ sanity })} />
    </div>
    <div className={clash.coinHead}>
      <h3>{t('coins')}</h3>
      <div className={styles.stepper} role="group" aria-label={t('coinCount')}>
        <button type="button" aria-label={t('coinLess')} disabled={form.coins.length <= 1} onClick={() => resize(form.coins.length - 1)}><Minus size={16} aria-hidden="true" /></button>
        <b>{form.coins.length}</b>
        <button type="button" aria-label={t('coinMore')} disabled={form.coins.length >= MAX_CLASH_COINS} onClick={() => resize(form.coins.length + 1)}><Plus size={16} aria-hidden="true" /></button>
      </div>
    </div>
    <ol className={clash.coinTrack}>
      {form.coins.map((coin, index) => <li key={index}>
        {/* Heads or tails is what the odds are over, so the coin is not pressed; its small sign switches adding and subtracting. */}
        <span className={clash.coin} data-operator={coin.operator}>
          <Image src={COIN_IMAGES.normal} alt="" width={64} height={64} unoptimized />
          <button type="button" aria-label={`${t('coin', { index: index + 1 })} ${t(`operatorOption.${coin.operator}`)}`} title={t(`operatorOption.${coin.operator}`)}
            onClick={() => setCoin(index, { operator: coin.operator === 'ADD' ? 'SUB' : 'ADD' })}>{SIGN[coin.operator]}</button>
        </span>
        <NumberInput label={t('coinValue', { index: index + 1 })} value={coin.scale} min={0} max={999} decimal step={coin.operator === 'MUL' ? 0.1 : 1} onChange={scale => setCoin(index, { scale })} />
      </li>)}
    </ol>
    <details className={clash.adders}>
      <summary>{t('adders')}</summary>
      <div className={styles.fields}>
        <NumberField label={t('probabilityAdder')} value={form.probabilityAdder ?? 0} min={-99} max={99} onChange={probabilityAdder => onChange({ probabilityAdder })} />
        <NumberField label={t('powerAdder')} value={form.powerAdder ?? 0} min={-99} max={99} onChange={powerAdder => onChange({ powerAdder })} />
        <NumberField label={t('coinPowerAdder')} value={form.coinPowerAdder ?? 0} min={-99} max={99} onChange={coinPowerAdder => onChange({ coinPowerAdder })} />
        <NumberField label={t('clashAdder')} value={form.clashAdder ?? 0} min={-99} max={99} onChange={clashAdder => onChange({ clashAdder })} />
      </div>
    </details>
  </section>
}

export default function ClashCalculator() {
  const t = useTranslations('clash')
  const locale = useLocale()
  const [a, setA] = useState<SideForm>(EMPTY)
  const [b, setB] = useState<SideForm>(EMPTY)
  const [resetKey, setResetKey] = useState(0)
  const result = useMemo(() => solveClash(a, b), [a, b])
  const rounds = result.rounds.map((chance, round) => ({ chance, round })).filter(row => row.chance >= 0.0005 && row.round > 0)
  const tallest = Math.max(...rounds.map(row => row.chance), 0.0001)
  const reset = () => { setA(EMPTY); setB(EMPTY); setResetKey(key => key + 1) }

  return <div className={styles.page}>
    <PageHeader title={t('title')} description={t('subtitle')} actions={
      <button type="button" className={styles.reset} onClick={reset}><RotateCcw size={16} aria-hidden="true" />{t('reset')}</button>
    } />
    <div className={clash.arena}>
      <SidePanel side="a" title={t('sideA')} form={a} onChange={patch => setA(current => ({ ...current, ...patch }))} resetKey={resetKey} />
      <section className={clash.versus} aria-labelledby="clash-result-heading">
        <h2 id="clash-result-heading" className={clash.versusTitle}>{t('result')}</h2>
        <div className={clash.odds} aria-live="polite" aria-atomic="true">
          <p className={clash.oddsA}><span>{t('sideA')}</span><strong data-testid="clash-win-a">{percent(result.winA)}</strong></p>
          <span className={clash.meter} aria-hidden="true"><i style={{ '--share': result.winA } as CSSProperties} /><i style={{ '--share': result.winB } as CSSProperties} /></span>
          <p className={clash.oddsB}><span>{t('sideB')}</span><strong data-testid="clash-win-b">{percent(result.winB)}</strong></p>
        </div>
        <dl className={styles.factors}>
          <div><dt>{t('meanRounds')}</dt><dd data-testid="clash-mean">{result.meanRounds.toFixed(2)}</dd></div>
          <div><dt>{t('headsA')}</dt><dd>{percent(result.headsA)}</dd></div>
          <div><dt>{t('headsB')}</dt><dd>{percent(result.headsB)}</dd></div>
          {result.unresolved > 0 && <div><dt>{t('unresolved', { max: MAX_CLASH_ROUNDS })}</dt><dd>{percent(result.unresolved)}</dd></div>}
        </dl>
      </section>
      <SidePanel side="b" title={t('sideB')} form={b} onChange={patch => setB(current => ({ ...current, ...patch }))} resetKey={resetKey} />
    </div>
    <section className={`${styles.panel} ${clash.outcome}`} aria-label={t('rounds')}>
      <div>
        <h3>{t('rounds')}</h3>
        {/* Each column opens the damage calculator with that many exchanges. */}
        <ol className={clash.histogram}>
          {rounds.map(({ round, chance }) => <li key={round}>
            <Link href={damageLink(locale, round)} aria-label={`${t('roundLabel', { count: round })} ${percent(chance)} · ${t('toDamage')}`}>
              <b>{percent(chance)}</b>
              <span className={clash.column}><i style={{ '--share': chance / tallest } as CSSProperties} /></span>
              <span>{round}</span>
            </Link>
          </li>)}
        </ol>
      </div>
      <div>
        <h3>{t('left')}</h3>
        {([['sideA', result.leftA], ['sideB', result.leftB]] as const).map(([side, left]) => <div key={side} className={clash.left}>
          <span>{t(side)}</span>
          <ul>{left.map((chance, count) => ({ chance, count })).filter(row => row.chance >= 0.0005).map(row => <li key={row.count}>
            <span>{t('leftCoins', { count: row.count })}</span><span className={clash.leftBar}><i style={{ '--share': row.chance } as CSSProperties} /></span><b>{percent(row.chance)}</b>
          </li>)}</ul>
        </div>)}
        <p className={styles.hint}>{t('limitNote', { min: PROBABILITY_LIMITS.min * 100, max: PROBABILITY_LIMITS.max * 100 })}</p>
      </div>
    </section>
    <details className={styles.details}>
      <summary>{t('rules')}</summary>
      <p>{t('rulesHeads')}</p><p>{t('rulesCoins')}</p><p>{t('rulesExchange')}</p><p>{t('rulesDamage')}</p>
    </details>
  </div>
}

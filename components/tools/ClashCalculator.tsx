'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import useSWR from 'swr'
import { useLocale, useTranslations } from 'next-intl'
import { Plus, RotateCcw, Search, Trash2 } from 'lucide-react'
import Dropdown from '@/components/ui/Dropdown'
import PageHeader from '@/components/ui/PageHeader'
import { coinsOf, damageLink, MAX_CLASH_ROUNDS, PROBABILITY_LIMITS, SANITY_RANGE, solveClash, type ClashCoin, type ClashSide, type CoinOperator } from '@/lib/tools/clash'
import NumberInput from './NumberInput'
import styles from './DamageCalculator.module.css'
import clash from './ClashCalculator.module.css'

type Skill = { key: string; label: string; type: string | null; coins: number; base_power: number; coin_power: number; coin_list: { scale: number; operator: string }[] | null }
type Identity = { id: string; label: string; sinner: string | null; skills: Skill[] }
type SideForm = Omit<ClashSide, 'coins'> & { coins: ClashCoin[]; identityId: string; skillKey: string }

const MAX_CLASH_COINS = 10
const EMPTY: SideForm = { basePower: 4, coins: [{ scale: 4, operator: 'ADD' }, { scale: 4, operator: 'ADD' }], sanity: 0, probabilityAdder: 0, powerAdder: 0, coinPowerAdder: 0, clashAdder: 0, identityId: '', skillKey: '' }
const OPERATORS: CoinOperator[] = ['ADD', 'SUB', 'MUL']
const dropdownStyle = {width:'100%',justifyContent:'space-between',minHeight:'2.75rem',padding:'.7rem',background:'var(--bg-deep)',borderColor:'var(--border)',fontSize:'.9375rem',color:'var(--text-primary)'}
const percent = (value: number) => `${(value * 100).toFixed(value > 0 && value < 0.0005 ? 3 : 1)}%`

const fetchSkills = async (url: string): Promise<{ identities: Identity[] }> => {
  const response = await fetch(url)
  if (!response.ok) throw new Error(String(response.status))
  const data = await response.json()
  // A copy of another shape (an older one still held by the CDN) is a failed load, not a list.
  if (!Array.isArray(data?.identities)) throw new Error('Unexpected response')
  return data
}

function NumberField(props: Parameters<typeof NumberInput>[0]) {
  return <label className={styles.field}>{props.label}<NumberInput {...props} /></label>
}

/** One side of the clash: its skill (picked from an identity or typed in) and the numbers that move its rolls. */
function SidePanel({ title, form, onChange, identities, loading, failed }: { title: string; form: SideForm; onChange: (patch: Partial<SideForm>) => void; identities: Identity[]; loading: boolean; failed: boolean }) {
  const t = useTranslations('clash')
  const [query, setQuery] = useState('')
  const identity = identities.find(candidate => candidate.id === form.identityId)
  const matches = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase()
    return needle ? identities.filter(candidate => candidate.label.toLocaleLowerCase().includes(needle)).slice(0, 6) : []
  }, [identities, query])
  const pick = (skill: Skill) => onChange({ skillKey: skill.key, basePower: skill.base_power, coins: coinsOf(skill).slice(0, MAX_CLASH_COINS) })
  const setCoin = (index: number, patch: Partial<ClashCoin>) => onChange({ coins: form.coins.map((coin, i) => i === index ? { ...coin, ...patch } : coin) })
  return <section className={styles.panel} aria-label={title}>
    <h2>{title}</h2>
    <label className={styles.search}>
      <Search size={16} aria-hidden="true" />
      <input type="text" aria-label={t('searchIdentity')} placeholder={t('searchIdentity')} value={query} onChange={event => setQuery(event.target.value)} />
    </label>
    {(loading || failed) && <p className={styles.hint} role={failed ? 'alert' : 'status'}>{failed ? t('loadError') : t('loading')}</p>}
    {matches.length > 0 && <div className={clash.matches} role="listbox" aria-label={t('searchIdentity')}>
      {matches.map(candidate => <button key={candidate.id} type="button" role="option" aria-selected={candidate.id === form.identityId} className={styles.chip}
        onClick={() => { onChange({ identityId: candidate.id, skillKey: '' }); setQuery('') }}>{candidate.label}</button>)}
    </div>}
    {identity && <div className={`${styles.field} ${clash.skillPick}`}>{identity.label}
      <Dropdown ariaLabel={t('skill')} buttonStyle={dropdownStyle} value={form.skillKey}
        options={[{ value: '', label: t('skillChoose') }, ...identity.skills.map(skill => ({ value: skill.key, label: skill.label }))]}
        onChange={key => { const skill = identity.skills.find(candidate => candidate.key === key); if (skill) pick(skill); else onChange({ skillKey: '' }) }} />
    </div>}
    <div className={styles.fields}>
      <NumberField label={t('basePower')} value={form.basePower} max={999} onChange={basePower => onChange({ basePower })} />
      <NumberField label={t('sanity')} value={form.sanity} min={-SANITY_RANGE} max={SANITY_RANGE} onChange={sanity => onChange({ sanity })} />
    </div>
    <h3>{t('coins')}</h3>
    <ol className={clash.coinRows}>
      {form.coins.map((coin, index) => <li key={index}>
        <span>{t('coin', { index: index + 1 })}</span>
        <Dropdown ariaLabel={t('operator')} buttonStyle={dropdownStyle} value={coin.operator}
          options={OPERATORS.map(operator => ({ value: operator, label: t(`operatorOption.${operator}`) }))} onChange={operator => setCoin(index, { operator })} />
        <NumberInput label={t('coinValue', { index: index + 1 })} value={coin.scale} min={0} max={999} decimal step={coin.operator === 'MUL' ? 0.1 : 1} onChange={scale => setCoin(index, { scale })} />
        <button type="button" className={`${styles.remove} ${styles.trash}`} aria-label={t('coinRemove', { index: index + 1 })} disabled={form.coins.length <= 1} onClick={() => onChange({ coins: form.coins.filter((_, i) => i !== index), skillKey: '' })}><Trash2 size={16} aria-hidden="true" /></button>
      </li>)}
    </ol>
    <button type="button" className={styles.add} disabled={form.coins.length >= MAX_CLASH_COINS} onClick={() => onChange({ coins: [...form.coins, { scale: 4, operator: 'ADD' }], skillKey: '' })}><Plus size={16} aria-hidden="true" />{t('coinAdd')}</button>
    <h3>{t('adders')}</h3>
    <div className={styles.fields}>
      <NumberField label={t('probabilityAdder')} value={form.probabilityAdder ?? 0} min={-99} max={99} onChange={probabilityAdder => onChange({ probabilityAdder })} />
      <NumberField label={t('powerAdder')} value={form.powerAdder ?? 0} min={-99} max={99} onChange={powerAdder => onChange({ powerAdder })} />
      <NumberField label={t('coinPowerAdder')} value={form.coinPowerAdder ?? 0} min={-99} max={99} onChange={coinPowerAdder => onChange({ coinPowerAdder })} />
      <NumberField label={t('clashAdder')} value={form.clashAdder ?? 0} min={-99} max={99} onChange={clashAdder => onChange({ clashAdder })} />
    </div>
  </section>
}

export default function ClashCalculator() {
  const t = useTranslations('clash')
  const locale = useLocale()
  const [a, setA] = useState<SideForm>(EMPTY)
  const [b, setB] = useState<SideForm>(EMPTY)
  // The skills are asked for once the page is open, then kept: they only change with a game data sync.
  const { data, error, isLoading } = useSWR(`/api/clash-skills/${locale}`, fetchSkills, { revalidateOnFocus: false })
  const result = useMemo(() => solveClash(a, b), [a, b])
  const rounds = result.rounds.map((chance, round) => ({ chance, round })).filter(row => row.chance >= 0.0005 && row.round > 0)
  const rest = result.winA + result.winB - rounds.reduce((sum, row) => sum + row.chance, 0)
  const identities = data?.identities ?? []

  return <div className={styles.page}>
    <PageHeader title={t('title')} description={t('subtitle')} actions={
      <button type="button" className={styles.reset} onClick={() => { setA(EMPTY); setB(EMPTY) }}><RotateCcw size={16} aria-hidden="true" />{t('reset')}</button>
    } />
    <div className={styles.workspace}>
      <div className={styles.inputs}>
        <SidePanel title={t('sideA')} form={a} onChange={patch => setA(current => ({ ...current, ...patch }))} identities={identities} loading={isLoading} failed={!!error} />
        <SidePanel title={t('sideB')} form={b} onChange={patch => setB(current => ({ ...current, ...patch }))} identities={identities} loading={isLoading} failed={!!error} />
      </div>
      <section className={`${styles.panel} ${styles.result}`} aria-labelledby="clash-result-heading">
        <h2 id="clash-result-heading">{t('result')}</h2>
        <div className={styles.total} aria-live="polite" aria-atomic="true"><span>{t('sideA')}</span><strong data-testid="clash-win-a">{percent(result.winA)}</strong></div>
        <dl className={styles.factors}>
          <div><dt>{t('sideB')}</dt><dd data-testid="clash-win-b">{percent(result.winB)}</dd></div>
          {result.unresolved > 0 && <div><dt>{t('unresolved', { max: MAX_CLASH_ROUNDS })}</dt><dd>{percent(result.unresolved)}</dd></div>}
          <div><dt>{t('headsA')}</dt><dd>{percent(result.headsA)}</dd></div>
          <div><dt>{t('headsB')}</dt><dd>{percent(result.headsB)}</dd></div>
          <div><dt>{t('meanRounds')}</dt><dd data-testid="clash-mean">{result.meanRounds.toFixed(2)}</dd></div>
        </dl>
        <h3>{t('rounds')}</h3>
        <ol className={clash.distribution}>
          {rounds.map(({ round, chance }) => <li key={round}>
            <span>{t('roundLabel', { count: round })}</span>
            <span className={clash.bar} aria-hidden="true"><i style={{ width: `${Math.max(2, chance * 100)}%` }} /></span>
            <b>{percent(chance)}</b>
            <Link href={damageLink(locale, round)} className={styles.retry}>{t('toDamage')}</Link>
          </li>)}
          {rest > 0.0005 && <li><span>{t('restRounds')}</span><span /><b>{percent(rest)}</b><span /></li>}
        </ol>
        <h3>{t('left')}</h3>
        {([['sideA', result.leftA], ['sideB', result.leftB]] as const).map(([side, left]) => <p key={side} className={clash.left}>
          <span>{t(side)}</span>{left.map((chance, count) => ({ chance, count })).filter(row => row.chance >= 0.0005).map(row => `${t('leftCoins', { count: row.count })} ${percent(row.chance)}`).join(' · ')}
        </p>)}
        <p className={styles.hint}>{t('limitNote', { min: PROBABILITY_LIMITS.min * 100, max: PROBABILITY_LIMITS.max * 100 })}</p>
      </section>
    </div>
    <details className={styles.details}>
      <summary>{t('rules')}</summary>
      <p>{t('rulesHeads')}</p><p>{t('rulesCoins')}</p><p>{t('rulesExchange')}</p><p>{t('rulesDamage')}</p>
    </details>
  </div>
}

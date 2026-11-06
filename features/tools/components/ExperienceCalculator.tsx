'use client'

import { useState } from 'react'
import Image from 'next/image'
import { useLocale, useTranslations } from 'next-intl'
import { ArrowRight, RotateCcw } from 'lucide-react'
import { experienceNeeded, LEVEL_COSTS, MAX_EXPERIENCE_LEVEL, LUXCAVATIONS, planLuxcavation, TICKET_EXP, TICKET_NAMES, ticketExperience, type Tickets } from '@/features/tools/lib/experience'
import { getResourceIconUrl } from '@/lib/utils/images'
import Dropdown from '@/components/ui/Dropdown'
import styles from './ExperienceCalculator.module.css'
import PageHeader from '@/components/ui/PageHeader'
const dropdownStyle = {width:'100%',justifyContent:'space-between',padding:'.7rem',background:'var(--bg-deep)',borderColor:'var(--border)',fontFamily:'var(--font-mono)',fontSize:'1rem',color:'var(--text-primary)'}

const ticketIcons = ['ticket-1','ticket-2','ticket-3','ticket-4'] as const
function ResourceImage({ name, className }: {name: Parameters<typeof getResourceIconUrl>[0]; className?: string}) {
  return <Image src={getResourceIconUrl(name)} alt="" width={128} height={128} className={className} />
}
export default function ExperienceCalculator() {
  const t = useTranslations('experience')
  const locale = useLocale()
  const number = (n: number) => n.toLocaleString(locale)
  const [current, setCurrent] = useState(1)
  const [target, setTarget] = useState(MAX_EXPERIENCE_LEVEL)
  const [progress, setProgress] = useState(0)
  const [inventory, setInventory] = useState<Tickets>([0,0,0,0])
  const [stage, setStage] = useState(LUXCAVATIONS.length)
  const [skip, setSkip] = useState(false)
  const required = experienceNeeded(current, target, progress)
  const owned = ticketExperience(inventory)
  const manual = planLuxcavation(required, inventory, stage, false)
  const skipped = planLuxcavation(required, inventory, stage, true)
  const selected = skip ? skipped : manual
  const maxProgress = current === MAX_EXPERIENCE_LEVEL ? 0 : LEVEL_COSTS[current + 1] - 1
  return <div className={styles.page}>
    <PageHeader title={t('title')} description={t('subtitle')} />
    <div className={styles.workspace}>
      <div className={styles.inputs}>
        <section className={styles.panel} aria-labelledby="level-heading">
          <h2 id="level-heading"><span>01</span>{t('levels')}</h2>
          <div className={styles.levels}>
            <div className={styles.fieldLabel}>{t('current')}<Dropdown ariaLabel={t('current')} className={styles.levelDropdown} buttonStyle={dropdownStyle} value={String(current)} options={Array.from({length:MAX_EXPERIENCE_LEVEL},(_,i)=>({value:String(i+1),label:`Lv. ${i+1}`}))} onChange={value=>{const n=Number(value);setCurrent(n);setTarget(Math.max(n,target));setProgress(0)}} /></div>
            <ArrowRight aria-hidden="true" />
            <div className={styles.fieldLabel}>{t('target')}<Dropdown ariaLabel={t('target')} className={styles.levelDropdown} buttonStyle={dropdownStyle} value={String(target)} options={Array.from({length:MAX_EXPERIENCE_LEVEL+1-current},(_,i)=>({value:String(i+current),label:`Lv. ${i+current}`}))} onChange={value=>setTarget(Number(value))} /></div>
          </div>
          <label className={styles.progress}>{t('progress')}<div><input aria-label={t('progress')} type="number" inputMode="numeric" min={0} max={maxProgress} disabled={current===MAX_EXPERIENCE_LEVEL} value={progress} onChange={e=>setProgress(Math.max(0,Math.min(maxProgress,Math.trunc(Number(e.target.value)||0))))}/><span>/ {number(current===MAX_EXPERIENCE_LEVEL ? 0 : LEVEL_COSTS[current+1])}</span></div></label>
        </section>
        <section className={styles.panel} aria-labelledby="inventory-heading">
          <div className={styles.sectionHeading}><h2 id="inventory-heading"><span>02</span>{t('inventory')}</h2><button className={styles.reset} type="button" title={t('reset')} aria-label={t('reset')} onClick={()=>setInventory([0,0,0,0])}><RotateCcw size={16}/></button></div>
          <p className={styles.hint}>{t('inventoryHelp')}</p>
          <div className={styles.inventory}>{TICKET_NAMES.map((tier,i)=><label key={tier} className={styles.ticketInput}>
            <ResourceImage name={ticketIcons[i]} />
            <span className={styles.ticketTier}>{tier}<small>{number(TICKET_EXP[i])} EXP</small></span>
            <input aria-label={t('ticket',{tier})} type="number" inputMode="numeric" min={0} max={99999} value={inventory[i]} onChange={e=>setInventory(inventory.map((n,j)=>i===j ? Math.max(0,Math.min(99999,Math.trunc(Number(e.target.value)||0))) : n) as Tickets)}/>
          </label>)}</div>
        </section>
      </div>
      <section className={`${styles.panel} ${styles.farming}`} aria-labelledby="farming-heading">
        <h2 id="farming-heading"><span>03</span>{t('farming')}</h2>
        <div className={styles.balance} aria-live="polite" aria-atomic="true">
          <span>{t('required')}</span><strong data-testid="required-exp">{number(required)}<small>EXP</small></strong>
          <dl><div><dt>{t('owned')}</dt><dd>{number(owned)}</dd></div><div><dt>{t('missing')}</dt><dd data-testid="missing-exp">{number(Math.max(0,required-owned))}</dd></div></dl>
        </div>
        <div className={`${styles.stage} ${styles.fieldLabel}`}>{t('stage')}<Dropdown ariaLabel={t('stage')} buttonStyle={dropdownStyle} value={String(stage)} options={LUXCAVATIONS.map(x=>({value:String(x.stage),label:t('stageOption',{stage:x.stage})}))} onChange={value=>setStage(Number(value))} /></div>
        <fieldset className={styles.methods}><legend className="sr-only">{t('farming')}</legend>{[manual,skipped].map((method,i)=><label key={i} className={`${styles.method} ${skip===(i===1) ? styles.selected : ''}`}>
          <input type="radio" name="farming-method" checked={skip===(i===1)} onChange={()=>setSkip(i===1)}/><span>{t(i ? 'skip' : 'manual')}</span>
          <strong data-testid={i ? 'skip-runs' : 'manual-runs'}>{t('runCount',{count:method.runs})}</strong>
          <div className={styles.moduleLine}><ResourceImage name="module"/><span>{t('moduleCount',{count:method.modules})}</span></div>
          <small>{t('perRun')} {number(method.experience)} EXP</small>
          <small>{t('perModule')} {number(Math.round(method.experience/(LUXCAVATIONS[stage-1].modules*(i ? 2 : 1))))}</small>
        </label>)}</fieldset>
        <div className={styles.reward}><span>{t('reward')}</span><div>{selected.reward.map((count,i)=> count>0 && <span key={i} title={t('ticket',{tier:TICKET_NAMES[i]})}><ResourceImage name={ticketIcons[i]}/><b>×{count}</b></span>)}</div></div>
        <p className={styles.fixed}>{t('fixed')}</p>
        <p className={styles.hint}>{t('skipHelp')}</p>
      </section>
    </div>
    <section className={`${styles.panel} ${styles.results}`} aria-labelledby="results-heading">
      <div className={styles.sectionHeading}><h2 id="results-heading">{t('recommendation')}</h2><span className={styles.methodBadge}>{t(skip ? 'skip' : 'manual')}</span></div>
      <p className={styles.hint}>{required===0 ? t('already') : selected.runs===0 ? t('noFarm') : t('planHelp')}</p>
      <div className={styles.resultGrid}>
        <div className={styles.ticketResults}>{TICKET_NAMES.map((tier,i)=><div key={tier} className={styles.ticketResult}>
          <ResourceImage name={ticketIcons[i]}/><span>{tier}</span><strong data-testid={`use-ticket-${i+1}`}>{number(selected.plan.used[i])}<small>{t('use')}</small></strong><p>{t('left')} <b>{number(selected.plan.left[i])}</b></p>
        </div>)}</div>
        <dl className={styles.totals}><div><dt>{t('spent')}</dt><dd>{number(selected.plan.spent)} EXP</dd></div><div><dt>{t('excess')}</dt><dd data-testid="excess-exp">+{number(selected.plan.excess)} EXP</dd></div><div className={styles.enkephalin}><dt><ResourceImage name="enkephalin"/>{t('enkephalin')}</dt><dd>{number(selected.enkephalin)}</dd></div></dl>
      </div><p className={styles.hint}>{t('excessHelp')}</p>
    </section>
    <details className={styles.details}><summary>{t('levelTable')}</summary><div className={styles.tableWrap}><table><thead><tr><th>{t('level')}</th><th>{t('cumulative')}</th><th>{t('next')}</th></tr></thead><tbody>{Array.from({length:MAX_EXPERIENCE_LEVEL},(_,i)=><tr key={i}><td>{i+1}</td><td>{number(experienceNeeded(1,i+1))}</td><td>{i===MAX_EXPERIENCE_LEVEL-1 ? t('max') : number(LEVEL_COSTS[i+2])}</td></tr>)}</tbody></table></div></details>
  </div>
}

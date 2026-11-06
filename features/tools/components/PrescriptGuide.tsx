'use client'

import { ArrowLeft } from 'lucide-react'
import { useTranslations } from 'next-intl'
import BackLink from '@/components/navigation/BackLink'
import { START_FORMATION_POINTS, STRENGTH_POINTS } from '@/features/tools/lib/prescript'
import styles from './prescript.module.css'

/**
 * The mode's rules in plain words, not the Index's voice (USER 2026-11-04): the flow, the kinds of prescripts, how grace is
 * counted, what the screen is read for and what to watch. The two point tables come from the rules' own constants.
 */
export default function PrescriptGuide() {
  const t = useTranslations('prescriptMode')
  const sections = t.raw('guide.sections') as { title: string; items: string[] }[]
  const stars = [1, 2, 3]
  return <div className={styles.root}>
    <div className={styles.wrap}>
      <header className={styles.head}>
        <BackLink href="/prescript" parent aria-label={t('toHub')} title={t('toHub')} className={styles.back}><ArrowLeft size={18} aria-hidden="true" /></BackLink>
        <h1>{t('guideTitle')}</h1>
      </header>
      <article className={styles.guide}>
        <p>{t('guide.intro')}</p>
        {sections.map(section => <section key={section.title}>
          <h2>{section.title}</h2>
          <ul>{section.items.map(item => <li key={item}>{item}</li>)}</ul>
        </section>)}
        <section>
          <h2>{t('guide.pointsTitle')}</h2>
          <table>
            <thead><tr><th scope="col">{t('guide.strength')}</th>{STRENGTH_POINTS.map((_, i) => <th key={i} scope="col">{i + 1}</th>)}</tr></thead>
            <tbody><tr><th scope="row">{t('guide.base')}</th>{STRENGTH_POINTS.map((points, i) => <td key={i}>{points}</td>)}</tr></tbody>
          </table>
          <p>{t('guide.example')}</p>
        </section>
        <section>
          <h2>{t('guide.formationTitle')}</h2>
          <table>
            <thead><tr><th scope="col">{t('guide.stars')}</th>{stars.map(star => <th key={star} scope="col">{star}★</th>)}</tr></thead>
            <tbody><tr><th scope="row">{t('guide.base')}</th>{stars.map(star => <td key={star}>{START_FORMATION_POINTS[star]}</td>)}</tr></tbody>
          </table>
        </section>
      </article>
    </div>
  </div>
}

'use client'

import { useState, type ReactNode } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Link, useRouter } from '@/lib/i18n/navigation'
import { getLocalizedName } from '@/lib/i18n/localize'
import { constraintSource } from '@/lib/planner/constraints'
import type { SupportedLang } from '@/lib/i18n/types'
import type { CountStat, MetaData, MetaGift } from '@/lib/meta/types'
import GiftCard from '@/features/mirror-dungeon/components/GiftCard'
import ThemePackCard from '@/components/ui/ThemePackCard'
import { PlanInsights, PopularPosts } from './MetaSections'
import styles from '@/styles/components/MetaAnalysis.module.css'

const ROUTES_SHOWN = 20
const SMALL_SAMPLE = 20

function Share({ value }: { value: number }) {
  return <span className={styles.share}>{value.toFixed(1)}<small>%</small></span>
}

/** Floor-by-floor choices of the plans in scope: packs, gifts per floor, start/observation gifts, enhancement and cards. */
export default function DungeonAnalysis({ data }: { data: MetaData }) {
  const t = useTranslations('meta.analysis')
  const locale = useLocale() as SupportedLang
  const router = useRouter()
  const [allRoutes, setAllRoutes] = useState(false)
  const dungeon = data.dungeon
  if (!dungeon?.plans) return <div className={styles.panel}><p className={styles.empty}>{t('dungeonEmpty')}</p></div>

  const plans = dungeon.plans
  const board = (param: string, value: string) => '/planner/community?browse=all&' + param + '=' + value
  const giftName = (gift: MetaGift) => getLocalizedName({ name_kr: gift.name, name_en: gift.name_en, name_jp: gift.name_jp }, locale)
  const withGift = <T extends { key: string }>(rows: T[]) => rows.flatMap(row => data.giftCatalog?.[row.key] ? [{ ...row, gift: data.giftCatalog[row.key] }] : [])
  const giftCell = (gift: MetaGift, key: string, label: string, stat: ReactNode) => <li key={key}>
    <GiftCard gift={{ ...gift, name: giftName(gift) }} showName onClick={() => router.push(board('gf', key))} ariaLabel={giftName(gift) + ' ' + label} />
    <div className={styles.egoStat}>{stat}</div>
  </li>
  const shareCell = (gift: MetaGift, key: string, count: number, total: number) => giftCell(gift, key, (count / total * 100).toFixed(1) + '%',
    <><Share value={count / total * 100} /><span className={styles.legendCount}>{t('count', { count })}</span></>)
  const giftSection = (id: string, title: string, rows: CountStat[]) => {
    const shown = withGift(rows)
    return <section className={styles.panel} aria-labelledby={id}>
      <div className={styles.sectionHead}><h3 id={id}>{title}</h3><span>{t('plansBasis', { count: plans })}</span></div>
      {shown.length ? <ul className={styles.giftGrid}>{shown.map(row => shareCell(row.gift, row.key, row.count, plans))}</ul> : <p className={styles.empty}>{t('empty')}</p>}
    </section>
  }
  const routes = withGift(dungeon.routes)
  const enhanced = withGift(dungeon.enhanced)
  // Every card offered on the floor, picked or not, least picked last: that is the card plans leave out.
  const cardFloors = (Array.isArray(dungeon.constraints) ? dungeon.constraints : []).map(floor => {
    const ids = new Set([...constraintSource.constraints.filter(card => card.flooridx === floor.floor - 1).map(card => String(card.id)), ...floor.cards.map(row => row.key)])
    const cards = [...ids].flatMap(id => {
      const card = constraintSource.constraints.find(entry => String(entry.id) === id)
      return card ? [{ card, count: floor.cards.find(row => row.key === id)?.count ?? 0 }] : []
    }).sort((a, b) => b.count - a.count || a.card.score - b.card.score)
    return { ...floor, cards }
  })

  return <div className={styles.analysis} data-meta-dungeon>
    {plans < SMALL_SAMPLE && <p className={styles.caution}>{t('dungeonSmallSample', { count: plans })}</p>}
    <PlanInsights summary={data.planStats} data={data} headingId="plans-heading" />

    <section className={styles.panel} aria-labelledby="floor-themes-heading" data-meta-floors>
      <div className={styles.sectionHead}><h3 id="floor-themes-heading">{t('floorThemes')}</h3><span>{t('floorThemesBasis')}</span></div>
      <ul className={styles.floorGrid}>{dungeon.floors.map(floor => {
        const [top, ...rest] = floor.themes.flatMap(row => data.themeCatalog?.[row.key] ? [{ ...row, theme: data.themeCatalog[row.key] }] : [])
        if (!top) return null
        const themeName = (theme: typeof top.theme) => getLocalizedName({ name_kr: theme.name, name_en: theme.name_en, name_jp: theme.name_jp }, locale)
        return <li key={floor.floor} className={styles.floorCell}>
          <span className={styles.sinnerHead}><b className={styles.floorNumber}>{t('floorLabel', { floor: floor.floor })}</b><em>{t('count', { count: floor.plans })}</em></span>
          <div className={styles.floorTop}>
            <div className={styles.floorCard}><ThemePackCard theme={top.theme} sizes="6rem" imageSurface="bare" lang={locale} ariaLabel={themeName(top.theme) + ' ' + (top.count / floor.plans * 100).toFixed(1) + '%'} onClick={() => router.push(board('tp', top.key))} /></div>
            <div className={styles.floorText}>
              <span className={styles.sinnerName}>{themeName(top.theme)}</span>
              <Share value={top.count / floor.plans * 100} />
              {rest.length > 0 && <ol className={styles.floorRest}>{rest.map(row => <li key={row.key}>
                <Link href={board('tp', row.key)}>{themeName(row.theme)}</Link><em>{(row.count / floor.plans * 100).toFixed(1)}%</em>
              </li>)}</ol>}
            </div>
          </div>
        </li>
      })}</ul>
    </section>

    <section className={styles.panel} aria-labelledby="gift-routes-heading" data-meta-routes>
      <div className={styles.sectionHead}><h3 id="gift-routes-heading">{t('giftRoutes')}</h3><span>{t('giftRoutesBasis', { count: plans })}</span></div>
      {routes.length ? <ul className={styles.giftGrid}>{(allRoutes ? routes : routes.slice(0, ROUTES_SHOWN)).map(row => giftCell(row.gift, row.key, (row.count / plans * 100).toFixed(1) + '%', <>
        <Share value={row.count / plans * 100} />
        <span className={styles.legendCount}>{t('mostlyOn', { floors: row.floors.map(floor => floor.key).join('·') })}</span>
      </>))}</ul> : <p className={styles.empty}>{t('empty')}</p>}
      {routes.length > ROUTES_SHOWN && <button type="button" onClick={() => setAllRoutes(value => !value)} className={styles.moreButton}>{allRoutes ? t('less') : t('moreItems', { count: routes.length - ROUTES_SHOWN })}</button>}
    </section>

    <div className={styles.halfRow}>
      {giftSection('start-gifts-heading', t('startGifts'), dungeon.start)}
      {giftSection('observe-gifts-heading', t('observeGifts'), dungeon.observe)}
    </div>

    {enhanced.length > 0 && <section className={styles.panel} aria-labelledby="enhanced-heading">
      <div className={styles.sectionHead}><h3 id="enhanced-heading">{t('enhanced')}</h3><span>{t('plansBasis', { count: plans })}</span></div>
      <ul className={styles.giftGrid}>{enhanced.map(row => giftCell(row.gift, row.key, '+' + row.plus + ' ++' + row.plusplus, <>
        <Share value={(row.plus + row.plusplus) / plans * 100} />
        <span className={styles.enhanceSplit}><b>+</b>{row.plus}<b>++</b>{row.plusplus}</span>
      </>))}</ul>
    </section>}

    {cardFloors.length > 0 && <section className={styles.panel} aria-labelledby="constraints-heading" data-meta-constraints>
      <div className={styles.sectionHead}><h3 id="constraints-heading">{t('constraints')}</h3><span>{t('constraintsBasis')}</span></div>
      <ol className={styles.constraintFloors}>{cardFloors.map(floor => <li key={floor.floor}>
        <span className={styles.constraintFloorHead}><b className={styles.floorNumber}>{t('floorLabel', { floor: floor.floor })}</b><em>{t('count', { count: floor.plans })}</em></span>
        <ul className={styles.constraintCards}>{floor.cards.map(({ card, count }) => {
          const share = count / floor.plans * 100
          return <li key={card.id} data-skipped={share < 90 || undefined} title={card.descriptions[locale] ?? card.descriptions.ko}>
            <span className={styles.constraintScore} aria-label={t('constraintScore', { score: card.score })}>{card.score}</span>
            <span className={styles.constraintName}>{card.names[locale] ?? card.names.ko}</span>
            <span className={styles.constraintShare}>{share.toFixed(0)}<small>%</small></span>
          </li>
        })}</ul>
      </li>)}</ol>
    </section>}
    <PopularPosts data={data} sources={['planner']} />
  </div>
}

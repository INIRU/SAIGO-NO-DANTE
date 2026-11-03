'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { ArrowLeft } from 'lucide-react'
import BackLink from '@/components/navigation/BackLink'
import { useHtmlFlag } from '@/hooks/useHtmlFlag'
import { useLocale, useTranslations } from 'next-intl'
import IndexIntro from '@/components/fun/prescript/IndexIntro'
import PrescriptStage from '@/components/fun/prescript/PrescriptStage'
import styles from '@/components/fun/prescript/prescript.module.css'
import { giftKeywordLabel } from '@/components/gifts/GiftCatalog'
import type { PrescriptContext, PrescriptGoal } from '@/lib/fun/prescript'
import { useAssistCapture } from '@/lib/hooks/useAssistCapture'
import { useCompanionWindow } from '@/lib/hooks/useCompanionWindow'
import { usePrescript } from '@/lib/hooks/usePrescript'
import type { SupportedLang } from '@/lib/i18n'
import { buildGiftMap, findAvailableFusions, getAvailableThemes, giftTier } from '@/lib/planner/fusion'
import { getLegacyPlanFloorDifficulty } from '@/lib/planner/floor-difficulty'
import { DIFFICULTY_FLOOR_KEY, type GiftData, type RecipeData, type ThemeData } from '@/lib/planner/types'
import { readGameLanguage, type GameLanguage } from '@/lib/vision/recognition-profile'
import { shelfGift } from '@/lib/vision/shop-shelf'

/** The prescripts are drawn for the run the mode is meant for: Extreme, to the 15th floor. */
const RUN_DIFFICULTY = 'extreme'

export default function PrescriptClient({ themes, gifts, recipes, dataError }: { themes: ThemeData[]; gifts: GiftData[]; recipes: RecipeData[]; dataError?: boolean }) {
  const t = useTranslations('prescriptMode')
  // the Index's own screen: no site navigation or footer (its header links back)
  useHtmlFlag('with-prescript')
  const lang = useLocale() as SupportedLang
  // The game client's language picks the text reader's model and the gift names it compares (the Assist's own setting).
  const [gameLanguage, setGameLanguage] = useState<GameLanguage>(lang === 'en' || lang === 'ja' ? lang : 'ko')
  useEffect(() => { setGameLanguage(current => readGameLanguage(window.localStorage, current)) }, [])
  const giftMap = useMemo(() => buildGiftMap(gifts), [gifts])
  const giftReferences = useMemo(() => gifts.map(gift => ({ id: String(gift.game_id), imageUrl: gift.image_url })), [gifts])
  const ocrCatalog = useMemo(() => ({
    gifts: gifts.map(gift => ({ id: String(gift.game_id), effectTexts: [],
      texts: (gameLanguage === 'en' ? [gift.name_en, gift.name, gift.name_jp] : gameLanguage === 'ja' ? [gift.name_jp, gift.name, gift.name_en]
        : [gift.name, gift.name_en, gift.name_jp]).filter((value): value is string => Boolean(value)) })),
    events: [], choices: [],
  }), [gifts, gameLanguage])
  const themeCatalog = useMemo(() => themes.map(theme => ({ id: String(theme.id),
    texts: [theme.name, theme.name_en, theme.name_jp].filter((value): value is string => Boolean(value)) })), [themes])
  const giftPrice = useCallback((id: string) => giftMap.get(Number(id))?.price, [giftMap])

  // What the page knows of the run comes only from the screen: the floor from the banner, the gifts from the evidence.
  // 0 until a floor is read: a run joined midway must not have its floor-bound prescripts tied to a guessed floor
  const [floor, setFloor] = useState(0)
  const [held, setHeld] = useState<string[]>([])
  const capture = useAssistCapture({ giftReferences, ocrCatalog, themeCatalog, language: gameLanguage, floor, heldGiftIds: held, giftPrice })
  useEffect(() => { if (capture.observedFloor) setFloor(capture.observedFloor) }, [capture.observedFloor])
  // a confirmed pack pick is that floor at once, in the same render as its judging, so the next cards are drawn for it
  useEffect(() => { if (capture.floorThemeObservation) setFloor(capture.floorThemeObservation.floor) }, [capture.floorThemeObservation])

  const running = capture.status === 'running'
  const shelf = running && capture.shopShelf && Date.now() - capture.shopShelf.observedAt < 3000 ? capture.shopShelf : null
  const shelfKey = (shelf?.slots ?? []).map(slot => `${shelfGift(slot)}:${slot.sold}`).join(',')
  const shelfIds = useMemo(() => shelfKey.split(',').filter(item => item.endsWith(':false') && !item.startsWith('null'))
    .map(item => Number(item.split(':')[0])), [shelfKey])
  const context = useMemo<PrescriptContext>(() => ({
    floor, inventory: held, planGiftIds: new Set<number>(),
    gift: id => { const gift = giftMap.get(id); return gift ? { keyword: gift.keyword, tier: giftTier(gift) } : undefined },
    craftable: () => findAvailableFusions(held, recipes, giftMap).filter(fusion => fusion.canCraft && fusion.result).map(fusion => fusion.result!.game_id),
    themesOn: next => getAvailableThemes(themes, DIFFICULTY_FLOOR_KEY[getLegacyPlanFloorDifficulty(RUN_DIFFICULTY, next)], next).map(theme => theme.id),
    random: Math.random, shelf: shelfIds,
  }), [floor, held, giftMap, recipes, themes, shelfIds])
  const prescript = usePrescript({ enabled: true, status: capture.status, acquisitions: capture.popupAcquisitions, sales: capture.giftSales,
    fusions: capture.fusionEvidence, floorObservation: capture.floorThemeObservation, scene: capture.scene?.label ?? null,
    inShop: shelfIds.length > 0, context })
  const ownedKey = prescript.owned.join(',')
  useEffect(() => { setHeld(ownedKey ? ownedKey.split(',') : []) }, [ownedKey])

  const giftName = (id: number) => { const gift = giftMap.get(id); return gift ? (lang === 'en' && gift.name_en) || (lang === 'ja' && gift.name_jp) || gift.name : String(id) }
  const themeName = (id: string) => { const theme = themes.find(item => item.id === id); return theme ? (lang === 'en' && theme.name_en) || (lang === 'ja' && theme.name_jp) || theme.name : id }
  const label = (goal: PrescriptGoal) => {
    switch (goal.kind) {
      case 'sell-keyword': return t('goal_sell_keyword', { keyword: giftKeywordLabel(goal.keyword, lang) })
      case 'sell-tier': return t('goal_sell_tier', { tier: goal.tier })
      case 'fuse-gift': return t('goal_fuse_gift', { gift: giftName(goal.giftId) })
      case 'fuse-tier': return t('goal_fuse_tier', { tier: goal.tier })
      case 'get-keyword': return t('goal_get_keyword', { keyword: giftKeywordLabel(goal.keyword, lang), count: goal.count })
      case 'no-sale': return t('goal_no_sale')
      case 'pick-theme': return t('goal_pick_theme', { floor: goal.floor, theme: themeName(goal.themeId) })
      case 'buy-gift': return t('goal_buy_gift', { gift: giftName(goal.giftId) })
      case 'buy-leftmost': return t('goal_buy_leftmost', { gift: giftName(goal.giftId) })
    }
  }

  const { container, open, close } = useCompanionWindow()
  const [pipFailed, setPipFailed] = useState(false)
  const togglePip = () => { if (container) close(); else open().catch(() => setPipFailed(true)) }
  const captureActive = capture.status === 'running' || capture.status === 'loading' || capture.status === 'requesting'
  const stage = (pip: boolean) => <PrescriptStage run={prescript.run} offers={prescript.offers} label={label} onChoose={prescript.choose}
    onReroll={prescript.reroll} onRefuse={prescript.refuse} pip={pip} />

  return <div className={styles.root} data-prescript-page>
    <IndexIntro siteName="SAIGO NO DANTE" title={t('title')} english="The Index" />
    <div className={styles.wrap}>
      <header className={styles.head}>
        <BackLink href="/" aria-label={t('leave')} title={t('leave')} className={styles.back}><ArrowLeft size={18} aria-hidden="true" /></BackLink>
        {/* eslint-disable-next-line @next/next/no-img-element -- a small game emblem from public/ */}
        <img src="/assets/fun/prescript/index_emblem_color_256.png" alt="" width={36} height={36} />
        <h1>{t('title')}</h1>
        <div className={styles.stats}>
          <span><b>{floor || '-'}</b>{t('floorUnit')}</span>
          <span><b>{prescript.run.score}</b>{t('scoreUnit')}</span>
          <span><b>{prescript.run.streak}</b>{t('streakUnit')}</span>
          <span><b>{prescript.run.rerollsLeft}</b>{t('rerollUnit')}</span>
        </div>
      </header>
      <div className={styles.connect}>
        <button type="button" className={`${styles.b} ${captureActive ? '' : styles.pri}`} disabled={capture.mobile}
          onClick={() => { if (captureActive) capture.stop(); else void capture.start() }}>{t(captureActive ? 'disconnect' : 'connect')}</button>
        <button type="button" className={styles.b} onClick={togglePip}>{t(container ? 'pipClose' : 'pipOpen')}</button>
        <p role="status" title={t('privacy')} className={`${styles.state} ${running ? styles.live : capture.status === 'error' || capture.status === 'unsupported' ? styles.bad : ''}`}>
          {capture.mobile ? t('mobile') : pipFailed ? t('pipFailed') : t(`capture_${capture.status}`)}
        </p>
      </div>
      {dataError && <p role="alert" className={styles.state}>{t('dataError')}</p>}
      {stage(false)}
    </div>
    {container && createPortal(<div className={styles.root}>{stage(true)}</div>, container)}
  </div>
}

'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { ArrowLeft } from 'lucide-react'
import BackLink from '@/components/navigation/BackLink'
import { useLocale, useTranslations } from 'next-intl'
import PrescriptRules from '@/components/fun/prescript/PrescriptRules'
import PrescriptStage from '@/components/fun/prescript/PrescriptStage'
import styles from '@/components/fun/prescript/prescript.module.css'
import { giftKeywordLabel } from '@/components/gifts/GiftCatalog'
import { eventRoomOptions, optionLeadingTo, type PrescriptContext, type PrescriptGoal, type PrescriptGrade } from '@/lib/fun/prescript'
import { captureEvidence, useAssistCapture } from '@/lib/hooks/useAssistCapture'
import type { MdEvent, MdEventChoice } from '@/components/mirror-dungeon/types'
import { recognizableEvents } from '@/lib/utils/event-catalog'
import { useCompanionWindow } from '@/lib/hooks/useCompanionWindow'
import { usePrescript } from '@/lib/hooks/usePrescript'
import type { SupportedLang } from '@/lib/i18n'
import { buildGiftMap, findAvailableFusions, getAvailableThemes, giftTier } from '@/lib/planner/fusion'
import { getLegacyPlanFloorDifficulty } from '@/lib/planner/floor-difficulty'
import { DIFFICULTY_FLOOR_KEY, type GiftData, type RecipeData, type ThemeData } from '@/lib/planner/types'
import { readGameLanguage, type GameLanguage } from '@/lib/vision/recognition-profile'
import { shelfGift } from '@/lib/vision/shop-shelf'
import { GRADE_KEY, readGrade } from '@/lib/fun/prescript-history'
import { EMPTY_PLAN, planFromRunDraft, RUN_DRAFT_KEY, type PrescriptPlan } from '@/lib/fun/prescript-plan'

/** The prescripts are drawn for the run the mode is meant for: Extreme, to the 15th floor. */
const RUN_DIFFICULTY = 'extreme'

export default function PrescriptClient({ themes, gifts, recipes, events, eventChoices, identities, sinners, dataError }: { themes: ThemeData[]; gifts: GiftData[]; recipes: RecipeData[];
  events: MdEvent[]; eventChoices: MdEventChoice[]; identities: { game_id: string | null; sinner_id: string; keywords: string[] | null }[];
  sinners: { id: string; name_kr: string | null; name_en: string | null; name_jp: string | null }[]; dataError?: boolean }) {
  const t = useTranslations('prescriptMode')
  const lang = useLocale() as SupportedLang
  // The game client's language picks the text reader's model and the gift names it compares (the Assist's own setting).
  const [gameLanguage, setGameLanguage] = useState<GameLanguage>(lang === 'en' || lang === 'ja' ? lang : 'ko')
  useEffect(() => { setGameLanguage(current => readGameLanguage(window.localStorage, current)) }, [])
  const giftMap = useMemo(() => buildGiftMap(gifts), [gifts])
  const giftReferences = useMemo(() => gifts.map(gift => ({ id: String(gift.game_id), imageUrl: gift.image_url })), [gifts])
  // ? rooms as the run page reads them (exact copies of another event left out: their text would name several at once)
  const recognizable = useMemo(() => recognizableEvents(events, eventChoices), [events, eventChoices])
  const eventReferences = useMemo(() => recognizable.events.map(event => ({ id: String(event.id), imageUrl: event.image_url })), [recognizable])
  const choiceById = useMemo(() => new Map(recognizable.choices.map(choice => [String(choice.id), choice])), [recognizable])
  const ocrCatalog = useMemo(() => ({
    gifts: gifts.map(gift => ({ id: String(gift.game_id), effectTexts: [],
      texts: (gameLanguage === 'en' ? [gift.name_en, gift.name, gift.name_jp] : gameLanguage === 'ja' ? [gift.name_jp, gift.name, gift.name_en]
        : [gift.name, gift.name_en, gift.name_jp]).filter((value): value is string => Boolean(value)) })),
    events: recognizable.events.map(event => ({ id: String(event.id), texts: [event.name, event.desc_text, event.name_en, event.desc_text_en, event.name_jp,
      event.desc_text_jp].filter((value): value is string => Boolean(value)) })),
    choices: recognizable.choices.map(choice => ({ id: String(choice.id), eventId: String(choice.event_id),
      texts: [choice.message, choice.message_en, choice.message_jp].filter((value): value is string => Boolean(value)),
      resultTexts: [choice.result_text, choice.result_text_en, choice.result_text_jp].filter((value): value is string => Boolean(value)) })),
  }), [gifts, gameLanguage, recognizable])
  const themeCatalog = useMemo(() => themes.map(theme => ({ id: String(theme.id),
    texts: [theme.name, theme.name_en, theme.name_jp].filter((value): value is string => Boolean(value)) })), [themes])
  const giftPrice = useCallback((id: string) => giftMap.get(Number(id))?.price, [giftMap])

  // What the page knows of the run comes only from the screen: the floor from the banner, the gifts from the evidence.
  // 0 until a floor is read: a run joined midway must not have its floor-bound prescripts tied to a guessed floor
  const [floor, setFloor] = useState(0)
  const [held, setHeld] = useState<string[]>([])
  const capture = useAssistCapture({ giftReferences, eventReferences, ocrCatalog, themeCatalog, language: gameLanguage, floor, heldGiftIds: held, giftPrice })
  useEffect(() => { if (capture.observedFloor) setFloor(capture.observedFloor) }, [capture.observedFloor])
  // a confirmed pack pick is that floor at once, in the same render as its judging, so the next cards are drawn for it
  useEffect(() => { if (capture.floorThemeObservation) setFloor(capture.floorThemeObservation.floor) }, [capture.floorThemeObservation])

  const running = capture.status === 'running'
  const shelf = running && capture.shopShelf && Date.now() - capture.shopShelf.observedAt < 3000 ? capture.shopShelf : null
  const shelfKey = (shelf?.slots ?? []).map(slot => `${shelfGift(slot)}:${slot.sold}`).join(',')
  const shelfIds = useMemo(() => shelfKey.split(',').filter(item => item.endsWith(':false') && !item.startsWith('null'))
    .map(item => Number(item.split(':')[0])), [shelfKey])
  // the visit's last shelf: the fusion and sell windows cover it, and a gift on it can still be bought after them
  const lastShelfKey = (running ? capture.shopShelf?.slots ?? [] : []).map(slot => `${shelfGift(slot)}:${slot.sold}`).join(',')
  const lastShelfIds = useMemo(() => lastShelfKey.split(',').filter(item => item.endsWith(':false') && !item.startsWith('null'))
    .map(item => Number(item.split(':')[0])), [lastShelfKey])
  // the grade chosen on the entrance: a new run starts at it
  const [grade, setGrade] = useState<PrescriptGrade>('proselyte')
  useEffect(() => { try { setGrade(readGrade(window.localStorage.getItem(GRADE_KEY))) } catch { /* proselyte */ } }, [])
  // the plan the run page was started from, in this browser: what it aims for weighs on the prescripts
  const [plan, setPlan] = useState<PrescriptPlan>(EMPTY_PLAN)
  useEffect(() => {
    const read = () => { try { setPlan(planFromRunDraft(window.localStorage.getItem(RUN_DRAFT_KEY))) } catch { /* no plan */ } }
    read()
    window.addEventListener('storage', read)
    return () => window.removeEventListener('storage', read)
  }, [])
  // the formation from the shop's bar: each portrait's Sinner and keywords
  const identityById = useMemo(() => new Map(identities.flatMap(identity => identity.game_id
    ? [[identity.game_id, { sinner: identity.sinner_id, keywords: identity.keywords ?? [] }] as const] : [])), [identities])
  const formationKey = (capture.formation?.ids ?? []).join(',')
  const formation = useMemo(() => formationKey ? formationKey.split(',').map(id => id || null) : undefined, [formationKey])
  const context = useMemo<PrescriptContext>(() => ({
    floor, inventory: held, planGiftIds: plan.giftIds, planKeywords: plan.keywords,
    gift: id => { const gift = giftMap.get(id); return gift ? { keyword: gift.keyword, tier: giftTier(gift) } : undefined },
    craftable: () => findAvailableFusions(held, recipes, giftMap).filter(fusion => fusion.canCraft && fusion.result).map(fusion => fusion.result!.game_id),
    themesOn: next => getAvailableThemes(themes, DIFFICULTY_FLOOR_KEY[getLegacyPlanFloorDifficulty(RUN_DIFFICULTY, next)], next).map(theme => theme.id),
    random: Math.random, shelf: lastShelfIds, formation, identity: id => identityById.get(id),
  }), [floor, held, giftMap, recipes, themes, lastShelfIds, plan, formation, identityById])
  // A ? room: its choice screen (the options anyone may take, with a result to judge them by) and the option its result
  // page names
  const evidence = captureEvidence(capture, floor, Date.now())
  const roomEventId = evidence.eventChoiceEvidence?.eventId ?? null
  const roomChoices = useMemo(() => roomEventId === null ? [] : eventRoomOptions(recognizable.events.find(event => event.id === roomEventId),
    recognizable.choices.filter(choice => choice.event_id === roomEventId)), [roomEventId, recognizable])
  const optionsKey = roomChoices.map(item => item.option).join(',')
  // the last room with options: a later stage on screen names the option that led to it
  const [openRoom, setOpenRoom] = useState<{ eventId: number; options: { option: number; next: number[] }[] } | null>(null)
  useEffect(() => { if (roomEventId !== null && roomChoices.length) setOpenRoom({ eventId: roomEventId, options: roomChoices }) }, [roomEventId, roomChoices])
  const stageOption = openRoom && roomEventId !== null && roomEventId !== openRoom.eventId ? optionLeadingTo(openRoom.options, roomEventId) : null
  const eventRoom = useMemo(() => roomEventId === null ? null : { eventId: roomEventId, options: optionsKey ? optionsKey.split(',').map(Number) : [] },
    [roomEventId, optionsKey])
  const outcome = (evidence.ocrCandidates?.outcomeChoiceIds ?? []).map(id => choiceById.get(id)).find(choice => choice && Number.isInteger(choice.option_index))
  // the game left the taken option alone on its result page: as good as its result text
  const alone = capture.eventPick?.via === 'list' ? choiceById.get(capture.eventPick.choiceId) : undefined
  const outcomeKey = outcome ? `${outcome.event_id}:${outcome.option_index}`
    : alone && Number.isInteger(alone.option_index) && !alone.outcome ? `${alone.event_id}:${alone.option_index}`
    : openRoom && stageOption !== null ? `${openRoom.eventId}:${stageOption}` : ''
  const eventOutcome = useMemo(() => outcomeKey ? { eventId: Number(outcomeKey.split(':')[0]), option: Number(outcomeKey.split(':')[1]), at: Date.now() } : null,
    [outcomeKey])
  const picked = capture.eventPick?.via === 'cursor' ? choiceById.get(capture.eventPick.choiceId) : undefined
  const pickKey = picked && Number.isInteger(picked.option_index) && !picked.outcome ? `${picked.event_id}:${picked.option_index}:${capture.eventPick!.at}` : ''
  const eventPick = useMemo(() => pickKey ? { eventId: Number(pickKey.split(':')[0]), option: Number(pickKey.split(':')[1]), at: Number(pickKey.split(':')[2]) } : null,
    [pickKey])
  // development only: which reading judged a room (the cursor, the next stage or the result text)
  useEffect(() => { if (process.env.NODE_ENV !== 'production' && pickKey) console.info('[prescript] cursor pick', pickKey) }, [pickKey])
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' && outcomeKey) console.info('[prescript] screen outcome', outcomeKey, outcome ? 'result text' : alone ? 'option left alone' : 'next stage')
  }, [outcomeKey]) // eslint-disable-line react-hooks/exhaustive-deps -- logged once a reading
  const prescript = usePrescript({ grade, eventRoom, eventOutcome, eventPick, formation: capture.formation, enabled: true, status: capture.status, acquisitions: capture.popupAcquisitions, sales: capture.giftSales,
    fusions: capture.fusionEvidence, floorObservation: capture.floorThemeObservation, ownedGrid: capture.ownedGrid, scene: capture.scene?.label ?? null,
    inShop: shelfIds.length > 0, context })
  const ownedKey = prescript.owned.join(',')
  useEffect(() => { setHeld(ownedKey ? ownedKey.split(',') : []) }, [ownedKey])

  const giftName = (id: number) => { const gift = giftMap.get(id); return gift ? (lang === 'en' && gift.name_en) || (lang === 'ja' && gift.name_jp) || gift.name : String(id) }
  const themeName = (id: string) => { const theme = themes.find(item => item.id === id); return theme ? (lang === 'en' && theme.name_en) || (lang === 'ja' && theme.name_jp) || theme.name : id }
  // the names and numbers a prescript points at are marked (\u0001…\u0002) for the stage to set apart
  const em = (value: string | number) => `\u0001${value}\u0002`
  const label = (goal: PrescriptGoal) => {
    switch (goal.kind) {
      case 'sell-keyword': return t('goal_sell_keyword', { keyword: em(giftKeywordLabel(goal.keyword, lang)) })
      case 'sell-tier': return t('goal_sell_tier', { tier: em(goal.tier) })
      case 'fuse-gift': return t('goal_fuse_gift', { gift: em(giftName(goal.giftId)) })
      case 'fuse-tier': return t('goal_fuse_tier', { tier: em(goal.tier) })
      case 'get-keyword': return t('goal_get_keyword', { keyword: em(giftKeywordLabel(goal.keyword, lang)), count: em(goal.count) })
      case 'no-sale': return t('goal_no_sale')
      case 'pick-theme': return t('goal_pick_theme', { floor: em(goal.floor), theme: em(themeName(goal.themeId)) })
      case 'buy-gift': return t('goal_buy_gift', { gift: em(giftName(goal.giftId)) })
      case 'buy-leftmost': return t('goal_buy_leftmost', { gift: em(giftName(goal.giftId)) })
      case 'no-answer': return t('goal_no_answer')
      case 'swap-identity': {
        const sinner = sinners.find(item => item.id === goal.sinner)
        const name = (lang === 'en' && sinner?.name_en) || (lang === 'ja' && sinner?.name_jp) || sinner?.name_kr || goal.sinner
        return t('goal_swap_identity', { sinner: em(name) })
      }
      case 'formation-keyword': return t('goal_formation_keyword', { keyword: em(giftKeywordLabel(goal.keyword, lang)), count: em(goal.count) })
      case 'event-choice': {
        const choice = recognizable.choices.find(item => item.event_id === goal.eventId && item.option_index === goal.option)
        const text = choice ? (lang === 'en' && choice.message_en) || (lang === 'ja' && choice.message_jp) || choice.message || '' : String(goal.option + 1)
        // the option as the game writes it, without its closing stop (the order adds its own)
        return t('goal_event_choice', { choice: em(text.replace(/<[^>]*>/g, '').replace(/[.。．]+$/u, '').trim()) })
      }
    }
  }

  const { container, open, close } = useCompanionWindow()
  const [pipFailed, setPipFailed] = useState(false)
  const togglePip = () => { if (container) close(); else open().catch(() => setPipFailed(true)) }
  const captureActive = capture.status === 'running' || capture.status === 'loading' || capture.status === 'requesting'
  const stage = (pip: boolean) => <PrescriptStage run={prescript.run} offers={prescript.offers} label={label} onChoose={prescript.choose} canChoose={prescript.canChoose}
    onReroll={prescript.reroll} onRefuse={prescript.refuse} pip={pip} />

  return <div className={styles.root} data-prescript-page>
    <PrescriptRules />
    <div className={styles.wrap}>
      <header className={styles.head}>
        <BackLink href="/prescript" parent aria-label={t('toHub')} title={t('toHub')} className={styles.back}><ArrowLeft size={18} aria-hidden="true" /></BackLink>
        {/* eslint-disable-next-line @next/next/no-img-element -- a small game emblem from public/ */}
        <img src="/assets/fun/prescript/index_emblem_color_256.png" alt="" width={36} height={36} />
        <h1>{t('terminalTitle')}</h1>
        <span className={styles.grade}>{t(`grade_${prescript.run.grade ?? 'proselyte'}`)}</span>
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

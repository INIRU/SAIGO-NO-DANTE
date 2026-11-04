'use client'

import { useEffect, useState, type MouseEvent, type ReactNode } from 'react'
import { AnimatePresence, useReducedMotion } from 'motion/react'
import * as m from 'motion/react-m'
import { useLocale, useTranslations } from 'next-intl'
import { RotateCcw, RotateCw, Settings2 } from 'lucide-react'
import GiftArtwork from '@/components/ui/GiftArtwork'
import { GiftWarningMark } from '@/components/ui/GiftCard'
import ThemePackCard from '@/components/ui/ThemePackCard'
import { getLocalizedName } from '@/lib/i18n/localize'
import type { SupportedLang } from '@/lib/i18n/types'
import type { GiftData, IdentitySlot, SkillSummary, ThemeData } from '@/lib/planner/types'
import type { ThemeGuidance } from '@/lib/planner/run-theme-guidance'
import type { FormationCell, FusionGuide } from '@/lib/planner/assist-gift-guide'
import { fitGrid, floorLayout, pipDensity, type GiftBadge, type PipMode } from '@/lib/planner/pip-view'
import type { PipTip } from '@/lib/planner/pip-tips'
import type { SkillExchangeRead } from '@/lib/vision/skill-exchange'
import type { MdEvent, MdEventChoice } from '@/components/mirror-dungeon/types'
import CompanionEventChoices from './CompanionEventChoices'
import CompanionStartGifts from './CompanionStartGifts'
import CompanionSkillExchange from './CompanionSkillExchange'
import CompanionFormation from './CompanionFormation'
import CompanionPlanMemo from './CompanionPlanMemo'
import CompanionClearBonus from './CompanionClearBonus'
import FusionGuideList from './FusionGuideList'
import { useGiftInfo } from './CompanionGiftInfo'

/** What the window shows, already decided (lib/planner/pip-view, pip-tips): this component only draws it. */
export interface PipView {
  mode: PipMode
  /** The floor the window is about. */
  floor: number
  /** The floor's pack, once chosen. */
  theme?: ThemeData
  memo?: string
  tips: PipTip[]
  eventId?: number
  exchange?: SkillExchangeRead | null
  slots?: IdentitySlot[]
  formation?: { cells: FormationCell[]; code: string }
  start?: { start: GiftData[]; observe: GiftData[] }
  /** Pack choice: the plan's pack for this floor and its gifts. */
  pack?: { guidance: ThemeGuidance; gifts: GiftData[] } | null
  /** Floor and fusion views: the gift list (grouped when more than one group) and, on fusion, the guide. */
  gifts?: { all: GiftData[]; groups: { key: string; label: string; list: GiftData[] }[] }
  guide?: FusionGuide | null
  owned: ReadonlySet<number>
  planned: ReadonlySet<number>
  /** The marks of a gift cell, strongest first. */
  badges: (id: number) => GiftBadge[]
}

/** Catalog data the views look things up in. */
export interface PipData {
  giftMap: Map<number, GiftData>
  themes: ThemeData[]
  events: MdEvent[]
  eventChoices: MdEventChoice[]
  skills: SkillSummary[]
}

export interface PipActions {
  acquire: (id: number, event?: MouseEvent<HTMLButtonElement>) => void
  /** A pack picked by the user (the title gets focus afterwards). */
  chooseTheme: (themeId: string) => void
  undo: () => void
  redo: () => void
  canUndo: boolean
  canRedo: boolean
  /** The PiP's own controls (next floor, window size): only inside the PiP. */
  nextFloor?: ReactNode
  size?: { width: number; height: number; onChange: (size: { width: number; height: number }) => void }
}

function SizeInput({ label, value, min, max, onCommit }: { label: string; value: number; min: number; max: number; onCommit: (value: number) => void }) {
  const [draft, setDraft] = useState(String(value))
  useEffect(() => setDraft(String(value)), [value])
  const commit = () => { const parsed = Number(draft); if (Number.isFinite(parsed)) onCommit(Math.min(max, Math.max(min, parsed))); else setDraft(String(value)) }
  return <label className="text-[var(--text-secondary)]">{label}<input type="number" min={min} max={max} value={draft} onChange={event => setDraft(event.target.value)} onBlur={commit} onKeyDown={event => { if (event.key === 'Enter') { commit(); event.currentTarget.blur() } }} className="mt-1 block w-20 rounded border border-[var(--border)] bg-[var(--bg-panel)] p-1 text-[var(--text-primary)] focus-visible:outline-2 focus-visible:outline-[var(--gold-light)]" /></label>
}

const ICON_BUTTON = 'inline-flex h-8 w-8 items-center justify-center rounded border border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--border-hover)] hover:text-[var(--text-primary)] disabled:opacity-35 focus-visible:outline-2 focus-visible:outline-[var(--gold-light)]'

/**
 * The PiP's content for one moment, at `width`×`height` (the window's content size; `inPip` false draws it in a page,
 * e.g. the preview). Layout comes from lib/planner/pip-view (density, grid fits); views per mode below.
 */
export default function CompanionView({ view, data, actions, width, height, inPip = true }: { view: PipView; data: PipData; actions: PipActions
  width: number; height: number; inPip?: boolean }) {
  const t = useTranslations('planner.run')
  const locale = useLocale() as SupportedLang
  const reducedMotion = useReducedMotion()
  const [settingsOpen, setSettingsOpen] = useState(false)
  // gift names and details on hover (the cells show the art only)
  const info = useGiftInfo()
  const localized = (item: { name: string; name_en?: string | null; name_jp?: string | null }) => getLocalizedName({ name_kr: item.name, name_en: item.name_en, name_jp: item.name_jp }, locale)
  const giftsOf = (ids: readonly number[]) => ids.flatMap(id => data.giftMap.get(id) ?? [])
  const density = pipDensity(width, height)
  const availableWidth = Math.max(240, width - (inPip ? 36 : 24))
  const surface = inPip ? 'pip' : 'inline'

  /** One header for every view: the floor, what the view is about, and the controls (Undo, Redo, next floor, window size). */
  const header = (title?: ReactNode, sub?: ReactNode, withRedo = false) => <header data-companion-header
    className={inPip ? 'sticky top-0 z-20 -mx-3 -mt-3 mb-3 border-b border-[var(--border)] bg-[var(--bg-deep)] px-3 pb-2 pt-2.5' : 'mb-3 border-b border-[var(--border)] pb-2'}>
    <div className="flex items-center gap-2.5">
      <span className="font-[family-name:var(--font-title)] text-2xl leading-none text-[var(--gold-light)]" aria-label={t('currentFloor')}>{String(view.floor).padStart(2, '0')}</span>
      <div className="min-w-0 flex-1">
        {title && <h2 data-theme-title tabIndex={-1} className="truncate font-[family-name:var(--font-heading)] text-sm leading-5 text-[var(--text-primary)]">{title}</h2>}
        {sub && <p className="truncate text-[0.6875rem] leading-4 text-[var(--text-secondary)]">{sub}</p>}
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <button type="button" disabled={!actions.canUndo} onClick={actions.undo} aria-label={t('pipUndo')} title={t('pipUndo')} className={ICON_BUTTON}><RotateCcw size={14} /></button>
        {withRedo && <button type="button" disabled={!actions.canRedo} onClick={actions.redo} aria-label={t('pipRedo')} title={t('pipRedo')} className={ICON_BUTTON}><RotateCw size={14} /></button>}
        {actions.nextFloor}
        {actions.size && <button type="button" aria-expanded={settingsOpen} onClick={() => setSettingsOpen(open => !open)} aria-label={t('pipSettings')} title={t('pipSettings')}
          className={`${ICON_BUTTON} ${settingsOpen ? 'border-[var(--gold-dim)] text-[var(--gold-light)]' : ''}`}><Settings2 size={14} /></button>}
      </div>
    </div>
    {actions.size && settingsOpen && <div className="mt-2 flex flex-wrap items-end gap-2 text-xs">
      <SizeInput label={t('pipWidth')} value={actions.size.width} min={320} max={900} onCommit={value => actions.size!.onChange({ width: value, height: actions.size!.height })} />
      <SizeInput label={t('pipHeight')} value={actions.size.height} min={280} max={900} onCommit={value => actions.size!.onChange({ width: actions.size!.width, height: value })} />
    </div>}
  </header>

  // The floor views' arrangement (lib/planner/pip-view floorLayout): side column on wide windows, tighter on small ones.
  const hasSide = !!view.memo || view.tips.length > 0
  const arrangement = floorLayout(density, hasSide && (view.mode === 'floor'))
  const sideWidth = Math.floor((availableWidth - 16) * 0.4)
  const tipWidth = arrangement.side ? sideWidth : availableWidth
  /** Tips by kind (lib/planner/pip-tips): add a kind there and its view here. */
  const tipView = (tip: PipTip, index: number) => {
    const icons = (count: number, room: number) => fitGrid({ count, width: room, min: 32, max: density === 'compact' ? 36 : 44 }).size
    switch (tip.kind) {
      case 'clear-bonus':
        return <CompanionClearBonus key={`${tip.kind}-${index}`} gifts={giftsOf(tip.gifts)} planned={view.planned} owned={view.owned} picks={tip.picks}
          iconSize={icons(tip.gifts.length, tipWidth - 24)} compact={density === 'compact'} hover={gift => info.bind(gift, view.badges(gift.game_id))} />
      case 'clear-bonus-offer':
        return <div key={`${tip.kind}-${index}`} className="w-full space-y-2" data-clear-bonus-offer>
          <p className="text-[0.6875rem] font-bold text-[var(--gold-light)]">{t('clearBonusOffer')}</p>
          {tip.cards.map(card => {
            const named = card.themeId ? data.themes.find(item => String(item.id) === card.themeId) : undefined
            return <CompanionClearBonus key={card.place} gifts={giftsOf(card.gifts)} planned={view.planned} owned={view.owned} picks={tip.picks}
              label={named ? localized(named) : t('clearBonusCard', { n: card.index + 1 })} iconSize={Math.min(32, icons(card.gifts.length, tipWidth - 24))} compact={density === 'compact'} hover={gift => info.bind(gift, view.badges(gift.game_id))} />
          })}
        </div>
    }
  }
  const tips = view.tips.length > 0 && <div className="w-full space-y-2" data-pip-tips>{view.tips.map(tipView)}</div>

  const wrap = (children: ReactNode) => <div data-companion-content={surface} data-pip-mode-view={view.mode} data-pip-density={density}>{children}{info.card}</div>

  switch (view.mode) {
    case 'event':
      return wrap(<>{header(t('pipEventMode'))}
        <CompanionEventChoices eventId={view.eventId!} events={data.events} choices={data.eventChoices} giftMap={data.giftMap} /></>)
    case 'skill-exchange':
      return wrap(<>{header()}<CompanionSkillExchange exchange={view.exchange!} slots={view.slots ?? []} skills={data.skills} /></>)
    case 'formation':
      return wrap(<>{header(t('pipFormation'))}
        <CompanionFormation cells={view.formation!.cells} code={view.formation!.code} width={availableWidth} height={inPip ? height - 84 : 320} /></>)
    case 'start':
      return wrap(<>{header()}
        <div className="mb-3"><CompanionPlanMemo memo={view.memo} giftMap={data.giftMap} /></div>
        <CompanionStartGifts start={view.start?.start ?? []} observe={view.start?.observe ?? []} owned={view.owned} width={availableWidth}
          onAcquire={(id, event) => actions.acquire(id, event)} /></>)
    case 'pack-choice': {
      // The plan's pack: its poster beside its gifts. Icons take the largest size (up to 56 px) at which every gift fits
      // beside the poster; a narrow window puts them under it, and a very long list scrolls.
      const pack = view.pack
      const packGifts = pack?.gifts ?? []
      const stacked = packGifts.length > 0 && availableWidth < 300
      const posterWidth = Math.max(96, Math.min(packGifts.length && !stacked ? 150 : 180, Math.floor(availableWidth * (packGifts.length && !stacked ? 0.42 : 0.6)),
        Math.floor(((inPip ? height : 448) - 132) * 416 / 684)))
      const posterHeight = Math.floor(posterWidth * 684 / 416)
      const grid = stacked ? fitGrid({ count: packGifts.length, width: availableWidth, min: 40, max: 56, maxColumns: 6 })
        : fitGrid({ count: packGifts.length, width: availableWidth - posterWidth - 12, height: posterHeight - 20, min: 28, max: 56, maxColumns: 6 })
      const floors = pack ? pack.guidance.availableFloors.join(', ') || '—' : ''
      return wrap(<>{header(t('pipThemeGuidance'), pack ? t('pipThemeFloors', { floors }) : undefined)}
        <m.section key="unselected" aria-label={t('pipThemeGuidance')} initial={reducedMotion ? false : { opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: reducedMotion ? 0 : 0.18, ease: 'easeOut' }} className="grid place-items-center gap-3" style={{ minHeight: inPip ? Math.max(180, height - 96) : 180 }}>
          {pack ? <div data-theme-choice={pack.guidance.theme.id} className={`flex justify-center gap-3 ${stacked ? 'flex-col items-center' : 'items-start'}`}>
            <div className="shrink-0" style={{ width: posterWidth }}>
              <ThemePackCard theme={pack.guidance.theme} imageSurface="bare" sizes={`${posterWidth}px`}
                ariaLabel={`${localized(pack.guidance.theme)} · ${t('pipThemePossible')} · ${t('pipThemeFloors', { floors })}${pack.guidance.remainingOrder.length ? ` · ${t('pipThemeRemaining', { themes: pack.guidance.remainingOrder.map(next => `${next.floor}F ${localized(next.theme)}`).join(' · ') })}` : ''}`}
                title={`${localized(pack.guidance.theme)} · ${t('pipThemeFloors', { floors })}`}
                onClick={() => actions.chooseTheme(pack.guidance.theme.id)} />
            </div>
            {packGifts.length > 0 && <div className="min-w-0">
              <p className="mb-1.5 text-[0.6875rem] font-bold text-[var(--gold-light)]">{t('pipThemePlanGifts')} <span className="font-[family-name:var(--font-title)] font-normal text-[var(--text-secondary)]">{packGifts.length}</span></p>
              <ul aria-label={t('pipThemePlanGifts')} data-theme-plan-gifts={pack.guidance.theme.id} className="grid content-start gap-1 overflow-y-auto"
                style={{ gridTemplateColumns: `repeat(${Math.min(grid.columns, packGifts.length)}, ${grid.size}px)`, maxHeight: stacked ? undefined : posterHeight - 20 }}>
                {packGifts.map(gift => {
                  const have = view.owned.has(gift.game_id)
                  const label = have ? `${localized(gift)} · ${t('owned')}` : localized(gift)
                  return <li key={gift.game_id} aria-label={label} data-owned={have || undefined} className={have ? 'opacity-40' : undefined} {...info.bind(gift, view.badges(gift.game_id))}>
                    <GiftArtwork gift={gift} displayName={localized(gift)} sizes={`${grid.size}px`} /></li>
                })}
              </ul>
            </div>}
          </div> : <p role="status" className="px-2 text-center font-[family-name:var(--font-heading)] text-lg font-semibold text-[var(--gold-light)]">{t('pipChooseThemeBlank')}</p>}
          {tips}
        </m.section></>)
    }
    case 'fusion':
    case 'floor': {
      const all = view.gifts?.all ?? []
      const guide = view.mode === 'fusion' ? view.guide ?? null : null
      // A wide window puts the fusion guide beside the plan's tier IV+ gifts instead of above them (guide 3/5, grid 2/5).
      const fusionSplit = inPip && !!guide && guide.ready.length + guide.nearly.length > 0 && density === 'wide'
      const side = arrangement.side && !fusionSplit
      const gridWidth = fusionSplit ? Math.floor((availableWidth - 16) * 0.4) : side ? availableWidth - 16 - sideWidth : availableWidth
      const cells = fitGrid({ count: all.length, width: gridWidth, gap: 6, ...arrangement.cell })
      // the art fills its cell (no name under it any more), less the button's padding
      const artwork = Math.max(38, Math.min(64, cells.size - 8))
      const giftCell = (gift: GiftData) => {
        const badges = view.badges(gift.game_id)
        const warn = badges.find(badge => badge.tone === 'warn')
        const notes = badges.filter(badge => badge.tone === 'info')
        return <m.li key={gift.game_id} layout={reducedMotion ? false : 'position'} initial={reducedMotion ? false : { opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }}
          exit={reducedMotion ? { opacity: 1 } : { opacity: 0, scale: 0.94 }} transition={{ duration: reducedMotion ? 0 : 0.18 }} className="min-w-0">
          <button type="button" data-gift-id={gift.game_id} onClick={event => actions.acquire(gift.game_id, event)} {...info.bind(gift, badges)}
            aria-label={[t('pipAcquireGift', { name: localized(gift) }), ...badges.map(badge => badge.label)].join(' · ')}
            data-plan-gift={badges.some(badge => badge.tone === 'plan') || undefined}
            className="w-full rounded-sm p-1 text-center hover:bg-[var(--bg-elevated)] focus-visible:outline-2 focus-visible:outline-[var(--gold-light)]">
            <span className="relative mx-auto block" style={{ width: artwork }}>
              <GiftArtwork gift={gift} displayName={localized(gift)} sizes={`${artwork}px`} />
              {warn && <span aria-hidden="true" data-floor-only><GiftWarningMark label={warn.label} className="-right-0.5 -top-1 z-40 h-4 w-4" /></span>}
              {/* a mark in words rides on the art's lower edge (the hover card spells it out) */}
              {notes[0] && <span aria-hidden="true" data-gift-badge={notes[0].key}
                className="absolute inset-x-0 bottom-0 z-40 overflow-hidden text-ellipsis whitespace-nowrap rounded-b-sm bg-[color-mix(in_srgb,var(--gold)_88%,black)] text-center text-[0.5625rem] font-bold leading-[0.875rem] text-[var(--bg-deep)]">{notes[0].short ?? notes[0].label}</span>}
            </span>
          </button>
        </m.li>
      }
      const giftGrid = (list: GiftData[], key: string) => <ul key={key} className="grid justify-center gap-[6px]" style={{ gridTemplateColumns: `repeat(${cells.columns}, ${cells.size}px)` }} data-gift-grid={key}>
        <AnimatePresence initial={false} mode="popLayout">{list.map(giftCell)}</AnimatePresence></ul>
      const groupTitle = (label: string, size: number) => <h3 className="mb-1.5 flex items-center gap-2 text-[0.6875rem] font-bold text-[var(--gold-light)]"><span>{label}</span>
        <span className="font-[family-name:var(--font-title)] text-xs font-normal text-[var(--text-secondary)]">{size}</span><span aria-hidden="true" className="h-px flex-1 bg-[var(--border)]" /></h3>
      const groups = view.gifts?.groups ?? []
      const list = !all.length ? <p className="text-xs text-[var(--text-tertiary)]">{t(view.mode === 'fusion' ? 'fusionTierGiftsOwned' : 'allThemeGiftsOwned')}</p>
        : groups.length > 1 ? groups.map(group => <div key={group.key}>{groupTitle(group.label, group.list.length)}{giftGrid(group.list, group.key)}</div>)
        : giftGrid(all, 'all')
      let body: ReactNode = list
      if (guide) {
        // Finals one material short are already in the guide with their recipe; the grid lists the rest once.
        const nearlyIds = new Set(guide.nearly.flatMap(item => item.fusion.result ? [item.fusion.result.game_id] : []))
        const rest = all.filter(gift => !nearlyIds.has(gift.game_id))
        const finals = rest.length > 0 && <div>{groupTitle(t('groupTargets'), rest.length)}{giftGrid(rest, 'all')}</div>
        const listWidth = fusionSplit ? availableWidth - 16 - gridWidth : availableWidth
        const guideList = <FusionGuideList guide={guide} iconSize={Math.max(32, Math.min(artwork, Math.floor((listWidth - 130) / 4)))} readyTitle={t('pipFusionReady')} />
        body = fusionSplit && finals ? <div className="grid grid-cols-[3fr_2fr] items-start gap-4">{guideList}{finals}</div> : <>{guideList}{finals}</>
      }
      return wrap(<>{header(view.theme ? localized(view.theme) : undefined, undefined, true)}
        <m.section key={view.theme?.id ?? 'floor'} initial={reducedMotion ? false : { opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: reducedMotion ? 0 : 0.18, ease: 'easeOut' }}
          className={side ? 'grid items-start gap-4' : 'space-y-3'} style={side ? { gridTemplateColumns: `${sideWidth}px minmax(0, 1fr)` } : undefined} data-pip-side={side || undefined}>
          {side ? <div className={`space-y-3 self-start ${inPip ? 'sticky top-16' : ''}`} data-pip-side-column>{view.mode === 'floor' && <CompanionPlanMemo memo={view.memo} giftMap={data.giftMap} lines={arrangement.memoLines} />}{tips}</div>
            : <>{view.mode === 'floor' && <CompanionPlanMemo memo={view.memo} giftMap={data.giftMap} lines={arrangement.memoLines} />}{tips}</>}
          <div className="min-w-0 space-y-3">{body}</div>
        </m.section></>)
    }
  }
}

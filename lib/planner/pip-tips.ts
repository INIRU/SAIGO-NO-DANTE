import { bonusPicks, type ClearBonusOffer } from '@/lib/vision/clear-bonus'
import type { RunState } from './run-types'
import type { PipMode } from './pip-view'

/**
 * Game-rule tips for players new to the dungeon, shown in the PiP at the moment they change a choice. A tip is a rule
 * (the views it may show in, and a builder that returns its data or null); add one by adding a row to PIP_TIPS, a view
 * for its kind in CompanionView and its words in messages.
 */
export interface PipTipContext {
  mode: PipMode
  state: RunState
  /** The floor the window is about (a floor being chosen on a selection screen, else the current one). */
  viewFloor: number
  /** Gifts the run's plan wants (its floors' gifts and final gifts). */
  planned: ReadonlySet<number>
  owned: ReadonlySet<number>
  /** The latest pack selection screen's CLEAR BONUS rows, and the floor they were read for. */
  offer: ClearBonusOffer | null
  offerFloor: number | null
}

export type PipTip =
  /** The floor's pack's clear bonus: beating its boss offers these, `picks` of them are taken. */
  | { kind: 'clear-bonus'; gifts: number[]; picks: number }
  /** On a selection screen: the offered cards whose clear bonus holds a gift the plan still wants. */
  | { kind: 'clear-bonus-offer'; cards: { place: number; index: number; gifts: number[]; themeId: string | null }[]; picks: number }

const ids = (values: readonly string[] | undefined) => (values ?? []).map(Number).filter(Number.isInteger)
const picksOn = (state: RunState, floor: number) => bonusPicks(state.floorLogs[floor - 1]?.difficulty ?? state.difficulty)

export const PIP_TIPS: readonly { kind: PipTip['kind']; modes: readonly PipMode[]; build: (context: PipTipContext) => PipTip | null }[] = [
  {
    kind: 'clear-bonus',
    modes: ['floor'],
    build: ({ state, viewFloor }) => {
      const gifts = ids(state.floorLogs[viewFloor - 1]?.clearBonus)
      return gifts.length ? { kind: 'clear-bonus', gifts, picks: picksOn(state, viewFloor) } : null
    },
  },
  {
    kind: 'clear-bonus-offer',
    modes: ['pack-choice'],
    build: ({ state, viewFloor, offer, offerFloor, planned, owned }) => {
      if (!offer || (offer.floor ?? offerFloor) !== viewFloor) return null
      const cards = offer.cards.flatMap((card, index) => {
        const gifts = ids(card.gifts)
        return gifts.some(id => planned.has(id) && !owned.has(id))
          ? [{ place: card.place, index, gifts, themeId: card.themeIds?.length === 1 ? card.themeIds[0] : null }] : []
      })
      return cards.length ? { kind: 'clear-bonus-offer', cards, picks: picksOn(state, viewFloor) } : null
    },
  },
]

/** The tips for this moment, in PIP_TIPS order. */
export function pipTips(context: PipTipContext): PipTip[] {
  return PIP_TIPS.filter(rule => rule.modes.includes(context.mode)).flatMap(rule => rule.build(context) ?? [])
}

// The CLEAR BONUS offer shape and pick rule. Shared: the Assist reads the offer, the planner's tips (lib/planner/pip-tips)
// use it, and shared code (lib/) cannot import features/assist.

/** One pack card's clear bonus. `place`: its UI x; `themeIds`: the pack its name reads as, when read. */
export interface ClearBonusCard { place: number; gifts: string[]; themeIds?: string[] }
export interface ClearBonusOffer { floor: number | null; cards: ClearBonusCard[]; observedAt: number }

/** How many of the bonus gifts the floor's boss lets the player take: one on a normal floor, two on the harder ones. */
export const bonusPicks = (difficulty: string) => (difficulty === 'normal' ? 1 : 2)

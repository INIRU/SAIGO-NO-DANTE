/**
 * Index prescript mode (재미): prescripts come down while the player runs the Mirror Dungeon, and whether one was carried
 * out is read only from the Assist capture's evidence (acquisition popups, sales, fusions, confirmed floors). The player
 * never marks one done. A break in the capture voids what was in progress: neither failed nor scored (USER 2026-11-03).
 *
 * Three kinds: a standing prescript (always one; the next comes once it is carried out, to the end of the run), a special
 * one (one a floor, due before the next floor is confirmed) and a shop one (one a floor, from the shelf as read, due before
 * the shop is left). Only prescripts the run can carry out now are offered.
 */

export type PrescriptScope = 'standing' | 'special' | 'shop'
export type Strength = 1 | 2 | 3 | 4 | 5

export type PrescriptGoal =
  | { kind: 'sell-keyword'; keyword: string }
  | { kind: 'sell-tier'; tier: number }
  | { kind: 'fuse-gift'; giftId: number }
  | { kind: 'fuse-tier'; tier: number }
  | { kind: 'get-keyword'; keyword: string; count: number }
  | { kind: 'no-sale' }
  | { kind: 'pick-theme'; floor: number; themeId: string }
  | { kind: 'buy-gift'; giftId: number }
  /** The shelf's first gift when it was offered (its id kept: buying it is what counts). */
  | { kind: 'buy-leftmost'; giftId: number }

export interface PrescriptCard { scope: PrescriptScope; goal: PrescriptGoal; strength: Strength }
export type PrescriptStatus = 'active' | 'done' | 'failed' | 'void'
export interface Prescript extends PrescriptCard {
  id: number
  /** The floor it was received on: a special prescript is due before the next one is confirmed. */
  floor: number
  receivedAt: number
  status: PrescriptStatus
  progress: number
  settledAt?: number
  points?: number
  /** Why it was voided. */
  reason?: string
}
/** `ended`: the dungeon's end screen was seen with the terminal on from then to the end; only such a record is kept. */
export interface PrescriptRun { prescripts: Prescript[]; score: number; streak: number; rerollsLeft: number; nextId: number; ended?: boolean }

export type PrescriptEvent =
  | { type: 'acquire'; giftId: number; at: number }
  | { type: 'sale'; giftId: number; at: number }
  | { type: 'fusion'; resultId: number; at: number }
  | { type: 'floor'; floor: number; themeIds: readonly string[]; at: number }
  | { type: 'gap'; at: number; reason: string }
  /** The shop's screens gave way to the map, a battle or another room. */
  | { type: 'leave-shop'; at: number }

export interface PrescriptContext {
  floor: number
  inventory: readonly string[]
  /** Gifts the plan needs: never asked to be sold. */
  planGiftIds: ReadonlySet<number>
  gift: (id: number) => { keyword: string | null; tier: number | null } | undefined
  /** Fixed-recipe results the inventory can make now. */
  craftable: () => number[]
  /** Pack ids a floor of this run can offer. */
  themesOn: (floor: number) => string[]
  random: () => number
  /** Gifts on the shop shelf, unsold, read with confidence, in shelf order (empty outside the shop). */
  shelf?: readonly number[]
}

export const PRESCRIPT_REROLLS = 3
export const LAST_FLOOR = 15
const STRENGTH_POINTS = [5, 10, 20, 35, 60] as const

export function createPrescriptRun(): PrescriptRun {
  return { prescripts: [], score: 0, streak: 0, rerollsLeft: PRESCRIPT_REROLLS, nextId: 1 }
}

/** The dungeon is over: the record closes, and what is still in progress is recalled (not done, not a violation). */
export function endPrescriptRun(run: PrescriptRun, at: number): PrescriptRun {
  return { ...run, ended: true, prescripts: run.prescripts.map(p => p.status === 'active' ? { ...p, status: 'void' as const, reason: 'run-ended', settledAt: at } : p) }
}

/** Strength points, x1.5 for a special or shop prescript (they can fail), x1.1 / 1.2 / 1.5 from the 3rd / 5th / 10th in a row. */
export function prescriptPoints(strength: Strength, scope: PrescriptScope, inARow: number): number {
  const streak = inARow >= 10 ? 1.5 : inARow >= 5 ? 1.2 : inARow >= 3 ? 1.1 : 1
  return Math.round(STRENGTH_POINTS[strength - 1] * (scope === 'standing' ? 1 : 1.5) * streak)
}

const giftIdOf = (inventoryId: string) => {
  const id = Number(inventoryId.replace(/^final_/, ''))
  return Number.isInteger(id) ? id : null
}

/** Every prescript the run can carry out now, of one kind. */
export function candidates(scope: PrescriptScope, ctx: PrescriptContext): PrescriptCard[] {
  const owned = ctx.inventory.map(giftIdOf).filter((id): id is number => id !== null)
  const sellable = owned.filter(id => !ctx.planGiftIds.has(id)).map(id => ({ id, ...ctx.gift(id) }))
  const keywords = [...new Set(owned.map(id => ctx.gift(id)?.keyword).filter((k): k is string => !!k))]
  const cards: PrescriptCard[] = []
  if (scope === 'special') {
    for (const keyword of new Set(sellable.map(g => g.keyword).filter((k): k is string => !!k))) {
      const cheapest = Math.min(...sellable.filter(g => g.keyword === keyword).map(g => g.tier ?? 4))
      cards.push({ scope, goal: { kind: 'sell-keyword', keyword }, strength: cheapest <= 2 ? 2 : 3 })
    }
    for (const tier of new Set(sellable.map(g => g.tier).filter((t): t is number => t !== null && t !== undefined && t <= 4)))
      cards.push({ scope, goal: { kind: 'sell-tier', tier }, strength: tier <= 2 ? 2 : tier === 3 ? 3 : 4 })
    for (const giftId of ctx.craftable().filter(id => !owned.includes(id)))
      cards.push({ scope, goal: { kind: 'fuse-gift', giftId }, strength: (ctx.gift(giftId)?.tier ?? 0) >= 4 ? 4 : 3 })
    cards.push({ scope, goal: { kind: 'no-sale' }, strength: 2 })
  } else if (scope === 'shop') {
    const shelf = (ctx.shelf ?? []).filter(id => !owned.includes(id))
    for (const giftId of shelf) {
      const tier = ctx.gift(giftId)?.tier ?? 1
      cards.push({ scope, goal: { kind: 'buy-gift', giftId }, strength: tier <= 2 ? 2 : tier === 3 ? 3 : 4 })
    }
    if (shelf.length > 1) cards.push({ scope, goal: { kind: 'buy-leftmost', giftId: shelf[0] }, strength: 1 })
  } else {
    // a floor-bound pack comes at least one floor ahead, so there is time to prepare
    for (const floor of [ctx.floor + 1, ctx.floor + 2].filter(f => f <= LAST_FLOOR))
      for (const themeId of ctx.themesOn(floor)) cards.push({ scope, goal: { kind: 'pick-theme', floor, themeId }, strength: 3 })
    for (const keyword of keywords) {
      cards.push({ scope, goal: { kind: 'get-keyword', keyword, count: 2 }, strength: 2 })
      cards.push({ scope, goal: { kind: 'get-keyword', keyword, count: 3 }, strength: 3 })
    }
    if (owned.length >= 3) cards.push({ scope, goal: { kind: 'fuse-tier', tier: 4 }, strength: 4 })
  }
  return cards
}

/** Up to three cards of different strengths, weakest first; one card a strength, picked by `random`. */
export function offer(scope: PrescriptScope, ctx: PrescriptContext, count = 3): PrescriptCard[] {
  const byStrength = new Map<Strength, PrescriptCard[]>()
  for (const card of candidates(scope, ctx)) byStrength.set(card.strength, [...byStrength.get(card.strength) ?? [], card])
  const strengths = [...byStrength.keys()]
  while (strengths.length > count) strengths.splice(Math.floor(ctx.random() * strengths.length), 1)
  return strengths.sort((a, b) => a - b).map(strength => {
    const pool = byStrength.get(strength)!
    return pool[Math.min(pool.length - 1, Math.floor(ctx.random() * pool.length))]
  })
}

export function receive(run: PrescriptRun, card: PrescriptCard, floor: number, at: number): PrescriptRun {
  const prescript: Prescript = { ...card, id: run.nextId, floor, receivedAt: at, status: 'active', progress: 0 }
  return { ...run, prescripts: [...run.prescripts, prescript], nextId: run.nextId + 1 }
}

export function reroll(run: PrescriptRun): PrescriptRun | null {
  return run.rerollsLeft > 0 ? { ...run, rerollsLeft: run.rerollsLeft - 1 } : null
}

/** Which kinds want a card now: no active standing prescript, no special one received on this floor yet, and in the shop
 * (`inShop`: its shelf is read) no shop one received on this floor yet. */
export function wanted(run: PrescriptRun, floor: number, inShop = false): PrescriptScope[] {
  const scopes: PrescriptScope[] = []
  // a recalled standing prescript (the capture broke) comes again only on the next floor: a break is no free reroll
  if (!run.prescripts.some(p => p.scope === 'standing' && (p.status === 'active' || (p.status === 'void' && p.floor === floor))))
    scopes.push('standing')
  if (floor >= 1 && !run.prescripts.some(p => p.scope === 'special' && p.floor === floor)) scopes.push('special')
  if (inShop && floor >= 1 && !run.prescripts.some(p => p.scope === 'shop' && p.floor === floor)) scopes.push('shop')
  return scopes
}

type Outcome = { status: 'done' | 'failed' } | { status: 'void'; reason: string } | { progress: number } | null

function judge(p: Prescript, event: PrescriptEvent, ctx: PrescriptContext): Outcome {
  const goal = p.goal
  const gift = 'giftId' in event ? ctx.gift(event.giftId) : undefined
  switch (event.type) {
    case 'gap': return { status: 'void', reason: event.reason }
    case 'leave-shop': return p.scope === 'shop' ? { status: 'failed' } : null
    case 'sale':
      if (goal.kind === 'no-sale') return { status: 'failed' }
      if (goal.kind === 'sell-keyword' && gift?.keyword === goal.keyword) return { status: 'done' }
      if (goal.kind === 'sell-tier' && gift?.tier === goal.tier) return { status: 'done' }
      return null
    case 'acquire':
      if ((goal.kind === 'buy-gift' || goal.kind === 'buy-leftmost') && event.giftId === goal.giftId) return { status: 'done' }
      if (goal.kind === 'get-keyword' && gift?.keyword === goal.keyword)
        return p.progress + 1 >= goal.count ? { status: 'done' } : { progress: p.progress + 1 }
      return null
    case 'fusion':
      if (goal.kind === 'fuse-gift' && event.resultId === goal.giftId) return { status: 'done' }
      if (goal.kind === 'fuse-tier' && (ctx.gift(event.resultId)?.tier ?? 0) >= goal.tier) return { status: 'done' }
      return null
    case 'floor':
      if (goal.kind === 'pick-theme') {
        if (event.floor === goal.floor) return { status: event.themeIds.includes(goal.themeId) ? 'done' : 'failed' }
        // its floor went by unseen: the pick cannot be known, so it is not called a failure
        return event.floor > goal.floor ? { status: 'void', reason: 'floor-unseen' } : null
      }
      // a shop prescript's floor ended without the shop being seen left (a capture between): it cannot be called failed
      if (p.scope === 'shop' && event.floor > p.floor) return { status: 'void', reason: 'floor-unseen' }
      if (p.scope === 'special' && event.floor > p.floor) {
        // a floor between was not seen: whether it was done in time cannot be known
        if (event.floor > p.floor + 1) return { status: 'void', reason: 'floor-unseen' }
        return { status: goal.kind === 'no-sale' ? 'done' : 'failed' }
      }
      return null
  }
}

/** One piece of screen evidence applied to every active prescript; points and the streak follow what it settles. */
export function applyEvent(run: PrescriptRun, event: PrescriptEvent, ctx: PrescriptContext): PrescriptRun {
  let { score, streak } = run
  const prescripts = run.prescripts.map(p => {
    if (p.status !== 'active') return p
    // only what happened after it was received counts: a fusion or purchase seen earlier and read late is not its doing
    if (event.type !== 'gap' && event.at < p.receivedAt) return p
    const outcome = judge(p, event, ctx)
    if (!outcome) return p
    if ('progress' in outcome) return { ...p, progress: outcome.progress }
    if (outcome.status === 'void') return { ...p, status: 'void' as const, reason: outcome.reason, settledAt: event.at }
    if (outcome.status === 'failed') { streak = 0; return { ...p, status: 'failed' as const, settledAt: event.at, points: 0 } }
    streak += 1
    const points = prescriptPoints(p.strength, p.scope, streak)
    score += points
    return { ...p, status: 'done' as const, settledAt: event.at, points, progress: p.goal.kind === 'get-keyword' ? p.goal.count : p.progress }
  })
  return { ...run, prescripts, score, streak }
}

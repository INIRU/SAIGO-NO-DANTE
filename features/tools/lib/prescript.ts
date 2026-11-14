/**
 * Index prescript mode (재미): prescripts come down while the player runs the Mirror Dungeon, and whether one was carried
 * out is read only from the Assist capture's evidence (acquisition popups, sales, fusions, confirmed floors). The player
 * never marks one done. A break in the capture voids what was in progress: neither failed nor scored (USER 2026-11-03).
 *
 * Three kinds: a standing prescript (always one; the next comes once it is carried out, to the end of the run), a special
 * one (one a floor, due before the next floor is confirmed) and a shop one (one a floor, from the shelf as read, due before
 * the shop is left). Only prescripts the run can carry out now are offered.
 */

import type { PrescriptScope, Strength, PrescriptCard, Prescript, PrescriptRun, PrescriptEvent, PrescriptContext, PrescriptGrade } from './prescript-types'
export type { PrescriptScope, Strength, PrescriptGoal, PrescriptCard, PrescriptStatus, Prescript, PrescriptRun, PrescriptEvent, PrescriptContext, PrescriptGrade } from './prescript-types'
export const GRADES: Record<PrescriptGrade, { rerolls: number; replyMs: number; refuse: boolean; multiplier: number }> = {
  proselyte: { rerolls: 3, replyMs: 20000, refuse: true, multiplier: 1 },
  proxy: { rerolls: 1, replyMs: 12000, refuse: false, multiplier: 1.5 },
}
export const gradeOf = (run: PrescriptRun) => GRADES[run.grade ?? 'proselyte']
export const PRESCRIPT_REROLLS = 3
/** The five vestiges (잔재): worth nothing to get or to give up, so no prescript asks for or counts them. */
const isVestige = (giftId: number) => giftId >= 9991 && giftId <= 9995
const LAST_FLOOR = 15
export const STRENGTH_POINTS = [5, 10, 20, 35, 60] as const

export function createPrescriptRun(grade: PrescriptGrade = 'proselyte'): PrescriptRun {
  return { prescripts: [], score: 0, streak: 0, rerollsLeft: GRADES[grade].rerolls, nextId: 1, grade }
}

/** The dungeon is over: the record closes, and what is still in progress is recalled (not done, not a violation). */
export function endPrescriptRun(run: PrescriptRun, at: number): PrescriptRun {
  return { ...run, ended: true, endedAt: at, prescripts: run.prescripts.map(p => p.status === 'active' ? { ...p, status: 'void' as const, reason: 'run-ended', settledAt: at } : p) }
}

/** Strength points, x1.5 for a special or shop prescript (they can fail), x1.1 / 1.2 / 1.5 from the 3rd / 5th / 10th in a row. */
/** The streak milestones: grace on top, and a reroll back (up to the grade's own count). */
export const STREAK_BONUS: Readonly<Record<number, number>> = { 3: 10, 5: 25, 10: 60 }

/** `blessing`: the run's blessing factor (`blessingFactor`). */
export function prescriptPoints(strength: Strength, scope: PrescriptScope, inARow: number, grade: PrescriptGrade = 'proselyte', blessing = 1): number {
  const streak = inARow >= 10 ? 1.5 : inARow >= 5 ? 1.2 : inARow >= 3 ? 1.1 : 1
  return Math.round(STRENGTH_POINTS[strength - 1] * (scope === 'standing' ? 1 : 1.5) * streak * GRADES[grade].multiplier * blessing)
}

/** The starlight every blessing at ++ costs together (the planner's BLESSING_CONFIGS: 30+30+60+60+90+90+120+120+150+180). */
export const BLESSING_STARLIGHT_MAX = 930
/**
 * The less starlight the run's blessings cost, the more every prescript is worth (USER 2026-11-04: "덜 쓸수록 가산"): x2 with
 * none, x1 with every blessing at ++, in a straight line between. Not yet read: x1.
 */
export function blessingFactor(spent: number | undefined): number {
  if (spent === undefined || !Number.isFinite(spent)) return 1
  return 1 + Math.max(0, BLESSING_STARLIGHT_MAX - Math.max(0, spent)) / BLESSING_STARLIGHT_MAX
}
export const runBlessing = (run: PrescriptRun) => blessingFactor(run.blessingSpent)

/** Grace for each of the opening formation's twelve Identities, by its star rating (all 1-star: 120). */
export const START_FORMATION_POINTS: Readonly<Record<number, number>> = { 1: 10, 2: 4, 3: 0 }
const FORMATION_SIZE = 12
/** The opening formation's grace before the blessing factor: all twelve, once all twelve are read (the order is free). */
function startFormationPoints(ids: readonly (string | null)[], ctx: PrescriptContext): number | null {
  if (ids.length < FORMATION_SIZE || ids.some(id => id === null)) return null
  return ids.reduce((sum, id) => sum + (START_FORMATION_POINTS[ctx.identity?.(id!)?.rarity ?? 3] ?? 0), 0)
}

const giftIdOf = (inventoryId: string) => {
  const id = Number(inventoryId.replace(/^final_/, ''))
  return Number.isInteger(id) ? id : null
}

/** Every prescript the run can carry out now, of one kind. */
export function candidates(scope: PrescriptScope, ctx: PrescriptContext): PrescriptCard[] {
  const owned = ctx.inventory.map(giftIdOf).filter((id): id is number => id !== null && !isVestige(id))
  const sellable = owned.filter(id => !ctx.planGiftIds.has(id)).map(id => ({ id, ...ctx.gift(id) }))
  const keywords = [...new Set(owned.map(id => ctx.gift(id)?.keyword).filter((k): k is string => !!k))]
  const cards: PrescriptCard[] = []
  if (scope === 'special') {
    for (const keyword of new Set(sellable.map(g => g.keyword).filter((k): k is string => !!k))) {
      const cheapest = Math.min(...sellable.filter(g => g.keyword === keyword).map(g => g.tier ?? 4))
      const base = cheapest <= 2 ? 2 : cheapest === 3 ? 3 : 4
      cards.push({ scope, goal: { kind: 'sell-keyword', keyword }, strength: Math.min(5, base + (ctx.planKeywords?.includes(keyword) ? 1 : 0)) as Strength })
    }
    // giving up a tier V gift (EX, 달의 기억) is the heaviest order there is
    for (const tier of new Set(sellable.map(g => g.tier).filter((t): t is number => t !== null && t !== undefined)))
      cards.push({ scope, goal: { kind: 'sell-tier', tier }, strength: tier <= 2 ? 2 : tier === 3 ? 3 : tier === 4 ? 4 : 5 })
    for (const giftId of ctx.craftable().filter(id => !owned.includes(id)))
      cards.push({ scope, goal: { kind: 'fuse-gift', giftId }, strength: (ctx.gift(giftId)?.tier ?? 0) >= 4 ? 4 : 3 })
    cards.push({ scope, goal: { kind: 'no-sale' }, strength: 2 })
    // the formation's front: one more of a keyword among the first six (a reorder will do when one waits behind, else a swap)
    const formation = ctx.formation ?? []
    if (formation.filter(Boolean).length >= 6) {
      const keywords = new Set(formation.flatMap(id => id ? ctx.identity?.(id)?.keywords ?? [] : []).filter(keyword => FORMATION_KEYWORDS.includes(keyword)))
      for (const keyword of keywords) {
        const count = front(formation, keyword, ctx)
        if (count >= 6) continue
        const behind = formation.slice(6).some(id => counts(id, ctx) && ctx.identity?.(id!)?.keywords.includes(keyword))
        cards.push({ scope, goal: { kind: 'formation-keyword', keyword, count: count + 1 }, strength: behind ? 2 : 4 })
      }
      // an Identity standing in 7 to 12 brought into the first six (a reorder)
      for (const id of formation.slice(6)) if (id && counts(id, ctx)) cards.push({ scope, goal: { kind: 'front-identity', identityId: id }, strength: 2 })
    }
  } else if (scope === 'shop') {
    const shelf = (ctx.shelf ?? []).filter(id => !owned.includes(id) && !isVestige(id))
    for (const giftId of shelf) {
      // a gift the plan wants is no burden to buy
      const tier = ctx.gift(giftId)?.tier ?? 1
      cards.push({ scope, goal: { kind: 'buy-gift', giftId }, strength: ctx.planGiftIds.has(giftId) ? 1 : tier <= 2 ? 2 : tier === 3 ? 3 : 4 })
    }
    if (shelf.length > 1) cards.push({ scope, goal: { kind: 'buy-leftmost', giftId: shelf[0] }, strength: 1 })
    // the shop's formation: put another Identity in a Sinner's place (it costs the shop's price)
    for (const id of ctx.formation ?? []) {
      const sinner = id ? ctx.identity?.(id)?.sinner : undefined
      if (id && sinner) cards.push({ scope, goal: { kind: 'swap-identity', sinner, fromId: id }, strength: 3 })
    }
    // an Identity to field in a fielded Sinner's place: the plan's first; else that Sinner's other 3-star ones. Only one with a
    // 2- or 1-star stand-in of its keywords is asked: whoever lacks it can still obey
    const planned = ctx.planIdentities ?? []
    for (const fielded of ctx.formation ?? []) {
      const sinner = fielded ? ctx.identity?.(fielded)?.sinner : undefined
      if (!fielded || !sinner) continue
      const own = (ctx.identitiesOf?.(sinner) ?? []).filter(id => id !== fielded)
      const targets = planned.filter(id => own.includes(id))
      for (const id of targets.length ? targets : own.filter(id => (ctx.identity?.(id)?.rarity ?? 0) >= 3)) {
        const keywords = (ctx.identity?.(id)?.keywords ?? []).filter(keyword => FORMATION_KEYWORDS.includes(keyword))
        const twoStar = own.some(other => other !== id && [1, 2].includes(ctx.identity?.(other)?.rarity ?? 0) &&
          (ctx.identity?.(other)?.keywords ?? []).some(keyword => keywords.includes(keyword)))
        // a Sinner on its 1-star Identity may also be left as it is (110% more): anyone can obey then
        const keep = ctx.identity?.(fielded)?.rarity === 1
        if (keywords.length && (twoStar || keep))
          cards.push({ scope, goal: { kind: 'field-identity', identityId: id, sinner, fromId: fielded, keywords, ...(keep ? { keep } : {}) }, strength: 3 })
      }
    }
  } else {
    // a floor-bound pack comes at least one floor ahead, so there is time to prepare
    for (const floor of [ctx.floor + 1, ctx.floor + 2].filter(f => f <= LAST_FLOOR))
      for (const themeId of ctx.themesOn(floor)) cards.push({ scope, goal: { kind: 'pick-theme', floor, themeId }, strength: 3 })
    for (const keyword of keywords) {
      const planned = ctx.planKeywords?.includes(keyword) ? 1 : 0
      cards.push({ scope, goal: { kind: 'get-keyword', keyword, count: 2 }, strength: (2 - planned) as Strength })
      cards.push({ scope, goal: { kind: 'get-keyword', keyword, count: 3 }, strength: (3 - planned) as Strength })
    }
    if (owned.length >= 3) cards.push({ scope, goal: { kind: 'fuse-tier', tier: 4 }, strength: 4 })
  }
  return cards
}

/**
 * The run's opening orders, given as it begins (before the formation is set): the formation, free and scored by star
 * rating; a start gift (the plan's, else of the plan's keywords, else any); and a gift to observe (the plan's, else any).
 */
export function startPrescripts(ctx: PrescriptContext): PrescriptCard[] {
  const pick = <T,>(list: readonly T[]): T | undefined => list[Math.floor(ctx.random() * list.length)]
  const cards: PrescriptCard[] = [{ scope: 'start', goal: { kind: 'start-formation' }, strength: 1 }]
  const pools = (ctx.startPools ?? []).filter(item => item.length)
  const pool = pools.find(item => item.some(id => ctx.planGiftIds.has(id)))
    ?? pick(pools.filter(item => item.some(id => ctx.planKeywords?.includes(ctx.gift(id)?.keyword ?? '')))) ?? pick(pools)
  if (pool) {
    const wanted = pool.filter(id => ctx.planGiftIds.has(id))
    cards.push({ scope: 'start', goal: { kind: 'start-gift', giftId: pick(wanted.length ? wanted : pool)!, pool: [...pool] }, strength: 2 })
  }
  const observable = ctx.observable ?? []
  if (observable.length) {
    const wanted = observable.filter(id => ctx.planGiftIds.has(id))
    cards.push({ scope: 'start', goal: { kind: 'observe-gift', giftId: pick(wanted.length ? wanted : observable)!, pool: [...observable] }, strength: 3 })
  }
  return cards
}

/** Up to three cards of different strengths, weakest first; one card a strength, picked by `random`. `minStrength` (from the
 * player's refusals) leaves out the weaker ones while anything as strong is left to offer. */
export function offer(scope: PrescriptScope, ctx: PrescriptContext, count = 3, minStrength = 1): PrescriptCard[] {
  const byStrength = new Map<Strength, PrescriptCard[]>()
  const all = candidates(scope, ctx)
  const floor = all.some(card => card.strength >= minStrength) ? minStrength : 1
  for (const card of all.filter(card => card.strength >= floor)) byStrength.set(card.strength, [...byStrength.get(card.strength) ?? [], card])
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

/**
 * Whether a card can still be carried out at the moment it is chosen: a card offered earlier may have run out of time while
 * the offer waited (the shop left, the gift sold or bought, that floor's pack already picked, the recipe gone).
 */
export function feasible(card: PrescriptCard, ctx: PrescriptContext, inShop: boolean): boolean {
  const goal = card.goal
  if (card.scope === 'shop' && !inShop) return false
  switch (goal.kind) {
    case 'buy-gift': case 'buy-leftmost': return (ctx.shelf ?? []).includes(goal.giftId) && !ctx.inventory.includes(String(goal.giftId))
    case 'pick-theme': return goal.floor > ctx.floor
    case 'fuse-gift': return ctx.craftable().includes(goal.giftId)
    case 'swap-identity': return (ctx.formation ?? []).includes(goal.fromId)
    case 'field-identity': return !(ctx.formation ?? []).includes(goal.identityId) && (ctx.formation ?? []).includes(goal.fromId)
    case 'front-identity': return (ctx.formation ?? []).slice(6).includes(goal.identityId)
    case 'sell-keyword': case 'sell-tier': return candidates(card.scope, ctx).some(other => JSON.stringify(other.goal) === JSON.stringify(goal))
    default: return true
  }
}

/**
 * The seven status keywords a formation is built around. An Identity's keyword list also names every buff its skills
 * use (2026-11-04: "완성되어가는 교본", "피해량 증가", "신속" ...), which no player would read as a keyword to field.
 */
const FORMATION_KEYWORDS: readonly string[] = ['화상', '출혈', '진동', '파열', '침잠', '호흡', '충전']

/**
 * The gifts on sale this shop visit, from every shelf read of it: a read sees only the slots in view (a special shop's
 * third row needs a scroll, and bought slots move to its end), so a gift out of view stays on sale until a read shows it
 * bought (구매 완료). `reads`: [gift id, bought] of one read.
 */
export function visitShelf(onSale: readonly number[], reads: readonly (readonly [number, boolean])[]): number[] {
  const bought = new Set(reads.filter(([, sold]) => sold).map(([id]) => id))
  return [...new Set([...onSale, ...reads.filter(([, sold]) => !sold).map(([id]) => id)])].filter(id => !bought.has(id))
}

/**
 * Whether an Identity counts for a formation prescript: a 1-star one never does (every Sinner has one at no cost, so a
 * swap or a front filled with it would be grace for nothing). An unknown rarity counts. The one exception is a field-identity
 * stand-in, where a 1-star one is the hardest way to obey and earns 110% more.
 */
function counts(id: string | null, ctx: PrescriptContext): boolean {
  return id !== null && ctx.identity?.(id)?.rarity !== 1
}

/** How many of the formation's first six are of the keyword (1-star ones left out). */
function front(ids: readonly (string | null)[], keyword: string, ctx: PrescriptContext) {
  return ids.slice(0, 6).filter(id => counts(id, ctx) && ctx.identity?.(id!)?.keywords.includes(keyword)).length
}

type RoomChoice = { event_id: number; option_index?: number | null; outcome?: string | null; selection_condition?: string | null; next_event_id?: number | null }

/**
 * The options a player picks in a ? room: none for a check stage (an event with a judgment, whose rows are its success
 * and failure results), and only options anyone can take (no selection condition). With each, the next stage it leads to.
 */
export function eventRoomOptions(event: { judgment?: unknown } | undefined, choices: readonly RoomChoice[]): { option: number; next: number[] }[] {
  if (!event || event.judgment) return []
  const options = new Map<number, number[]>()
  for (const choice of choices) {
    // the game's table writes no condition as 'None' (440 rows) or leaves it empty (325)
    if (!Number.isInteger(choice.option_index) || choice.outcome || (choice.selection_condition && choice.selection_condition !== 'None')) continue
    const next = options.get(choice.option_index!) ?? []
    if (choice.next_event_id) next.push(choice.next_event_id)
    options.set(choice.option_index!, next)
  }
  return [...options].sort((a, b) => a[0] - b[0]).map(([option, next]) => ({ option, next }))
}

/** The room's option a stage after it shows: the one option leading to that event, if only one does. */
export function optionLeadingTo(options: readonly { option: number; next: number[] }[], eventId: number): number | null {
  const leading = options.filter(item => item.next.includes(eventId))
  return leading.length === 1 ? leading[0].option : null
}

/** The ? room's mandatory prescript: one of the options anyone can take (no selection condition), picked by `random`. */
export function eventPrescript(eventId: number, options: readonly number[], random: () => number): PrescriptCard | null {
  if (options.length < 2) return null
  return { scope: 'event', goal: { kind: 'event-choice', eventId, option: options[Math.floor(random() * options.length)] }, strength: 2 }
}

/**
 * The terminal's answer to a violation: a penance, forced at once (no choice, refusal or reroll), at least one strength
 * above the prescript broken and at least 4 (else the heaviest the floor offers, 3 or more), due on this floor. One at a time, and a broken penance brings no other (it costs grace
 * instead). None before a floor is read, nor for a recall (that is no violation).
 */
export function penance(run: PrescriptRun, ctx: PrescriptContext, at: number): PrescriptRun {
  if (ctx.floor < 1 || run.ended || run.prescripts.some(p => p.penance && p.status === 'active')) return run
  const broken = run.prescripts.filter(p => p.status === 'failed' && !p.penance && (p.settledAt ?? 0) > (run.penanceAt ?? 0)).at(-1)
  if (!broken) return run
  const floor = Math.min(5, Math.max(4, broken.strength + 1))
  // what is asked must be the weight: an easy order is never scored as a heavy one ("무엇도 팔지 마라" came at strength 4),
  // nor one already held
  const held = new Set(run.prescripts.filter(p => p.status === 'active').map(p => JSON.stringify(p.goal)))
  const pool = candidates('special', ctx).filter(card => feasible(card, ctx, false) && !held.has(JSON.stringify(card.goal)) && card.goal.kind !== 'no-sale')
  const heavy = pool.filter(card => card.strength >= floor)
  const strongest = Math.max(0, ...pool.map(c => c.strength))
  // nothing that heavy on this floor: the heaviest there is, if it weighs anything (3 or more)
  const choices = heavy.length ? heavy : strongest >= 3 ? pool.filter(card => card.strength === strongest) : []
  if (!choices.length) return { ...run, penanceAt: at }
  const card = choices[Math.floor(ctx.random() * choices.length)]
  const next = receive(run, card, ctx.floor, at)
  return { ...next, penanceAt: at, prescripts: next.prescripts.map(p => p.id === next.nextId - 1 ? { ...p, penance: true } : p) }
}

/** A refusal: the next offers start one strength higher (up to the strongest). */
export function resist(run: PrescriptRun): PrescriptRun {
  return { ...run, resisted: Math.min(4, (run.resisted ?? 0) + 1) }
}

/** An offer left unanswered until its occasion passed (the shop left, the floor over): a violation, as the Index sees it. */
export function missOffer(run: PrescriptRun, scope: PrescriptScope, floor: number, at: number): PrescriptRun {
  const missed: Prescript = { scope, goal: { kind: 'no-answer' }, strength: 1, id: run.nextId, floor, receivedAt: at, status: 'failed',
    progress: 0, settledAt: at, points: 0, reason: 'no-answer' }
  return { ...run, streak: 0, prescripts: [...run.prescripts, missed], nextId: run.nextId + 1 }
}

export function reroll(run: PrescriptRun): PrescriptRun | null {
  return run.rerollsLeft > 0 ? { ...run, rerollsLeft: run.rerollsLeft - 1 } : null
}

/** Which kinds want a card now: no active standing prescript, no special one received on this floor yet, and in the shop
 * (`inShop`: its shelf is read) no shop one received on this floor yet. */
export function wanted(run: PrescriptRun, floor: number, inShop = false): PrescriptScope[] {
  const scopes: PrescriptScope[] = []
  // nothing before a floor is read (the lobby, or a run joined midway): a pack card would name floors from a guess
  if (floor < 1) return scopes
  // a recalled standing prescript (the capture broke) comes again only on the next floor: a break is no free reroll
  if (!run.prescripts.some(p => p.scope === 'standing' && (p.status === 'active' || (p.status === 'void' && p.floor === floor))))
    scopes.push('standing')
  if (floor >= 1 && !run.prescripts.some(p => p.scope === 'special' && p.floor === floor)) scopes.push('special')
  if (inShop && floor >= 1 && !run.prescripts.some(p => p.scope === 'shop' && p.floor === floor)) scopes.push('shop')
  return scopes
}

/** `extra`: a share of the points on top (a 2-star stand-in fielded 0.5, a 1-star one 1.1). `fixed`: grace that is not a
 * strength's (the opening formation's), given as is with the blessing factor, outside the streak. */
type Outcome = { status: 'done' | 'failed'; extra?: number; fixed?: number } | { status: 'void'; reason: string } | { progress: number } | null

function judge(p: Prescript, event: PrescriptEvent, ctx: PrescriptContext): Outcome {
  const goal = p.goal
  const gift = 'giftId' in event ? ctx.gift(event.giftId) : undefined
  switch (event.type) {
    case 'gap': return { status: 'void', reason: event.reason }
    case 'leave-shop':
      if (p.scope !== 'shop') return null
      // left on its 1-star Identity to the end of the visit: obeyed the hard way
      if (goal.kind === 'field-identity' && goal.keep && ctx.formation?.find(id => id !== null && ctx.identity?.(id)?.sinner === goal.sinner) === goal.fromId)
        return { status: 'done', extra: 1.1 }
      return { status: 'failed' }
    case 'blessings': return null
    case 'event-outcome':
      if (goal.kind !== 'event-choice' || goal.eventId !== event.eventId) return null
      return event.conflict ? { status: 'void', reason: 'evidence-conflict' } : { status: event.option === goal.option ? 'done' : 'failed' }
    case 'formation': {
      if (goal.kind === 'swap-identity') {
        const now = event.ids.find(id => id !== null && ctx.identity?.(id)?.sinner === goal.sinner)
        return now && now !== goal.fromId && counts(now, ctx) ? { status: 'done' } : null
      }
      if (goal.kind === 'formation-keyword')
        return front(event.ids, goal.keyword, ctx) >= goal.count ? { status: 'done' } : null
      if (goal.kind === 'field-identity') {
        if (event.ids.includes(goal.identityId)) return { status: 'done' }
        // a stand-in: another Identity of that Sinner sharing a keyword, 3 stars, or 2 stars for half again, or 1 star for 110% more
        const now = event.ids.find(id => id !== null && ctx.identity?.(id)?.sinner === goal.sinner)
        const stand = now && now !== goal.fromId ? ctx.identity?.(now) : undefined
        if (!stand || !stand.keywords.some(keyword => goal.keywords.includes(keyword))) return null
        if ((stand.rarity ?? 0) >= 3) return { status: 'done' }
        if ((stand.rarity ?? 0) === 2) return { status: 'done', extra: 0.5 }
        if (stand.rarity === 1) return { status: 'done', extra: 1.1 }
        return null
      }
      if (goal.kind === 'front-identity') return event.ids.slice(0, 6).includes(goal.identityId) ? { status: 'done' } : null
      if (goal.kind === 'start-formation') {
        const points = startFormationPoints(event.ids, ctx)
        return points === null ? null : { status: 'done', fixed: points }
      }
      return null
    }
    case 'leave-event':
      // the result page went by unread: whether the option was taken cannot be known
      return goal.kind === 'event-choice' && goal.eventId === event.eventId ? { status: 'void', reason: 'event-unseen' } : null
    case 'sale':
      if (goal.kind === 'no-sale') return { status: 'failed' }
      if (goal.kind === 'sell-keyword' && gift?.keyword === goal.keyword) return { status: 'done' }
      if (goal.kind === 'sell-tier' && gift?.tier === goal.tier) return { status: 'done' }
      return null
    case 'acquire':
      if ((goal.kind === 'buy-gift' || goal.kind === 'buy-leftmost') && event.giftId === goal.giftId) return { status: 'done' }
      if (goal.kind === 'start-gift' || goal.kind === 'observe-gift') {
        if (event.giftId === goal.giftId) return { status: 'done' }
        // another of its pool: a pick was made, and not this one (this one may still come with the next pick)
        return goal.pool.includes(event.giftId) ? { progress: p.progress + 1 } : null
      }
      if (goal.kind === 'get-keyword' && gift?.keyword === goal.keyword)
        return p.progress + 1 >= goal.count ? { status: 'done' } : { progress: p.progress + 1 }
      return null
    case 'fusion':
      if (goal.kind === 'fuse-gift' && event.resultId === goal.giftId) return { status: 'done' }
      if (goal.kind === 'fuse-tier' && (ctx.gift(event.resultId)?.tier ?? 0) >= goal.tier) return { status: 'done' }
      return null
    case 'floor':
      if (goal.kind === 'start-gift' || goal.kind === 'observe-gift') {
        // the run is under way: another of the pool seen taken is a violation; none seen, the pick went unread
        if (event.floor >= 1) return p.progress > 0 ? { status: 'failed' } : { status: 'void', reason: 'start-unseen' }
        return null
      }
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
  // the blessings are read before the run (the last read of their screen stands); they settle no prescript
  if (event.type === 'blessings') return ctx.floor < 1 && !run.ended ? { ...run, blessingSpent: event.spent } : run
  let { score, streak, rerollsLeft } = run
  let resisted = run.resisted ?? 0
  const prescripts = run.prescripts.map(p => {
    if (p.status !== 'active') return p
    // only what happened after it was received counts: a fusion or purchase seen earlier and read late is not its doing
    if (event.type !== 'gap' && event.at < p.receivedAt) return p
    const outcome = judge(p, event, ctx)
    if (!outcome) return p
    if ('progress' in outcome) return { ...p, progress: outcome.progress }
    if (outcome.status === 'void') return { ...p, status: 'void' as const, reason: outcome.reason, settledAt: event.at }
    if (outcome.status === 'failed') {
      streak = 0
      // a violation is resistance too: the next prescripts come heavier
      resisted = Math.min(4, resisted + 1)
      // a failed penance costs what it would have given
      const lost = p.penance ? Math.min(score, prescriptPoints(p.strength, p.scope, 1, run.grade, runBlessing(run))) : 0
      score -= lost
      return { ...p, status: 'failed' as const, settledAt: event.at, points: -lost }
    }
    if (outcome.fixed !== undefined) {
      const points = Math.round(outcome.fixed * runBlessing(run))
      score += points
      return { ...p, status: 'done' as const, settledAt: event.at, points }
    }
    streak += 1
    resisted = Math.max(0, resisted - 1)
    const base = prescriptPoints(p.strength, p.scope, streak, run.grade, runBlessing(run))
    const points = base + Math.round(base * (outcome.extra ?? 0))
    const bonus = STREAK_BONUS[streak] ?? 0
    if (bonus) rerollsLeft = Math.min(gradeOf(run).rerolls, rerollsLeft + 1)
    score += points + bonus
    return { ...p, status: 'done' as const, settledAt: event.at, points, ...(bonus ? { bonus } : {}),
      progress: p.goal.kind === 'get-keyword' ? p.goal.count : p.progress }
  })
  return { ...run, prescripts, score, streak, resisted, rerollsLeft }
}

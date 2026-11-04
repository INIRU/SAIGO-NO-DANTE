/**
 * Index prescript mode (재미): prescripts come down while the player runs the Mirror Dungeon, and whether one was carried
 * out is read only from the Assist capture's evidence (acquisition popups, sales, fusions, confirmed floors). The player
 * never marks one done. A break in the capture voids what was in progress: neither failed nor scored (USER 2026-11-03).
 *
 * Three kinds: a standing prescript (always one; the next comes once it is carried out, to the end of the run), a special
 * one (one a floor, due before the next floor is confirmed) and a shop one (one a floor, from the shelf as read, due before
 * the shop is left). Only prescripts the run can carry out now are offered.
 */

/** `event`: a mandatory prescript given in a ? room, never offered as a choice, never refused. */
export type PrescriptScope = 'standing' | 'special' | 'shop' | 'event'
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
  /** An offer the player let pass without answering (recorded, never offered). */
  | { kind: 'no-answer' }
  /** In this ? room, take this option (its button: `option`, the choices table's option_index). */
  | { kind: 'event-choice'; eventId: number; option: number }
  /** Put another Identity in this Sinner's place (the shop's formation): `fromId` is the one the bar showed. */
  | { kind: 'swap-identity'; sinner: string; fromId: string }
  /** At least `count` Identities of the keyword among the first six of the formation. */
  | { kind: 'formation-keyword'; keyword: string; count: number }

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
  /** A penance: forced on a violation, heavier, and its own violation costs the grace it would have given. */
  penance?: boolean
  /** Grace for the streak it completed (3, 5 and 10 in a row), on top of `points`. */
  bonus?: number
}
/**
 * `ended`: the dungeon's end screen was seen with the terminal on from then to the end; only such a record is kept.
 * `resisted`: refusals not yet made up for. Each raises the weakest strength the terminal offers by one ("저항은 권하지
 * 않습니다… 절제 범위가 커진 지령이 새로 도착"); each prescript carried out takes one away.
 */
/** `penanceAt`: when the last violation was answered (with a penance, or found none to give). */
export interface PrescriptRun { prescripts: Prescript[]; score: number; streak: number; rerollsLeft: number; nextId: number; ended?: boolean; endedAt?: number; resisted?: number; grade?: PrescriptGrade; penanceAt?: number }

export type PrescriptEvent =
  | { type: 'acquire'; giftId: number; at: number }
  | { type: 'sale'; giftId: number; at: number }
  | { type: 'fusion'; resultId: number; at: number }
  | { type: 'floor'; floor: number; themeIds: readonly string[]; at: number }
  | { type: 'gap'; at: number; reason: string }
  /** The shop's screens gave way to the map, a battle or another room. */
  | { type: 'leave-shop'; at: number }
  /** A ? room's result page: the option taken, read from the result text only it has. */
  // `conflict`: two readings of the room named different options (the cursor and the next screen or the result text)
  | { type: 'event-outcome'; eventId: number; option: number; at: number; conflict?: boolean }
  /** The ? room was left without its result page read. */
  | { type: 'leave-event'; eventId: number; at: number }
  /** The formation read from the bar: twelve Identity ids in deployment order (null where unread). */
  | { type: 'formation'; ids: readonly (string | null)[]; at: number }

export interface PrescriptContext {
  floor: number
  inventory: readonly string[]
  /** Gifts the plan needs: never asked to be sold, the lightest to buy. */
  planGiftIds: ReadonlySet<number>
  /** The plan's main keywords: giving up such a gift weighs more, gathering them less. */
  planKeywords?: readonly string[]
  gift: (id: number) => { keyword: string | null; tier: number | null } | undefined
  /** Fixed-recipe results the inventory can make now. */
  craftable: () => number[]
  /** Pack ids a floor of this run can offer. */
  themesOn: (floor: number) => string[]
  random: () => number
  /** Gifts on the shop shelf, unsold, read with confidence, in shelf order (empty outside the shop). */
  shelf?: readonly number[]
  /** The formation last read from the bar (twelve ids in deployment order, null where unread). */
  formation?: readonly (string | null)[]
  /** An Identity's Sinner and keywords, by its id. */
  identity?: (id: string) => { sinner: string; keywords: readonly string[] } | undefined
}

/**
 * The terminal's grade, chosen before a run: a Proselyte (수행자) may return cards three times, has 20 s to answer and may
 * decline; a Proxy (대행자) returns them once, has 12 s and may not decline, for half again the grace.
 */
export type PrescriptGrade = 'proselyte' | 'proxy'
export const GRADES: Record<PrescriptGrade, { rerolls: number; replyMs: number; refuse: boolean; multiplier: number }> = {
  proselyte: { rerolls: 3, replyMs: 20000, refuse: true, multiplier: 1 },
  proxy: { rerolls: 1, replyMs: 12000, refuse: false, multiplier: 1.5 },
}
export const gradeOf = (run: PrescriptRun) => GRADES[run.grade ?? 'proselyte']
export const PRESCRIPT_REROLLS = 3
/** How long an offer waits for an answer before the terminal chooses for the player (선택받는 삶). */
export const PRESCRIPT_REPLY_MS = 20000
/** The five vestiges (잔재): worth nothing to get or to give up, so no prescript asks for or counts them. */
export const isVestige = (giftId: number) => giftId >= 9991 && giftId <= 9995
export const LAST_FLOOR = 15
const STRENGTH_POINTS = [5, 10, 20, 35, 60] as const

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

export function prescriptPoints(strength: Strength, scope: PrescriptScope, inARow: number, grade: PrescriptGrade = 'proselyte'): number {
  const streak = inARow >= 10 ? 1.5 : inARow >= 5 ? 1.2 : inARow >= 3 ? 1.1 : 1
  return Math.round(STRENGTH_POINTS[strength - 1] * (scope === 'standing' ? 1 : 1.5) * streak * GRADES[grade].multiplier)
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
        const behind = formation.slice(6).some(id => id !== null && ctx.identity?.(id)?.keywords.includes(keyword))
        cards.push({ scope, goal: { kind: 'formation-keyword', keyword, count: count + 1 }, strength: behind ? 2 : 4 })
      }
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
    case 'sell-keyword': case 'sell-tier': return candidates(card.scope, ctx).some(other => JSON.stringify(other.goal) === JSON.stringify(goal))
    default: return true
  }
}

/**
 * The seven status keywords a formation is built around. An Identity's keyword list also names every buff its skills
 * use (2026-11-04: "완성되어가는 교본", "피해량 증가", "신속" ...), which no player would read as a keyword to field.
 */
export const FORMATION_KEYWORDS: readonly string[] = ['화상', '출혈', '진동', '파열', '침잠', '호흡', '충전']

/**
 * The gifts on sale this shop visit, from every shelf read of it: a read sees only the slots in view (a special shop's
 * third row needs a scroll, and bought slots move to its end), so a gift out of view stays on sale until a read shows it
 * bought (구매 완료). `reads`: [gift id, bought] of one read.
 */
export function visitShelf(onSale: readonly number[], reads: readonly (readonly [number, boolean])[]): number[] {
  const bought = new Set(reads.filter(([, sold]) => sold).map(([id]) => id))
  return [...new Set([...onSale, ...reads.filter(([, sold]) => !sold).map(([id]) => id)])].filter(id => !bought.has(id))
}

/** How many of the formation's first six are of the keyword. */
function front(ids: readonly (string | null)[], keyword: string, ctx: PrescriptContext) {
  return ids.slice(0, 6).filter(id => id !== null && ctx.identity?.(id)?.keywords.includes(keyword)).length
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
 * The terminal's answer to a violation: a penance, forced at once (no choice, refusal or reroll), one strength above the
 * prescript broken and at least 4, due on this floor. One at a time, and a broken penance brings no other (it costs grace
 * instead). None before a floor is read, nor for a recall (that is no violation).
 */
export function penance(run: PrescriptRun, ctx: PrescriptContext, at: number): PrescriptRun {
  if (ctx.floor < 1 || run.ended || run.prescripts.some(p => p.penance && p.status === 'active')) return run
  const broken = run.prescripts.filter(p => p.status === 'failed' && !p.penance && (p.settledAt ?? 0) > (run.penanceAt ?? 0)).at(-1)
  if (!broken) return run
  const floor = Math.min(5, Math.max(4, broken.strength + 1))
  const pool = candidates('special', ctx).filter(card => feasible(card, ctx, false))
  const heavy = pool.filter(card => card.strength >= floor)
  const choices = heavy.length ? heavy : pool.filter(card => card.strength === Math.max(...pool.map(c => c.strength)))
  if (!choices.length) return { ...run, penanceAt: at }
  const card = choices[Math.floor(ctx.random() * choices.length)]
  const next = receive(run, { ...card, strength: Math.max(card.strength, floor) as Strength }, ctx.floor, at)
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

type Outcome = { status: 'done' | 'failed' } | { status: 'void'; reason: string } | { progress: number } | null

function judge(p: Prescript, event: PrescriptEvent, ctx: PrescriptContext): Outcome {
  const goal = p.goal
  const gift = 'giftId' in event ? ctx.gift(event.giftId) : undefined
  switch (event.type) {
    case 'gap': return { status: 'void', reason: event.reason }
    case 'leave-shop': return p.scope === 'shop' ? { status: 'failed' } : null
    case 'event-outcome':
      if (goal.kind !== 'event-choice' || goal.eventId !== event.eventId) return null
      return event.conflict ? { status: 'void', reason: 'evidence-conflict' } : { status: event.option === goal.option ? 'done' : 'failed' }
    case 'formation': {
      if (goal.kind === 'swap-identity') {
        const now = event.ids.find(id => id !== null && ctx.identity?.(id)?.sinner === goal.sinner)
        return now && now !== goal.fromId ? { status: 'done' } : null
      }
      if (goal.kind === 'formation-keyword')
        return front(event.ids, goal.keyword, ctx) >= goal.count ? { status: 'done' } : null
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
      const lost = p.penance ? Math.min(score, prescriptPoints(p.strength, p.scope, 1, run.grade)) : 0
      score -= lost
      return { ...p, status: 'failed' as const, settledAt: event.at, points: -lost }
    }
    streak += 1
    resisted = Math.max(0, resisted - 1)
    const points = prescriptPoints(p.strength, p.scope, streak, run.grade)
    const bonus = STREAK_BONUS[streak] ?? 0
    if (bonus) rerollsLeft = Math.min(gradeOf(run).rerolls, rerollsLeft + 1)
    score += points + bonus
    return { ...p, status: 'done' as const, settledAt: event.at, points, ...(bonus ? { bonus } : {}),
      progress: p.goal.kind === 'get-keyword' ? p.goal.count : p.progress }
  })
  return { ...run, prescripts, score, streak, resisted, rerollsLeft }
}

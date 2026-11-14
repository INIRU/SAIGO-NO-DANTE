// The clash (합): the odds of winning it, how many exchanges it takes and how many coins are left, solved exactly.
// Rules (game values): the heads chance is 50% + 1% per point of sanity + the buff adder; coins are rolled in order and
// each heads applies its operator to the running power, which never goes below 0; every exchange rolls the remaining
// coins again, the higher total wins and takes one coin from the loser's front, a tie takes none; at most 99 exchanges.
// The 5%–95% limit of the heads chance and the level-gap divisor 3 are not confirmed by the game's values (estimates).

type CoinOperator = 'ADD' | 'SUB' | 'MUL'
export type ClashCoin = { scale: number; operator: CoinOperator }

export const MAX_CLASH_ROUNDS = 99
export const SANITY_RANGE = 45
/** The heads chance stays in this range (estimate). */
const PROBABILITY_LIMITS = { min: 0.05, max: 0.95 } as const
/** Every this many attack levels above the other side add 1 to each exchange total (estimate: the game's divisor was not read). */
const LEVEL_GAP_DIVISOR = 3

export type ClashSide = {
  basePower: number
  coins: readonly ClashCoin[]
  /** −45 … 45. */
  sanity: number
  /** Percentage points added to the heads chance (a buff's adder). */
  probabilityAdder?: number
  /** Added to the base power. */
  powerAdder?: number
  /** Added to the scale of every adding coin. */
  coinPowerAdder?: number
  /** Added to the scale of every subtracting coin (it then takes more away). */
  subCoinPowerAdder?: number
  /** Added to the total of every exchange. */
  clashAdder?: number
  /** The skill's attack level: the higher side adds a third of the gap to every exchange. */
  offenseLevel?: number
}

type ClashResult = {
  /** Chance that the first side takes all of the other's coins / the other side does. */
  winA: number
  winB: number
  /** Still both with coins after 99 exchanges. */
  unresolved: number
  /** rounds[k]: the chance that the clash ends after k exchanges (ties included). rounds[0] is a clash that never starts. */
  rounds: number[]
  /** leftA[k], leftB[k]: the chance that the side ends with k coins. */
  leftA: number[]
  leftB: number[]
  meanRounds: number
  headsA: number
  headsB: number
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))
/** Rounded so that equal totals meet in one key (a multiplying coin makes fractions). */
const keyOf = (value: number) => Math.round(value * 1e6) / 1e6

export function headsChance(sanity: number, adder = 0) {
  const points = clamp(Math.trunc(sanity), -SANITY_RANGE, SANITY_RANGE) + adder
  return clamp(0.5 + points * 0.01, PROBABILITY_LIMITS.min, PROBABILITY_LIMITS.max)
}

/** Applies one heads coin; the power never drops below 0. */
export function applyCoin(power: number, coin: ClashCoin) {
  return Math.max(0, coin.operator === 'ADD' ? power + coin.scale : coin.operator === 'SUB' ? power - coin.scale : power * coin.scale)
}

/** The distribution of one roll of `coins` in order from `start` (key: the total, value: its chance). */
export function rollDistribution(start: number, coins: readonly ClashCoin[], heads: number): [number, number][] {
  let states = new Map<number, number>([[keyOf(Math.max(0, start)), 1]])
  for (const coin of coins) {
    const next = new Map<number, number>()
    for (const [power, chance] of states) {
      const up = keyOf(applyCoin(power, coin))
      next.set(up, (next.get(up) ?? 0) + chance * heads)
      next.set(power, (next.get(power) ?? 0) + chance * (1 - heads))
    }
    states = next
  }
  return [...states].sort((a, b) => a[0] - b[0])
}

/** The chances that a roll of `a` beats / loses to / ties a roll of `b`. */
export function compare(a: [number, number][], b: [number, number][]) {
  let win = 0, tie = 0, below = 0, index = 0
  for (const [value, chance] of a) {
    // `below`: the chance of the b totals under value; `tie`: those equal to it.
    while (index < b.length && b[index][0] < value) below += b[index++][1]
    const equal = index < b.length && b[index][0] === value ? b[index][1] : 0
    win += chance * below
    tie += chance * equal
  }
  return { win, tie, lose: 1 - win - tie }
}

/** The higher attack level's bonus to each exchange: a third of the gap, rounded down (the lower side gets none). */
function levelGapBonus(own?: number, other?: number) {
  if (own == null || other == null) return 0
  return Math.max(0, Math.trunc((own - other) / LEVEL_GAP_DIVISOR))
}

/** The total of a side's remaining coins `left` … end, with its base power and adders; a total never goes under 0. */
function rolls(side: ClashSide, heads: number, bonus: number) {
  const adder = (coin: ClashCoin) => coin.operator === 'ADD' ? side.coinPowerAdder ?? 0 : coin.operator === 'SUB' ? side.subCoinPowerAdder ?? 0 : 0
  const coins = side.coins.map(coin => ({ ...coin, scale: Math.max(0, coin.scale + adder(coin)) }))
  const start = side.basePower + (side.powerAdder ?? 0)
  const total = (value: number) => keyOf(Math.max(0, value + (side.clashAdder ?? 0) + bonus))
  // After i lost coins the coins i … n−1 are rolled (the front coin is the one that breaks). Totals that meet merge.
  return coins.map((_, lost) => {
    const merged = new Map<number, number>()
    for (const [value, chance] of rollDistribution(start, coins.slice(lost), heads)) merged.set(total(value), (merged.get(total(value)) ?? 0) + chance)
    return [...merged].sort((a, b) => a[0] - b[0])
  })
}

/**
 * Exact result by forward steps over (coins A lost, coins B lost): every step is one exchange, so ties and the 99 limit
 * are exact rather than approximated. Cost: 99 × (coins A × coins B) states.
 */
export function solveClash(a: ClashSide, b: ClashSide): ClashResult {
  const headsA = headsChance(a.sanity, a.probabilityAdder), headsB = headsChance(b.sanity, b.probabilityAdder)
  const n = a.coins.length, m = b.coins.length
  const rollsA = rolls(a, headsA, levelGapBonus(a.offenseLevel, b.offenseLevel)), rollsB = rolls(b, headsB, levelGapBonus(b.offenseLevel, a.offenseLevel))
  const odds = Array.from({ length: n }, (_, i) => Array.from({ length: m }, (_, j) => compare(rollsA[i], rollsB[j])))

  const result: ClashResult = { winA: 0, winB: 0, unresolved: 0, rounds: Array(MAX_CLASH_ROUNDS + 1).fill(0), leftA: Array(n + 1).fill(0), leftB: Array(m + 1).fill(0), meanRounds: 0, headsA, headsB }
  const finish = (chance: number, lostA: number, lostB: number, round: number) => {
    result.rounds[round] += chance
    result.leftA[n - lostA] += chance
    result.leftB[m - lostB] += chance
    if (lostB >= m && lostA < n) result.winA += chance
    else if (lostA >= n && lostB < m) result.winB += chance
  }
  let states = new Map<number, number>()
  if (n === 0 || m === 0) finish(1, 0, 0, 0)
  else states.set(0, 1)
  for (let round = 1; round <= MAX_CLASH_ROUNDS && states.size; round++) {
    const next = new Map<number, number>()
    const add = (lostA: number, lostB: number, chance: number) => {
      if (chance <= 0) return
      if (lostA >= n || lostB >= m) finish(chance, lostA, lostB, round)
      else next.set(lostA * (m + 1) + lostB, (next.get(lostA * (m + 1) + lostB) ?? 0) + chance)
    }
    for (const [state, chance] of states) {
      const lostA = Math.floor(state / (m + 1)), lostB = state % (m + 1)
      const { win, tie, lose } = odds[lostA][lostB]
      add(lostA, lostB + 1, chance * win)
      add(lostA + 1, lostB, chance * lose)
      add(lostA, lostB, chance * tie)
    }
    states = next
  }
  for (const [state, chance] of states) {
    result.unresolved += chance
    const lostA = Math.floor(state / (m + 1)), lostB = state % (m + 1)
    result.leftA[n - lostA] += chance
    result.leftB[m - lostB] += chance
  }
  result.meanRounds = result.rounds.reduce((sum, chance, round) => sum + chance * round, 0)
  return result
}

/** A skill's coins: its coin list, or — for a skill without one — its coin count all adding the one coin power. */
export function coinsOf(skill: { coins?: number | null; coin_power?: number | null; coin_list?: readonly { scale?: number; operator?: string }[] | null }): ClashCoin[] {
  if (skill.coin_list?.length) {
    return skill.coin_list.map(coin => ({ scale: Number.isFinite(coin.scale) ? coin.scale! : 0, operator: coin.operator === 'SUB' || coin.operator === 'MUL' ? coin.operator : 'ADD' }))
  }
  return Array.from({ length: Math.max(0, skill.coins ?? 0) }, () => ({ scale: skill.coin_power ?? 0, operator: 'ADD' as const }))
}

/** The exchange count an outcome hands to the damage calculator: the number of exchanges as the page link. */
export const damageLink = (lang: string, exchanges: number) => `/${lang}/tools/damage?clash=${Math.max(0, Math.min(MAX_CLASH_ROUNDS, Math.round(exchanges)))}`

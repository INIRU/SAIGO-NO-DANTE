// Types of the index prescript mode (see prescript.ts for the rules).

/** `event`: a mandatory prescript given in a ? room, never offered as a choice, never refused. `start`: the run's opening
 * orders (the formation, the start gift, the observed gift), given as the run begins, also never refused. */
export type PrescriptScope = 'standing' | 'special' | 'shop' | 'event' | 'start'
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
  /**
   * Field this Identity in its Sinner's place. One not owned may be stood in for by another Identity of that Sinner sharing
   * one of `keywords`: of 3 stars, or else of 2 stars (50% more) or 1 star (110% more). `fromId`: the one fielded when it was
   * offered (a stand-in must be another). `keep`: `fromId` is the Sinner's 1-star Identity, and leaving it fielded until the
   * shop is left is obeying too, for 110% more (USER 2026-11-04: "안 바꾸면 110%").
   */
  | { kind: 'field-identity'; identityId: string; sinner: string; fromId: string; keywords: string[]; keep?: boolean }
  /** This fielded Identity among the first six (it stood in 7 to 12). */
  | { kind: 'front-identity'; identityId: string }
  /**
   * The run's opening formation, free: the first bar read whole scores all twelve Identities by star rating, in any order
   * (START_FORMATION_POINTS), never a violation (USER 2026-11-04: "편성 전체 12명을 다 봐야해") (USER 2026-11-04: "자유롭게 편성 ... 3성 0점, 2성 몇 점, 1성은 최대 점수").
   */
  | { kind: 'start-formation' }
  /** Take this start gift (`pool`: its keyword's start gifts; one of them taken and not this one is a violation). */
  | { kind: 'start-gift'; giftId: number; pool: number[] }
  /** Take this gift by observation before the run (`pool`: the gifts observation offers). */
  | { kind: 'observe-gift'; giftId: number; pool: number[] }

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
/** `blessingSpent`: the starlight spent on the run's blessings (별의 가호), once read; it sets the run's blessing factor. */
export interface PrescriptRun { prescripts: Prescript[]; score: number; streak: number; rerollsLeft: number; nextId: number; ended?: boolean; endedAt?: number; resisted?: number; grade?: PrescriptGrade; penanceAt?: number; blessingSpent?: number }

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
  /** The blessing screen as read before the run: the starlight its chosen blessings cost. */
  | { type: 'blessings'; spent: number; at: number }

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
  /** The plan's Identities (game ids): the ones the player means to field, so owns. */
  planIdentities?: readonly string[]
  /** The formation last read from the bar (twelve ids in deployment order, null where unread). */
  formation?: readonly (string | null)[]
  /** An Identity's Sinner and keywords, by its id. */
  identity?: (id: string) => { sinner: string; keywords: readonly string[]; rarity?: number } | undefined
  /** Every Identity of a Sinner (game ids): the stand-ins a field-identity prescript may take. */
  identitiesOf?: (sinner: string) => readonly string[]
  /** The start gifts, a pool a keyword (the dungeon's common data, three each). */
  startPools?: readonly (readonly number[])[]
  /** The gifts observation offers this season. */
  observable?: readonly number[]
}

/**
 * The terminal's grade, chosen before a run: a Proselyte (수행자) may return cards three times, has 20 s to answer and may
 * decline; a Proxy (대행자) returns them once, has 12 s and may not decline, for half again the grace.
 */
export type PrescriptGrade = 'proselyte' | 'proxy'

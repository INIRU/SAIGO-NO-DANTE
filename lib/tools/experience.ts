/** Level costs: LimbusAssets-2/Data/static-data/common-data/common-data-a1c10.json
 * personalityLevelTable.expTable, extracted 2026-09-19 (61–65: 9792 each).
 * Reward bundles and ticket values: preserved Drive exp-dungeon-*.json / item-200-ticket.json.
 * Skips round each ticket quantity up after the 1.5 multiplier, not the total EXP.
 */
export const TICKET_EXP = [50, 200, 1000, 3000] as const
export const TICKET_NAMES = ['I', 'II', 'III', 'IV'] as const
export type Tickets = [number, number, number, number]
export const LEVEL_COSTS = [0, 0, 10, 12, 15, 20, 27, 40, 59, 88, 125,
  168, 227, 298, 381, 482, 591, 728, 885, 1064, 1261, 1488, 1739, 2016, 2327, 2674,
  3047, 3456, 3899, 4378, 4899, 3899, 4378, 4899, 5468, 6075, 4899, 5468, 6075,
  6722, 7413, 6075, 6722, 7413, 8156, 8953, 7413, 7413, 7413, 7413, 7413,
  8156, 8156, 8156, 8156, 8156, 8953, 8953, 8953, 8953, 8953, 9792, 9792, 9792, 9792, 9792] as const
export const MAX_EXPERIENCE_LEVEL = LEVEL_COSTS.length - 1
const MAX_EXPERIENCE = LEVEL_COSTS.reduce<number>((sum, cost) => sum + cost, 0)
export const LUXCAVATIONS: { stage: number; modules: number; tickets: Tickets }[] = [
  [6, 7, 0, 0], [0, 3, 3, 0], [0, 4, 4, 0], [0, 0, 4, 2], [0, 1, 6, 2],
  [0, 2, 2, 4], [0, 4, 4, 4], [0, 4, 2, 6], [0, 6, 6, 6],
].map((tickets, i) => ({ stage: i + 1, modules: i < 3 ? 2 : 3, tickets: tickets as Tickets }))
export const ENKEPHALIN_PER_MODULE = 20
export function ticketExperience(tickets: Tickets): number {
  return tickets.reduce((sum, count, i) => sum + count * TICKET_EXP[i], 0)
}
function integerInRange(value: number, min: number, max: number) {
  if (!Number.isSafeInteger(value) || value < min || value > max) throw new RangeError('Invalid experience input')
}
export function experienceNeeded(current: number, target: number, progress = 0): number {
  integerInRange(current, 1, MAX_EXPERIENCE_LEVEL)
  integerInRange(target, current, MAX_EXPERIENCE_LEVEL)
  integerInRange(progress, 0, current === MAX_EXPERIENCE_LEVEL ? 0 : LEVEL_COSTS[current + 1] - 1)
  if (current === target) return 0
  return LEVEL_COSTS.slice(current + 1, target + 1).reduce<number>((a, b) => a + b, 0) - progress
}
/** Divisible denominations permit bounded greedy for a fixed total. Search totals in
 * increasing order (at most one largest ticket of overshoot), then use fewest tickets.
 * Runtime is independent of inventory size; no array sized to the user's stock.
 */
export function optimizeTickets(required: number, inventory: Tickets) {
  integerInRange(required, 0, MAX_EXPERIENCE)
  inventory.forEach(n => integerInRange(n, 0, 1000000))
  const available = ticketExperience(inventory)
  let used: Tickets = [0, 0, 0, 0]
  if (available < required) used = [...inventory]
  else {
    for (let total = Math.ceil(required / 50) * 50; total < required + 3000; total += 50) {
      let remaining = total
      const candidate: Tickets = [0, 0, 0, 0]
      for (let i = 3; i >= 0; i--) {
        candidate[i] = Math.min(inventory[i], Math.floor(remaining / TICKET_EXP[i]))
        remaining -= candidate[i] * TICKET_EXP[i]
      }
      if (!remaining) { used = candidate; break }
    }
  }
  const spent = ticketExperience(used)
  return { used, left: inventory.map((n, i) => n - used[i]) as Tickets, spent,
    excess: Math.max(0, spent - required), missing: Math.max(0, required - spent) }
}
export function planLuxcavation(required: number, inventory: Tickets, stage: number, skip: boolean) {
  integerInRange(stage, 1, 9)
  const owned = optimizeTickets(required, inventory)
  const dungeon = LUXCAVATIONS[stage - 1]
  const reward = dungeon.tickets.map(n => skip ? Math.ceil(n * 1.5) : n) as Tickets
  const experience = ticketExperience(reward)
  const runs = Math.ceil(owned.missing / experience)
  const modules = runs * dungeon.modules * (skip ? 2 : 1)
  const total = inventory.map((n, i) => n + reward[i] * runs) as Tickets
  return { reward, experience, runs, modules, enkephalin: modules * ENKEPHALIN_PER_MODULE,
    plan: optimizeTickets(required, total) }
}

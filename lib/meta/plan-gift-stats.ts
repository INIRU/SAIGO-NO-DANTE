import { planGiftIds } from './aggregate'

/**
 * Which public plans hold each gift: `holders[gameId]` is a base64 bitset over the plans (bit i = plan i). Gift and
 * pair counts come from it, so every pair is known (also pairs that never go together) at about 30 bytes a gift.
 */
export interface PlanGiftStats {
  plans: number
  holders: Record<string, string>
}

/** A plan's gifts: its inventory (final, start, observe) and the gifts planned on its floors, each once. */
function planGifts(plan: { inventory: unknown; floorPlan: unknown }): string[] {
  const floorGifts = Array.isArray(plan.floorPlan) ? plan.floorPlan.flatMap(row =>
    row && typeof row === 'object' && Array.isArray((row as { gift_ids?: unknown }).gift_ids) ? (row as { gift_ids: unknown[] }).gift_ids.map(String) : []) : []
  return [...new Set([...planGiftIds(plan.inventory), ...floorGifts.filter(id => /^\d+$/.test(id))])]
}

const toBase64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes))

// grows by one bit per plan per gift (1,000 plans ≈ 70 KB); keep the newest plans only if it gets heavy.
export function planGiftStats(plans: { inventory: unknown; floorPlan: unknown }[]): PlanGiftStats {
  const bits = new Map<string, Uint8Array>()
  plans.forEach((plan, index) => {
    for (const id of planGifts(plan)) {
      const set = bits.get(id) ?? new Uint8Array(Math.ceil(plans.length / 8))
      set[index >> 3] |= 1 << (index & 7)
      bits.set(id, set)
    }
  })
  return { plans: plans.length, holders: Object.fromEntries([...bits].map(([id, set]) => [id, toBase64(set)])) }
}

const decoded = new WeakMap<PlanGiftStats, Map<string, Uint8Array>>()
function holderBits(stats: PlanGiftStats, id: string | number): Uint8Array | null {
  let cache = decoded.get(stats)
  if (!cache) decoded.set(stats, cache = new Map())
  const key = String(id)
  if (!cache.has(key)) {
    const text = stats.holders[key]
    cache.set(key, text ? Uint8Array.from(atob(text), char => char.charCodeAt(0)) : new Uint8Array())
  }
  const bits = cache.get(key)!
  return bits.length ? bits : null
}

const popcount = (byte: number) => { let count = 0; for (; byte; byte &= byte - 1) count++; return count }

/** Plans holding the gift. */
export function giftCount(stats: PlanGiftStats, id: string | number): number {
  const bits = holderBits(stats, id)
  return bits ? bits.reduce((sum, byte) => sum + popcount(byte), 0) : 0
}

/** Plans holding both gifts. */
export function pairCount(stats: PlanGiftStats, a: string | number, b: string | number): number {
  const x = holderBits(stats, a), y = holderBits(stats, b)
  if (!x || !y) return 0
  let count = 0
  for (let i = 0; i < Math.min(x.length, y.length); i++) count += popcount(x[i] & y[i])
  return count
}

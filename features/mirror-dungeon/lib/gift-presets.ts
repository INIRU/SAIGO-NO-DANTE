import type { EgoGift } from '@/features/mirror-dungeon/types'
import { giftCheckKey, normalizeChecked } from './gift-check'

/** A named block of gifts inside a preset ("최우선 먹기"), with a short note; `gifts` holds giftCheckKey values. */
export interface GiftPresetGroup { name: string; gifts: string[]; memo: string }
/** Gifts to obtain in a run. A gift sits in one group only. Account presets have the id `s<slot>`. */
export interface GiftPreset { id: string; name: string; groups: GiftPresetGroup[] }
export interface GiftPresets { active: string | null; list: GiftPreset[] }
export type GiftPresetBody = Pick<GiftPreset, 'name' | 'groups'>

/** Presets of a browser without an account, and the browser's copy of the signed-in account's presets. */
export const GIFT_PRESET_STORAGE = 'snd-gift-presets'
export const GIFT_PRESET_ACCOUNT_STORAGE = 'snd-gift-presets-account'
export const GIFT_PRESET_LIMIT = 5
export const GIFT_PRESET_NAME_MAX = 20
export const GIFT_PRESET_GROUP_LIMIT = 6
export const GIFT_PRESET_MEMO_MAX = 100
export const GIFT_PRESET_GIFT_LIMIT = 60
/** Browsers stored up to ten presets before the limit became five; those are still read. */
const STORED_PRESET_LIMIT = 10

const text = (value: unknown, max: number) => typeof value === 'string' ? value.slice(0, max) : ''
const emptyGroup = (): GiftPresetGroup => ({ name: '', gifts: [], memo: '' })

/**
 * A preset's name and groups made safe: texts cut to their limits, at most six groups, each gift in its first group only
 * and no more than `giftLimit` gifts. The older shape (a name and one flat `gifts` list) becomes a single group.
 */
export function normalizePresetBody(raw: unknown, giftLimit = GIFT_PRESET_GIFT_LIMIT): GiftPresetBody {
  const source = (raw && typeof raw === 'object' ? raw : {}) as { name?: unknown; groups?: unknown; gifts?: unknown }
  const seen = new Set<string>()
  const groups = (Array.isArray(source.groups) ? source.groups : [{ gifts: source.gifts }]).slice(0, GIFT_PRESET_GROUP_LIMIT).map(group => {
    const item = (group && typeof group === 'object' ? group : {}) as { name?: unknown; gifts?: unknown; memo?: unknown }
    const gifts: string[] = []
    for (const key of normalizeChecked(item.gifts)) {
      if (seen.size >= giftLimit || seen.has(key)) continue
      seen.add(key)
      gifts.push(key)
    }
    return { name: text(item.name, GIFT_PRESET_NAME_MAX), gifts, memo: text(item.memo, GIFT_PRESET_MEMO_MAX) }
  })
  return { name: text(source.name, GIFT_PRESET_NAME_MAX), groups: groups.length ? groups : [emptyGroup()] }
}

/** The stored presets without broken entries; a chosen preset that no longer exists is dropped. Nothing held is cut. */
export function normalizePresets(saved: unknown): GiftPresets {
  const raw = (saved && typeof saved === 'object' ? saved : {}) as { active?: unknown; list?: unknown }
  const list = (Array.isArray(raw.list) ? raw.list : [])
    .filter((preset): preset is { id: string; name: string } => !!preset && typeof preset.id === 'string' && typeof preset.name === 'string')
    .slice(0, STORED_PRESET_LIMIT)
    .map(preset => ({ id: preset.id, ...normalizePresetBody(preset, Infinity) }))
  return { active: list.some(preset => preset.id === raw.active) ? raw.active as string : null, list }
}

export const presetGiftCount = (preset: GiftPresetBody) => preset.groups.reduce((sum, group) => sum + group.gifts.length, 0)

/**
 * The preset with the gift in `group`, before the gift `before` or at the end; it leaves the group it was in.
 * The same preset comes back when nothing can change: no such group, or a new gift for a preset that is full.
 */
export function placeGift<T extends GiftPresetBody>(preset: T, key: string, group: number, before: string | null = null): T {
  if (!preset.groups[group] || before === key) return preset
  const held = preset.groups.some(item => item.gifts.includes(key))
  if (!held && presetGiftCount(preset) >= GIFT_PRESET_GIFT_LIMIT) return preset
  const groups = preset.groups.map(item => ({ ...item, gifts: item.gifts.filter(other => other !== key) }))
  const gifts = groups[group].gifts
  const at = before === null ? -1 : gifts.indexOf(before)
  gifts.splice(at < 0 ? gifts.length : at, 0, key)
  return { ...preset, groups }
}

export const removeGift = <T extends GiftPresetBody>(preset: T, key: string): T =>
  ({ ...preset, groups: preset.groups.map(group => ({ ...group, gifts: group.gifts.filter(other => other !== key) })) })

/** A press on a catalog gift: into the chosen group, or out of it when it was already there. */
export const toggleGift = <T extends GiftPresetBody>(preset: T, key: string, group: number): T =>
  preset.groups[group]?.gifts.includes(key) ? removeGift(preset, key) : placeGift(preset, key, group)

export const addGroup = <T extends GiftPresetBody>(preset: T): T =>
  preset.groups.length >= GIFT_PRESET_GROUP_LIMIT ? preset : { ...preset, groups: [...preset.groups, emptyGroup()] }

/** Without the group and its gifts; a preset keeps at least one (empty) group. */
export function removeGroup<T extends GiftPresetBody>(preset: T, index: number): T {
  const groups = preset.groups.filter((_, i) => i !== index)
  return { ...preset, groups: groups.length ? groups : [emptyGroup()] }
}

const SLOT_ID = /^s([1-5])$/
/** The account slot (1–5) a preset is stored in, from its id. */
export const presetSlot = (id: string) => { const slot = SLOT_ID.exec(id); return slot ? Number(slot[1]) : null }

/** The id for one more preset (the first free slot), or null at five or more: only making a new one is refused. */
export function nextPresetId(list: readonly Pick<GiftPreset, 'id'>[]): string | null {
  if (list.length >= GIFT_PRESET_LIMIT) return null
  for (let slot = 1; slot <= GIFT_PRESET_LIMIT; slot++) if (!list.some(preset => preset.id === `s${slot}`)) return `s${slot}`
  return null
}

/**
 * The presets with one more, which becomes the chosen one; null at five or more. `body` is a preset read from a share
 * code: it keeps its own name unless it has none. Account presets stay in slot order.
 */
export function createPreset(presets: GiftPresets, name: string, body?: GiftPresetBody): GiftPresets | null {
  const id = nextPresetId(presets.list)
  if (id === null) return null
  const made = normalizePresetBody(body ?? { name })
  const list = [...presets.list, { id, name: made.name || name, groups: made.groups }]
  return { active: id, list: list.sort((a, b) => (presetSlot(a.id) ?? 0) - (presetSlot(b.id) ?? 0)) }
}

export const deletePreset = (presets: GiftPresets, id: string): GiftPresets =>
  ({ active: presets.active === id ? null : presets.active, list: presets.list.filter(preset => preset.id !== id) })

/** Each group with its gifts in the order they were placed; keys the catalog no longer has are skipped. */
export function presetSections(preset: GiftPresetBody, gifts: EgoGift[]): { name: string; memo: string; gifts: EgoGift[] }[] {
  const byKey = new Map(gifts.map(gift => [giftCheckKey(gift), gift]))
  return preset.groups.map(group => ({ name: group.name, memo: group.memo, gifts: group.gifts.flatMap(key => byKey.get(key) ?? []) }))
}

/** Rows of the account API as presets, by slot. */
export function presetsFromRows(rows: unknown): GiftPreset[] {
  return (Array.isArray(rows) ? rows : [])
    .filter((row): row is { slot: number } => !!row && Number.isInteger(row.slot) && row.slot >= 1 && row.slot <= GIFT_PRESET_LIMIT)
    .sort((a, b) => a.slot - b.slot)
    .map(row => ({ id: `s${row.slot}`, ...normalizePresetBody(row) }))
}

/** The browser's presets as a new account's: the first five, in slots 1–5, within the limits. */
export function accountPresets(presets: GiftPresets): GiftPresets {
  const list = presets.list.slice(0, GIFT_PRESET_LIMIT).map((preset, index) => ({ id: `s${index + 1}`, ...normalizePresetBody(preset) }))
  return { active: list[presets.list.findIndex(preset => preset.id === presets.active)]?.id ?? null, list }
}

/** The PUT body that stores a preset in its slot; null for a preset without a slot. */
export function presetRequest(preset: GiftPreset): string | null {
  const slot = presetSlot(preset.id)
  return slot === null ? null : JSON.stringify({ slot, name: preset.name, groups: preset.groups.map(({ name, gifts, memo }) => ({ name, gifts, memo })) })
}

/** What to send so the account matches `list`: `synced` is the request body last stored for each slot. */
export function presetSyncPlan(synced: ReadonlyMap<number, string>, list: readonly GiftPreset[]) {
  const puts: { slot: number; body: string }[] = []
  const kept = new Set<number>()
  for (const preset of list) {
    const slot = presetSlot(preset.id)
    const body = presetRequest(preset)
    if (slot === null || body === null) continue
    kept.add(slot)
    if (synced.get(slot) !== body) puts.push({ slot, body })
  }
  return { puts, deletes: [...synced.keys()].filter(slot => !kept.has(slot)) }
}

/** Saved final-gift selections: the user-picked final_<id>[_plus|_plusplus] keys only, never the auto start/observe gifts. */
export interface FinalPreset { slot: number; name: string; giftKeys: string[]; updatedAt: string }

export const PRESET_COOKIE = 'md_final_presets'
export const GUEST_SLOTS = 5
export const USER_SLOTS = 10
export const MAX_PRESET_GIFTS = 60
export const MAX_PRESET_NAME = 40
const MAX_COOKIE_VALUE = 3500
const FINAL_KEY = /^final_(\d{1,6})(_plus|_plusplus)?$/
const COMPACT_ID = /^(\d{1,6})(\+{0,2})$/

export const isFinalGiftKey = (key: string) => FINAL_KEY.test(key)
export const pickedFinalKeys = (inventory: readonly string[]) => inventory.filter(isFinalGiftKey)

/** final_9250, final_9273_plus, final_9301_plusplus ⇄ "9250,9273+,9301++" */
export function compactFinalKeys(keys: readonly string[]): string {
  return keys.flatMap(key => {
    const match = FINAL_KEY.exec(key)
    return match ? [match[1] + (match[2] === '_plusplus' ? '++' : match[2] ? '+' : '')] : []
  }).join(',')
}

export function expandFinalKeys(value: string): string[] {
  return value.split(',').flatMap(part => {
    const match = COMPACT_ID.exec(part.trim())
    return match ? [`final_${match[1]}${match[2] === '++' ? '_plusplus' : match[2] ? '_plus' : ''}`] : []
  })
}

/** Cookie value for guest presets; throws 'too_large' rather than silently dropping gifts. */
export function encodePresetCookie(presets: readonly FinalPreset[]): string {
  const value = encodeURIComponent(JSON.stringify(presets.map(p => ({ s: p.slot, n: p.name, g: compactFinalKeys(p.giftKeys), t: p.updatedAt }))))
  if (value.length > MAX_COOKIE_VALUE) throw new Error('too_large')
  return value
}

export function decodePresetCookie(value: string | undefined): FinalPreset[] {
  if (!value) return []
  try {
    const rows: unknown = JSON.parse(decodeURIComponent(value))
    if (!Array.isArray(rows)) return []
    return sortPresets(rows.flatMap(row => {
      const { s, n, g, t } = (row ?? {}) as Record<string, unknown>
      if (!Number.isInteger(s) || (s as number) < 1 || (s as number) > GUEST_SLOTS || typeof n !== 'string' || typeof g !== 'string') return []
      return [{ slot: s as number, name: n.slice(0, MAX_PRESET_NAME), giftKeys: expandFinalKeys(g).slice(0, MAX_PRESET_GIFTS), updatedAt: typeof t === 'string' ? t : '' }]
    }))
  } catch {
    return []
  }
}

const sortPresets = (presets: FinalPreset[]) => presets.sort((a, b) => a.slot - b.slot)

/** Insert or replace one slot. */
export const putPreset = (presets: readonly FinalPreset[], preset: FinalPreset) =>
  sortPresets([...presets.filter(p => p.slot !== preset.slot), preset])

export const dropPreset = (presets: readonly FinalPreset[], slot: number) => presets.filter(p => p.slot !== slot)

/** Inventory edit for loading a preset: remove every current final_ pick, then add the preset's keys. */
export function presetLoadEdit(inventory: readonly string[], giftKeys: readonly string[]) {
  return { remove: pickedFinalKeys(inventory), add: [...new Set(giftKeys.filter(isFinalGiftKey))] }
}

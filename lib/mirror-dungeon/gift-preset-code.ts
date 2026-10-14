import { deflate, inflate } from 'pako'
import { z } from 'zod'
import {
  GIFT_PRESET_GIFT_LIMIT, GIFT_PRESET_GROUP_LIMIT, GIFT_PRESET_MEMO_MAX, GIFT_PRESET_NAME_MAX, normalizePresetBody, type GiftPresetBody,
} from './gift-presets'

const CODE_VERSION = 1
/** The fullest preset (six groups of Korean names and notes, sixty gifts) stays under this. */
const MAX_CODE_LENGTH = 8000
const MAX_JSON_LENGTH = 20000

/** A preset as the account API and a share code accept it: within every limit, each gift once. */
export const giftPresetBodySchema = z.object({
  name: z.string().max(GIFT_PRESET_NAME_MAX),
  groups: z.array(z.object({
    name: z.string().max(GIFT_PRESET_NAME_MAX),
    // giftCheckKey: a game id, or a row id for a gift without one.
    gifts: z.array(z.string().regex(/^[\w-]{1,40}$/)).max(GIFT_PRESET_GIFT_LIMIT),
    memo: z.string().max(GIFT_PRESET_MEMO_MAX),
  })).min(1).max(GIFT_PRESET_GROUP_LIMIT),
}).refine(body => {
  const keys = body.groups.flatMap(group => group.gifts)
  return keys.length <= GIFT_PRESET_GIFT_LIMIT && new Set(keys).size === keys.length
})

/** The preset as a string to hand to someone else: versioned short-key JSON, deflated, base64url. */
export function encodePresetCode(preset: GiftPresetBody): string {
  const { name, groups } = normalizePresetBody(preset)
  const json = JSON.stringify({ v: CODE_VERSION, n: name, g: groups.map(group => [group.name, group.memo, group.gifts]) })
  return btoa(String.fromCharCode(...deflate(json))).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '')
}

/** The preset a code holds, or null when the code is broken, too long, from another version or outside the limits. */
export function decodePresetCode(code: string): GiftPresetBody | null {
  const value = code.trim()
  if (!value || value.length > MAX_CODE_LENGTH || !/^[\w-]+$/.test(value)) return null
  try {
    const json = inflate(Uint8Array.from(atob(value.replaceAll('-', '+').replaceAll('_', '/')), char => char.charCodeAt(0)), { to: 'string' })
    if (json.length > MAX_JSON_LENGTH) return null
    const raw = JSON.parse(json) as { v?: unknown; n?: unknown; g?: unknown }
    if (raw?.v !== CODE_VERSION || !Array.isArray(raw.g)) return null
    const parsed = giftPresetBodySchema.safeParse({
      name: raw.n,
      groups: raw.g.map(group => Array.isArray(group) ? { name: group[0], memo: group[1], gifts: group[2] } : group),
    })
    return parsed.success ? parsed.data : null
  } catch {
    return null
  }
}

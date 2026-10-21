import { LCB_IDS, SINNER_SLUGS } from '@/lib/constants/game'
import { getIdentityPortraitUrl } from '@/lib/utils/images'
import type { GameTextRefNames } from '@/lib/db/game-text-refs'

/** Where the skill motion videos, their layer metadata and `index.json` live (Cloudflare R2, read directly by the browser). */
export const MOTION_ASSET_BASE = 'https://assets.saigo-no-dante.com/'

/** One row of `index.json`: one state of one skill of one identity (one video). */
export type MotionEntry = {
  slug: string
  skillId: number
  state: string
  identity: string
  name: string
  layers: number
  audio: boolean
  frames: number
  fps: number
  bytes?: number
  video: string
  meta: string
  /** The game id of the identity (five digits); the slug is `id<identityId>`, with a suffix for another form. */
  identityId?: string
  /** The state's button text, as the extractor writes it (기본, 최고 상태, a condition), and in English and Japanese. */
  label?: string
  labelEn?: string
  labelJa?: string
  /** The state as keys the site writes in the page language: `[Keyword] stack` and `<i:identity id>`, joined by ` + `. */
  labelKey?: string
  /** A link state (`v:link-<id>`): the identities taking part, the skills it chains, and whether it is the max video. */
  members?: string[]
  linkSkillIds?: number[]
  linkMax?: boolean
  /** Skill names in English and Japanese, for a skill the site has no row for. */
  nameEn?: string
  nameJa?: string
}

/** One video of a skill as the page needs it (frame count, fps and sound are read from its layers.json when it loads). */
export type MotionState = Pick<MotionEntry, 'state' | 'name' | 'video' | 'meta'> & { label: string; bytes: number }
/** `form`: the identity's other form the skill belongs to (`castoff` of `id10215-castoff`), null for its own skills. */
export type MotionSkill = { key: string; skillId: number; title: string; form: string | null; states: MotionState[] }
/** `released`: the release date of the identity the skills belong to, for the list's order (null when the site has no row). */
export type MotionIdentity = { slug: string; label: string; identityId: string | null; gameId: string | null; portrait: string | null; released: string | null; skills: MotionSkill[] }
export type MotionSinner = { id: string; identities: MotionIdentity[] }
/** What the catalog needs of a site identity, its name (and its sinner's) already in the page's language. */
export type MotionIdentityInfo = { id: string; name: string; sinner_id: string; sinner_name?: string; game_id: string | null; folder_name: string | null; rarity?: number | null; release_date?: string | null }

// R2 folders (and link slugs) spell the sinners without hyphens.
const R2_SINNERS: Record<string, string> = Object.fromEntries(SINNER_SLUGS.map(id => [id.replace(/-/g, ''), id]))

/**
 * The site's sinner id of an entry: its folder; for a link (`links/…`) the sinner its slug ends with, else the sinner
 * whose identities' game ids start like the skill id (1041206 → 104… → Ryōshū).
 */
export function motionSinnerId(entry: Pick<MotionEntry, 'slug' | 'video' | 'skillId'>): string | null {
  const folder = entry.video.split('/')[0]
  if (R2_SINNERS[folder]) return R2_SINNERS[folder]
  const tail = entry.slug.split('-').at(-1) ?? ''
  if (R2_SINNERS[tail]) return R2_SINNERS[tail]
  return Object.entries(LCB_IDS).find(([, gameId]) => String(entry.skillId).startsWith(gameId.slice(0, 3)))?.[0] ?? null
}

const pick = (lang: string, ko: string, en: string, ja: string) => lang === 'en' ? en : lang === 'ja' ? ja : ko
const isBase = (state: string) => state === 'base' || state === 'v:base'
const isTop = (state: string) => state === 'max' || /^v:best/.test(state)
const stateRank = (state: string) => isBase(state) ? 0 : isTop(state) ? 2 : 1

// The fixed labels of the index in the other page languages (as the index writes them); a condition stays as written.
const FIXED_LABELS: Record<string, [en: string, ja: string]> = { '기본': ['Base', '基本'], '최고 상태': ['Best State', '最高状態'], '최대 상태': ['Max State', '最大状態'] }

/**
 * A `labelKey` in the page language: `[Keyword] stack` from the site's keyword table (game_text_refs), `<i:id>` an
 * identity's name, parts joined by ` + `. Null when a part cannot be resolved or holds the index's word tokens
 * (`<count>`, `<up>`, `<coin:1>`…): the index writes those sentences itself (label, labelEn, labelJa), and the caller
 * uses them.
 */
export function formatMotionLabelKey(key: string, refs: GameTextRefNames | null | undefined, identityName: (gameId: string) => string | undefined): string | null {
  const parts = key.split(' + ').map(part => {
    const identity = /^<i:(\d+)>$/.exec(part.trim())
    if (identity) return identityName(identity[1]) ?? null
    // A stack is a number or a range (10~19, 50%); a word token (<stage:2>, <up>…) leaves the key to the label sentence.
    const keyword = /^\[([^\]]+)\](?:\s+([\d.~%-]+))?$/.exec(part.trim())
    const name = keyword ? refs?.[keyword[1]]?.n : undefined
    return name ? (keyword![2] ? `${name} ${keyword![2]}` : name) : null
  })
  return parts.every(Boolean) ? parts.join(' + ') : null
}

/** What a state's labelKey needs: the keyword names and the identity names, both in the page language. */
export type MotionLabelContext = { refs?: GameTextRefNames | null; identityName?: (gameId: string) => string | undefined }

/**
 * A state's button text: its `labelKey` written in the page language (a link as "연계: identity", its max video with
 * "(최대 상태)"); else the index's label of the page language (a name's brackets cannot be cut reliably), the fixed
 * labels translated; an entry without any: 기본 / 최대 상태 / the brackets at the end of the name.
 */
export function motionStateLabel(entry: Pick<MotionEntry, 'state' | 'name' | 'label' | 'labelEn' | 'labelJa' | 'labelKey' | 'linkMax'>, lang: string, context: MotionLabelContext = {}): string {
  const keyed = entry.labelKey ? formatMotionLabelKey(entry.labelKey, context.refs, context.identityName ?? (() => undefined)) : null
  if (keyed) {
    if (!entry.labelKey!.includes('<i:')) return keyed
    return `${pick(lang, '연계', 'Link', '連携')}: ${keyed}${entry.linkMax ? ` (${pick(lang, '최대 상태', 'Max State', '最大状態')})` : ''}`
  }
  const own = (lang === 'en' ? entry.labelEn : lang === 'ja' ? entry.labelJa : undefined)?.trim()
  if (own) return own
  const label = entry.label?.trim()
  if (label) {
    const fixed = FIXED_LABELS[label]
    return fixed ? pick(lang, label, ...fixed) : label
  }
  if (isBase(entry.state)) return pick(lang, '기본', 'Base', '基本')
  if (entry.state === 'max') return pick(lang, '최대 상태', 'Max State', '最大状態')
  return /\[([^\]]+)\]$/.exec(entry.name)?.[1] ?? entry.state.replace(/^v:/, '')
}

/** The state a skill opens on: its best (or max) state when it has one, else base, else the first. */
export function defaultMotionState(skill: Pick<MotionSkill, 'states'>): string {
  return (skill.states.find(s => isTop(s.state)) ?? skill.states.find(s => isBase(s.state)) ?? skill.states[0])?.state ?? ''
}

/** A file on the R2 host; its size in the query makes a browser that cached an older render fetch it again. */
export function motionAssetUrl(path: string, bytes: number | undefined): string {
  return MOTION_ASSET_BASE + path + (bytes ? `?v=${bytes}` : '')
}

// On one release date: the game's own identity, then entries of an older index (LCB, 흑수, 홍원 slugs), then old links.
const slugRank = (slug: string) => slug.startsWith('id') ? 0 : slug.startsWith('lcb-') ? 1 : slug.startsWith('link-') ? 3 : 2

/** The site data the catalog names things with, in the page language: skill names by skill id and the keyword table. */
export type MotionCatalogNames = { skillNames?: ReadonlyMap<number, string>; refs?: GameTextRefNames | null }

/**
 * The R2 index as sinners → identities → skills → states, in the order the page lists them. A skill is its slug plus
 * skill id (a form shares skill ids with the identity it comes from). Identities and skills are named from the site data
 * by id, in the page language (`identityId`, else the slug's game id; the skill id); the index's Korean `identity` and
 * `name` are only a fallback for what the site has no row for. A link is a state of the skill it belongs to; state
 * labels come from `labelKey` (motionStateLabel). Another form of an identity (`id<game id>-<form>`) is listed under it,
 * after its own skills.
 */
export function buildMotionCatalog(entries: readonly MotionEntry[], identities: ReadonlyMap<string, MotionIdentityInfo>, lang: string, names: MotionCatalogNames = {}): MotionSinner[] {
  const skillNames = names.skillNames ?? new Map<number, string>()
  // A link names its identity with the sinner: 흑수 - 묘 is both Ryōshū's and Outis's.
  const labelContext: MotionLabelContext = { refs: names.refs, identityName: id => { const info = identities.get(id); return info && (info.sinner_name ? `${info.name} ${info.sinner_name}` : info.name) } }
  const sinners = new Map<string, Map<string, MotionIdentity>>()
  for (const entry of entries) {
    const sinnerId = motionSinnerId(entry)
    if (!sinnerId) continue
    const bySlug = sinners.get(sinnerId) ?? sinners.set(sinnerId, new Map()).get(sinnerId)!
    const [, gameId = null, form = null] = /^id(\d{5})(?:-(.+))?$/.exec(entry.slug) ?? []
    const slug = gameId ? `id${gameId}` : entry.slug
    let identity = bySlug.get(slug)
    if (!identity) {
      const ownId = entry.identityId ?? gameId
      const own = ownId ? identities.get(ownId) : undefined
      const art = own ?? identities.get(String(entry.skillId).slice(0, 5))
      identity = {
        slug,
        label: own?.name ?? entry.identity,
        identityId: own?.id ?? null,
        gameId: own?.game_id ?? gameId,
        portrait: art?.folder_name && art.game_id ? getIdentityPortraitUrl(art.sinner_id, art.folder_name, art.game_id, false) : null,
        released: art?.release_date ?? null,
        skills: [],
      }
      bySlug.set(slug, identity)
    }
    const key = `${entry.slug}|${entry.skillId}`
    const title = skillNames.get(entry.skillId) || (lang === 'en' ? entry.nameEn : lang === 'ja' ? entry.nameJa : undefined)?.trim() || entry.name.replace(/ \[[^\]]+\]$/, '')
    let skill = identity.skills.find(s => s.key === key)
    if (!skill) identity.skills.push(skill = { key, skillId: entry.skillId, title, form, states: [] })
    if (isBase(entry.state)) skill.title = title
    skill.states.push({
      state: entry.state, label: motionStateLabel(entry, lang, labelContext), name: entry.name, video: entry.video, meta: entry.meta, bytes: entry.bytes ?? 0,
    })
  }
  return SINNER_SLUGS.flatMap(id => {
    const bySlug = sinners.get(id)
    if (!bySlug) return []
    const list = [...bySlug.values()]
    for (const identity of list) {
      identity.skills.sort((a, b) => (a.form ?? '').localeCompare(b.form ?? '') || a.skillId - b.skillId)
      for (const skill of identity.skills) skill.states.sort((a, b) => stateRank(a.state) - stateRank(b.state) || a.state.localeCompare(b.state))
    }
    // Newest release first, like the site's identity lists; one the site has no row for yet is the newest.
    const released = (identity: MotionIdentity) => identity.released ?? '9999'
    list.sort((a, b) => released(b).localeCompare(released(a)) || slugRank(a.slug) - slugRank(b.slug) || (b.gameId ?? '').localeCompare(a.gameId ?? '') || a.slug.localeCompare(b.slug))
    return [{ id, identities: list }]
  })
}

import { LCB_IDS, SINNER_SLUGS } from '@/lib/constants/game'
import { getIdentityPortraitUrl } from '@/lib/utils/images'

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
}

/** One video of a skill as the page needs it (frame count, fps and sound are read from its layers.json when it loads). */
export type MotionState = Pick<MotionEntry, 'state' | 'name' | 'video' | 'meta'> & { label: string; bytes: number }
export type MotionSkill = { key: string; skillId: number; title: string; states: MotionState[] }
export type MotionIdentity = { slug: string; label: string; identityId: string | null; gameId: string | null; portrait: string | null; skills: MotionSkill[] }
export type MotionSinner = { id: string; identities: MotionIdentity[] }
/** What the catalog needs of a site identity, its name already in the page's language. */
export type MotionIdentityInfo = { id: string; name: string; sinner_id: string; game_id: string | null; folder_name: string | null; rarity?: number | null }

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

/** 기본 / 최대 상태 / the condition named in the brackets at the end of the skill name. */
export function motionStateLabel(entry: Pick<MotionEntry, 'state' | 'name'>, lang: string): string {
  if (isBase(entry.state)) return pick(lang, '기본', 'Base', '基本')
  if (entry.state === 'max') return pick(lang, '최대 상태', 'Max', '最大状態')
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

// Identities: the game's own first (newest first), then LCB, the grouped forms (흑수, 홍원) and the links last.
const slugRank = (slug: string) => slug.startsWith('id') ? 0 : slug.startsWith('lcb-') ? 1 : slug.startsWith('link-') ? 3 : 2

/**
 * The R2 index as sinners → identities → skills → states, in the order the page lists them. A skill is its slug plus
 * skill id (a link, an LCB entry or a form shares skill ids with the identity it comes from). An identity whose slug is
 * `id<game id>` is named and drawn from the site data; the others keep the index's name and borrow the portrait of the
 * identity their skill id belongs to (its first five digits).
 */
export function buildMotionCatalog(entries: readonly MotionEntry[], identities: ReadonlyMap<string, MotionIdentityInfo>, lang: string): MotionSinner[] {
  const sinners = new Map<string, Map<string, MotionIdentity>>()
  for (const entry of entries) {
    const sinnerId = motionSinnerId(entry)
    if (!sinnerId) continue
    const bySlug = sinners.get(sinnerId) ?? sinners.set(sinnerId, new Map()).get(sinnerId)!
    let identity = bySlug.get(entry.slug)
    if (!identity) {
      const gameId = /^id(\d{5})$/.exec(entry.slug)?.[1] ?? null
      const own = gameId ? identities.get(gameId) : undefined
      const art = own ?? identities.get(String(entry.skillId).slice(0, 5))
      identity = {
        slug: entry.slug,
        label: own?.name ?? entry.identity,
        identityId: own?.id ?? null,
        gameId: own?.game_id ?? gameId,
        portrait: art?.folder_name && art.game_id ? getIdentityPortraitUrl(art.sinner_id, art.folder_name, art.game_id, false) : null,
        skills: [],
      }
      bySlug.set(entry.slug, identity)
    }
    const key = `${entry.slug}|${entry.skillId}`
    let skill = identity.skills.find(s => s.key === key)
    if (!skill) identity.skills.push(skill = { key, skillId: entry.skillId, title: entry.name.replace(/ \[[^\]]+\]$/, ''), states: [] })
    if (isBase(entry.state)) skill.title = entry.name.replace(/ \[[^\]]+\]$/, '')
    skill.states.push({
      state: entry.state, label: motionStateLabel(entry, lang), name: entry.name, video: entry.video, meta: entry.meta, bytes: entry.bytes ?? 0,
    })
  }
  return SINNER_SLUGS.flatMap(id => {
    const bySlug = sinners.get(id)
    if (!bySlug) return []
    const list = [...bySlug.values()]
    for (const identity of list) {
      identity.skills.sort((a, b) => a.skillId - b.skillId)
      for (const skill of identity.skills) skill.states.sort((a, b) => stateRank(a.state) - stateRank(b.state) || a.state.localeCompare(b.state))
    }
    list.sort((a, b) => slugRank(a.slug) - slugRank(b.slug) || (b.gameId ?? '').localeCompare(a.gameId ?? '') || a.slug.localeCompare(b.slug))
    return [{ id, identities: list }]
  })
}

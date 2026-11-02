import { SINNER_SLUGS } from '@/lib/constants/game'
import { getKeywordIconUrl } from '@/lib/constants/keywords'
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
  /** The buffs this video was recorded with. */
  conditions?: { keyword: string; stack?: number; target?: boolean }[]
  /** 공간참 - 잔 (id10415 · 1041507): the 거미집 아비 dead in this state (`v:dead-<id>[+dead-<id>…]`), in the game's order. */
  deadAllies?: string[]
  /** Skill names in English and Japanese, for a skill the site has no row for. */
  nameEn?: string
  nameJa?: string
  /** An E.G.O video: `egoId` is its game id, `sinner` its sinner folder, `grade` ZAYIN…ALEPH; `erode` the erosion skill (else the awakening one). Not an identity: no `id\d{5}` slug. */
  ego?: boolean
  egoId?: number
  sinner?: string
  grade?: string
  erode?: boolean
}

/** An identity a state names: a link partner, a dead 아비. */
export type MotionPartner = { gameId: string; name: string; sinner: string | null; portrait: string | null }
/** A link state: every member that is not the skill's owner, the link's id (their ids joined by +) and whether it is the max video. */
export type MotionLink = { id: string; partners: MotionPartner[]; max: boolean }
/**
 * One video of a skill as the page needs it (frame count, fps and sound are read from its layers.json when it loads).
 * `dead`: the 아비 dead in a 공간참 - 잔 state.
 */
/** A buff a video was recorded with, written from the site's keyword table. */
export type MotionCondition = { name: string; icon: string | null; stack: string | null }
export type MotionState = Pick<MotionEntry, 'state' | 'name' | 'video' | 'meta'> & { label: string; bytes: number; link?: MotionLink; dead?: MotionPartner[]; conditions?: MotionCondition[]; ally?: MotionPartner; /** What the labelKey says besides the conditions, in the page language. */ extras?: string[] }
/**
 * The game frame a skill's sprite sits in: its sin, its slot (1–3, 4 for a defense) and its attack type badge. `sprite`: the
 * sprite id when the skill is saved under another identity's (see borrowedRows), else the skill id is the sprite's.
 */
export type MotionSkillFrame = { sin: string; slot: number; attack: 'slash' | 'pierce' | 'blunt' | null; sprite?: number }
/**
 * `form`: the identity's other form the skill belongs to (`castoff` of `id10215-castoff`), null for its own skills.
 * `frame`: from the site's row of the skill, null when the site has none.
 */
export type MotionSkill = { key: string; skillId: number; title: string; form: string | null; states: MotionState[]; frame?: MotionSkillFrame | null; erode?: boolean }
/**
 * `released`: the release date of the identity the skills belong to, for the list's order (null when the site has no row).
 * `pending`: a new identity the site has but the index has no motion for yet (no skills).
 */
export type MotionIdentity = { slug: string; label: string; identityId: string | null; gameId: string | null; portrait: string | null; rarity: number | null; folderName: string | null; released: string | null; skills: MotionSkill[]; pending?: boolean }
/** An E.G.O of a sinner: named and pictured from the site's row (by game id), its skills awakening first, then erosion. `sin`: the site's sin affinity. */
export type MotionEgo = { egoId: number; grade: string; label: string; image: string | null; sin: string | null; skills: MotionSkill[] }
export type MotionSinner = { id: string; identities: MotionIdentity[]; egos: MotionEgo[] }
/** The owner of a skill: an identity or an E.G.O (both have `label`). */
export type MotionOwner = MotionIdentity | MotionEgo
export const isMotionEgo = (owner: MotionOwner): owner is MotionEgo => 'egoId' in owner
/** What the catalog needs of a site E.G.O, its name in the page language. */
export type MotionEgoInfo = { game_id: string; name: string; image_url: string | null; grade: string; sinner_id: string; sin_affinity: string | null }
/** What the catalog needs of a site identity, its name (and its sinner's) already in the page's language. */
export type MotionIdentityInfo = { id: string; name: string; sinner_id: string; sinner_name?: string; game_id: string | null; folder_name: string | null; rarity?: number | null; release_date?: string | null }

// R2 folders (and link slugs) spell the sinners without hyphens.
const R2_SINNERS: Record<string, string> = Object.fromEntries(SINNER_SLUGS.map(id => [id.replace(/-/g, ''), id]))

/** The site's sinner id of an entry: its folder (`<sinner>/<identity>/…`, `<sinner>/ego/…`). */
export function motionSinnerId(entry: Pick<MotionEntry, 'video'>): string | null {
  return R2_SINNERS[entry.video.split('/')[0]] ?? null
}

const pick = (lang: string, ko: string, en: string, ja: string) => lang === 'en' ? en : lang === 'ja' ? ja : ko
// The order the index asks for: 기본, the conditions, the best states.
export const isBase = (state: string) => state === 'v:base'
export const isTop = (state: string) => /^v:best/.test(state)
const stateRank = (state: string) => isBase(state) ? 0 : isTop(state) ? 2 : 1

// The index's word tokens in a labelKey, in the page language.
const LABEL_WORDS: Record<string, [ko: string, en: string, ja: string]> = {
  ally: ['아군', 'Ally', '味方'], break: ['흐트러짐', 'Stagger', '混乱'], coin: ['코인', 'Coin', 'コイン'], 'coin:last': ['마지막 코인', 'Last Coin', '最後のコイン'], count: ['횟수', 'Count', '回数'],
  crit: ['치명타', 'Critical Hit', 'クリティカル'], cutin: ['컷인', 'Cut-in', 'カットイン'], dead: ['사망', 'Death', '死亡'], form: ['변신', 'Transformation', '変身'], hp: ['체력', 'HP', 'HP'],
  kill: ['처치', 'Kill', '撃破'], resonance: ['공명', 'Resonance', '共鳴'], reuse: ['재사용', 'Reuse', '再使用'], sp: ['정신력', 'SP', 'SP'], speed: ['속도', 'Speed', '速度'],
  target: ['대상', 'Target', '対象'], under: ['이하', 'or less', '以下'], weight: ['가중치', 'Weight', 'ウェイト'],
}
const labelWord = (token: string, lang: string): string | null => {
  const words = LABEL_WORDS[token]
  if (words) return pick(lang, ...words)
  const [, name, n] = /^([a-z]+):(\d+)$/.exec(token) ?? []
  if (name === 'part') return pick(lang, `${n}부`, `Part ${n}`, `第${n}部`)
  return name && LABEL_WORDS[name] ? `${pick(lang, ...LABEL_WORDS[name])} ${n}` : null
}

/**
 * A `labelKey` in the page language: `[Keyword]` from the site's keyword table (game_text_refs), `<i:id>` an identity's
 * name, the other tokens from LABEL_WORDS; numbers and separators stay as they are. Null when a token cannot be resolved:
 * the caller then uses the index's sentence.
 */
export function formatMotionLabelKey(key: string, refs: GameTextRefNames | null | undefined, identityName: (gameId: string) => string | undefined, lang = 'ko'): string | null {
  let whole = true
  const text = key.replace(/\[([^\]]+)\]|<([^>]+)>/g, (_, keyword: string | undefined, token: string) => {
    const identity = /^i:(\d+)$/.exec(token ?? '')
    const word = keyword ? refs?.[keyword]?.n : identity ? identityName(identity[1]) : labelWord(token, lang)
    if (!word) whole = false
    return word ?? ''
  })
  return whole ? text : null
}

/** The parts of a labelKey the conditions and the faces do not already show, in the page language; a part that cannot be written is left out. */
function labelExtras(entry: Pick<MotionEntry, 'labelKey' | 'conditions'>, refs: GameTextRefNames | null | undefined, identityName: (gameId: string) => string | undefined, lang: string): string[] {
  const shown = new Set(entry.conditions?.map(condition => condition.keyword))
  return (entry.labelKey ?? '').split(/\s[+·]\s/).flatMap(part => {
    if (part.includes('<i:') || [...part.matchAll(/\[([^\]]+)\]/g)].some(m => shown.has(m[1]))) return []
    const text = formatMotionLabelKey(part, refs, identityName, lang)
    return text ? [text] : []
  })
}

/** What a state's labelKey needs: the keyword names and the identity names, both in the page language. */
export type MotionLabelContext = { refs?: GameTextRefNames | null; identityName?: (gameId: string) => string | undefined }

/**
 * A state's button text: its `labelKey` written in the page language (a link as "연계: identity", its max video with
 * "(최대 상태)"); else the index's label of the page language, else its Korean label. Never made from the state name or
 * the name's brackets (the index renames states; a skill name can hold brackets).
 */
export function motionStateLabel(entry: Pick<MotionEntry, 'state' | 'name' | 'label' | 'labelEn' | 'labelJa' | 'labelKey' | 'linkMax'>, lang: string, context: MotionLabelContext = {}): string {
  const keyed = entry.labelKey ? formatMotionLabelKey(entry.labelKey, context.refs, context.identityName ?? (() => undefined), lang) : null
  if (keyed) {
    if (!entry.state.startsWith('v:link')) return keyed
    return `${pick(lang, '연계', 'Link', '連携')}: ${keyed}${entry.linkMax ? ` (${pick(lang, '최대 상태', 'Max State', '最大状態')})` : ''}`
  }
  const own = (lang === 'en' ? entry.labelEn : lang === 'ja' ? entry.labelJa : undefined)?.trim()
  if (own) return own
  return entry.label?.trim() || entry.state
}

/** The state a skill opens on: its best state, else base, else the first. */
export function defaultMotionState(skill: Pick<MotionSkill, 'states'>): string {
  return (skill.states.find(s => isTop(s.state)) ?? skill.states.find(s => isBase(s.state)) ?? skill.states[0])?.state ?? ''
}

// The address names a skill as "<slug>~<skill id>" ("|" of the internal key reads badly in a URL).
export const toMotionParam = (key: string) => key.replace('|', '~')
export const fromMotionParam = (param: string) => param.replace('~', '|')

/** The skill an address names (`?skill=`), with its sinner and its owner (identity or E.G.O); none for an unknown or pending one. */
export function findMotionSkill(sinners: readonly MotionSinner[], param: string): { sinnerId: string; owner: MotionOwner; skill: MotionSkill } | null {
  const key = fromMotionParam(param)
  for (const sinner of sinners) for (const owner of [...sinner.identities, ...sinner.egos]) for (const skill of owner.skills) if (skill.key === key) return { sinnerId: sinner.id, owner, skill }
  return null
}

/** The words of the chapter names in the page language; `{n}` in `coin` and `part` is the number. */
export type MotionChapterWords = { skill: string; form: string; cutin: string; coin: string; reuse: string; part: string; weight: string; sp: string; resonance: string; dead: string; break: string }

/**
 * A chapter's name on the seek bar, from its token: `<s:id>` that skill's name (a cut-in runs an ally's skill), `<coin:N>`, `<part:N>`, `<form>`, `<cutin>`,
 * `<weight>`, `<sp>`, `<resonance>`, `<dead>`, `<break>` from the words. A token it does not know takes the general name
 * of the chapter's kind.
 */
export function motionChapterLabel(chapter: { kind: string; key: string }, words: MotionChapterWords, skillName?: (skillId: number) => string | undefined): string {
  const [, name = '', n = ''] = /^<([a-z]+)(?::(\d+))?>$/.exec(chapter.key) ?? []
  const word = name === 's' ? skillName?.(Number(n)) || words.skill : name in words ? words[name as keyof MotionChapterWords] : words[chapter.kind as keyof MotionChapterWords] ?? chapter.key
  return word.replace('{n}', n).trim()
}

/** The ally a cut-in video runs a skill of: the first chapter's skill that is not the owner's, as an identity game id. */
export function cutinAllyId(chapters: readonly { key: string }[] | undefined, ownerGameId: string | null): string | null {
  const skill = chapters?.map(chapter => /^<s:(\d{7})>$/.exec(chapter.key)?.[1]).find(id => id && !id.startsWith(ownerGameId ?? ' '))
  return skill?.slice(0, 5) ?? null
}

/** The video of a link at the chosen max (its other video when the index has only one). */
export function pickLinkState(states: readonly MotionState[], id: string, max: boolean): MotionState | undefined {
  const own = states.filter(s => s.link?.id === id)
  return own.find(s => s.link!.max === max) ?? own[0]
}

/**
 * A file on the R2 host at its plain path. A re-upload purges that address from the Cloudflare cache and the files are
 * stored no-cache, so browsers revalidate; a query string would keep an old render cached where the purge cannot reach.
 */
export function motionAssetUrl(path: string): string {
  return MOTION_ASSET_BASE + path
}

// On one release date: the game's own identity, then entries of an older index (LCB, 흑수, 홍원 slugs), then old links.
const slugRank = (slug: string) => slug.startsWith('id') ? 0 : slug.startsWith('lcb-') ? 1 : slug.startsWith('link-') ? 3 : 2

/**
 * The site data the catalog names things with, in the page language: skill names and frames by skill id, the keyword table.
 * `now`: lists the identities released in the last MOTION_PENDING_DAYS that have no motion yet as pending.
 */
export type MotionCatalogNames = { skillNames?: ReadonlyMap<number, string>; skillFrames?: ReadonlyMap<number, MotionSkillFrame>; skillBorrowed?: ReadonlyMap<string, { name?: string; frame: MotionSkillFrame }>; egos?: ReadonlyMap<string, MotionEgoInfo>; refs?: GameTextRefNames | null; now?: Date }

/**
 * What the site adds to the R2 index, by id: identities (by game id), skill names and sprite frames, game text names. It
 * comes from the site's database and is cached; the index is read from R2 on every page open (MOTION_INDEX_URL).
 */
export type MotionSiteData = { identities: MotionIdentityInfo[]; egos: MotionEgoInfo[]; skillNames: [number, string][]; skillFrames: [number, MotionSkillFrame][]; skillBorrowed?: [string, { name?: string; frame: MotionSkillFrame }][]; refs: GameTextRefNames | null }

/** The R2 index: the browser reads it on every page open (Cloudflare keeps no copy of it), so a new video shows at once. */
export const MOTION_INDEX_URL = `${MOTION_ASSET_BASE}index.json`

/** The motion list from the R2 index and the site's data, in the browser or on the server. */
export function motionCatalogFrom(entries: readonly MotionEntry[], site: MotionSiteData, lang: string, now: Date): MotionSinner[] {
  const identities = new Map(site.identities.flatMap(identity => identity.game_id ? [[identity.game_id, identity] as const] : []))
  return buildMotionCatalog(entries, identities, lang, { skillNames: new Map(site.skillNames), skillFrames: new Map(site.skillFrames), skillBorrowed: new Map(site.skillBorrowed ?? []), egos: new Map((site.egos ?? []).map(ego => [ego.game_id, ego])), refs: site.refs, now })
}

/** How long a new identity without motion is listed as pending: recording and building one takes 5 days to 2 weeks. */
export const MOTION_PENDING_DAYS = 30

/**
 * The R2 index as sinners → identities → skills → states, in the order the page lists them. A skill is its slug plus
 * skill id (a form shares skill ids with the identity it comes from). Identities and skills are named from the site data
 * by id, in the page language (`identityId`, else the slug's game id; the skill id); the index's Korean `identity` and
 * `name` are only a fallback for what the site has no row for. A link is a state of the skill it belongs to; state
 * labels come from `labelKey` (motionStateLabel). Another form of an identity (`id<game id>-<form>`) is listed under it,
 * after its own skills. An E.G.O entry (`ego`) is no identity: it goes to its sinner's `egos`, one per `egoId`, named and
 * pictured from the site's row by that game id.
 */
export function buildMotionCatalog(entries: readonly MotionEntry[], identities: ReadonlyMap<string, MotionIdentityInfo>, lang: string, names: MotionCatalogNames = {}): MotionSinner[] {
  const skillNames = names.skillNames ?? new Map<number, string>()
  // A link names its identity with the sinner: 흑수 - 묘 is both Ryōshū's and Outis's.
  const labelContext: MotionLabelContext = { refs: names.refs, identityName: id => { const info = identities.get(id); return info && (info.sinner_name ? `${info.name} ${info.sinner_name}` : info.name) } }
  const sinners = new Map<string, Map<string, MotionIdentity>>()
  const egos = new Map<string, Map<number, MotionEgo>>()
  const withMotion = new Set<string>()
  for (const entry of entries) {
    const sinnerId = motionSinnerId(entry)
    if (!sinnerId) continue
    const [, gameId = null, form = null] = entry.ego ? [] : /^id(\d{5})(?:-(.+))?$/.exec(entry.slug) ?? []
    let owner: MotionIdentity | MotionEgo
    if (entry.ego && entry.egoId !== undefined) {
      const byId = egos.get(sinnerId) ?? egos.set(sinnerId, new Map()).get(sinnerId)!
      const site = names.egos?.get(String(entry.egoId))
      owner = byId.get(entry.egoId) ?? byId.set(entry.egoId, { egoId: entry.egoId, grade: site?.grade ?? entry.grade ?? '', label: site?.name || entry.identity, image: site?.image_url ?? null, sin: site?.sin_affinity ?? null, skills: [] }).get(entry.egoId)!
    } else {
      const bySlug = sinners.get(sinnerId) ?? sinners.set(sinnerId, new Map()).get(sinnerId)!
      const slug = gameId ? `id${gameId}` : entry.slug
      if (entry.identityId ?? gameId) withMotion.add((entry.identityId ?? gameId)!)
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
          rarity: art?.rarity ?? null,
          folderName: art?.folder_name ?? null,
          released: art?.release_date ?? null,
          skills: [],
        }
        bySlug.set(slug, identity)
      }
      owner = identity
    }
    const person = (id: string): MotionPartner => {
      const info = identities.get(id)
      return { gameId: id, name: info?.name ?? id, sinner: info?.sinner_name ?? null, portrait: info?.folder_name ? getIdentityPortraitUrl(info.sinner_id, info.folder_name, id, false) : null }
    }
    // A link with no one else (v:link-self) is a plain state.
    const partners = entry.members?.filter(id => id !== (entry.identityId ?? gameId)).map(person) ?? []
    const link: MotionLink | undefined = partners.length ? { id: partners.map(p => p.gameId).join('+'), partners, max: !!entry.linkMax } : undefined
    const ally = /^v:with-(\d{5})/.exec(entry.state)
    const key = `${entry.slug}|${entry.skillId}`
    // A skill saved under another identity's sprite id has no row by its id: the one its identity borrowed.
    const lent = names.skillFrames?.has(entry.skillId) ? undefined : names.skillBorrowed?.get(String(entry.skillId).slice(0, 5))
    const title = skillNames.get(entry.skillId) || lent?.name || (lang === 'en' ? entry.nameEn : lang === 'ja' ? entry.nameJa : undefined)?.trim() || entry.name.replace(/ \[[^\]]+\]$/, '')
    let skill = owner.skills.find(s => s.key === key)
    if (!skill) {
      // An E.G.O skill sits in slot 3 of its sin's frame; an identity's frame is the site row of the skill.
      const frame = names.skillFrames?.get(entry.skillId) ?? lent?.frame ?? (isMotionEgo(owner) ? { sin: owner.sin ?? 'neutral', slot: 3, attack: null } : null)
      owner.skills.push(skill = { key, skillId: entry.skillId, title, form: entry.ego ? (entry.erode ? 'erode' : null) : form, states: [], frame, ...(isMotionEgo(owner) && { erode: !!entry.erode }) })
    }
    if (isBase(entry.state)) skill.title = title
    skill.states.push({
      state: entry.state, label: motionStateLabel(entry, lang, labelContext), name: entry.name, video: entry.video, meta: entry.meta, bytes: entry.bytes ?? 0,
      ...(link && { link }),
      ...(entry.deadAllies?.length && { dead: entry.deadAllies.map(person) }),
      ...(entry.conditions?.length && { conditions: entry.conditions.flatMap(condition => {
        const ref = names.refs?.[condition.keyword]
        return ref ? [{ name: condition.target ? `${labelWord('target', lang)} ${ref.n}` : ref.n, icon: ref.i ? getKeywordIconUrl(ref.kw ?? condition.keyword, ref.i) : null, stack: condition.stack == null ? null : String(condition.stack) }] : []
      }) }),
      ...(ally && { ally: person(ally[1]) }),
      ...(entry.labelKey && { extras: labelExtras(entry, names.refs, labelContext.identityName!, lang) }),
    })
  }
  // A new identity of the site the index has no motion for yet: listed with no skills, so the page can say it is coming.
  if (names.now) {
    const since = names.now.getTime() - MOTION_PENDING_DAYS * 86_400_000
    for (const info of identities.values()) {
      if (!info.game_id || withMotion.has(info.game_id)) continue
      if (info.release_date && Date.parse(`${info.release_date.slice(0, 10)}T00:00:00+09:00`) < since) continue
      const bySlug = sinners.get(info.sinner_id) ?? sinners.set(info.sinner_id, new Map()).get(info.sinner_id)!
      bySlug.set(`id${info.game_id}`, {
        slug: `id${info.game_id}`, label: info.name, identityId: info.id, gameId: info.game_id,
        portrait: info.folder_name ? getIdentityPortraitUrl(info.sinner_id, info.folder_name, info.game_id, false) : null,
        rarity: info.rarity ?? null, folderName: info.folder_name,
        released: info.release_date ?? null, skills: [], pending: true,
      })
    }
  }
  const GRADES = ['ZAYIN', 'TETH', 'HE', 'WAW', 'ALEPH']
  return SINNER_SLUGS.flatMap(id => {
    const bySlug = sinners.get(id), byEgo = egos.get(id)
    if (!bySlug && !byEgo) return []
    const list = [...(bySlug?.values() ?? [])]
    for (const identity of list) {
      // The game's order (skill 1, 2, 3, defense): a skill id's last digits need not follow it (10102: …02 is skill 3).
      const slot = (skill: MotionSkill) => skill.frame?.slot ?? 9
      identity.skills.sort((a, b) => (a.form ?? '').localeCompare(b.form ?? '') || slot(a) - slot(b) || a.skillId - b.skillId)
    }
    // Newest release first, like the site's identity lists; one the site has no row for yet is the newest.
    const released = (identity: MotionIdentity) => identity.released ?? '9999'
    list.sort((a, b) => released(b).localeCompare(released(a)) || slugRank(a.slug) - slugRank(b.slug) || (b.gameId ?? '').localeCompare(a.gameId ?? '') || a.slug.localeCompare(b.slug))
    // E.G.O by grade (ZAYIN up to ALEPH), then newest game id first; an awakening skill before its erosion.
    const egoList = [...(byEgo?.values() ?? [])].sort((a, b) => GRADES.indexOf(a.grade) - GRADES.indexOf(b.grade) || b.egoId - a.egoId)
    for (const ego of egoList) ego.skills.sort((a, b) => Number(a.erode) - Number(b.erode) || a.skillId - b.skillId)
    for (const skill of [...list.flatMap(identity => identity.skills), ...egoList.flatMap(ego => ego.skills)]) skill.states.sort((a, b) => stateRank(a.state) - stateRank(b.state) || a.state.localeCompare(b.state))
    return [{ id, identities: list, egos: egoList }]
  })
}

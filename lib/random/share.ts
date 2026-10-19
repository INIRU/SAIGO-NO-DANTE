import { normalizeDeployRange, type KeywordCondition } from './engine'
import type { LockRef, RollSnapshot } from './roll'
import { isSeed } from './seed'

/**
 * The link of a roll: `s` seed, `t` what is drawn (i/e), `r` rarities, `k` keyword~minimum, `d` order range,
 * `l` locks (sinner.identity.ego_ego.number), `rr` reroll counts, `m` marks (only when they differ from the locked
 * sinners), `code` collection code. Defaults are left out, so a plain roll is just `s=<seed>`.
 */
const SINNER_ID = /^[a-z0-9-]{1,30}$/
const REF = /^[A-Za-z0-9-]{1,64}$/
const KEYWORD = /^[^.~]{1,20}$/
const MAX_CODE_LENGTH = 4000

const parseInteger = (text: string, min: number, max: number): number | null => {
  if (!/^\d{1,4}$/.test(text)) return null
  return Math.min(max, Math.max(min, Number(text)))
}
const listOf = (text: string | null) => (text ? text.split('~') : [])
const sameMembers = (a: string[], b: string[]) => a.length === b.length && a.every(item => b.includes(item))

export function encodeSnapshot(snapshot: RollSnapshot): string {
  const params = new URLSearchParams()
  params.set('s', snapshot.seed)
  const { settings } = snapshot
  if (!(settings.identityEnabled && settings.egoEnabled)) params.set('t', (settings.identityEnabled ? 'i' : '') + (settings.egoEnabled ? 'e' : ''))
  if (settings.rarity?.length) params.set('r', settings.rarity.join(''))
  const keywords = settings.keywords.filter(entry => KEYWORD.test(entry.keyword)).map(entry => `${entry.keyword}.${entry.minCount}`)
  if (keywords.length) params.set('k', keywords.join('~'))
  if (settings.deploy) params.set('d', `${settings.deploy.min}-${settings.deploy.max}`)
  const locks = snapshot.locks.filter(lock => SINNER_ID.test(lock.sinnerId) && (lock.identityRef === null || REF.test(lock.identityRef)) && lock.egoRefs.every(ref => REF.test(ref)))
  if (locks.length) params.set('l', locks.map(lock => [lock.sinnerId, lock.identityRef ?? '', lock.egoRefs.join('_'), lock.number ?? ''].join('.')).join('~'))
  const rerolls = Object.entries(snapshot.rerolls).filter(([id, count]) => SINNER_ID.test(id) && count > 0)
  if (rerolls.length) params.set('rr', rerolls.map(([id, count]) => `${id}.${count}`).join('~'))
  if (!sameMembers(snapshot.marks, locks.map(lock => lock.sinnerId))) params.set('m', snapshot.marks.filter(id => SINNER_ID.test(id)).join('~'))
  if (snapshot.collectionCode) params.set('code', snapshot.collectionCode)
  return params.toString()
}

/** The snapshot of a link; null when it has no usable seed. Anything else wrong in it falls back to the default. */
export function decodeSnapshot(search: string | URLSearchParams): RollSnapshot | null {
  const params = typeof search === 'string' ? new URLSearchParams(search) : search
  const seed = params.get('s')
  if (!isSeed(seed)) return null

  const types = params.get('t')
  const typed = types !== null && /^[ie]{1,2}$/.test(types)
  const rarityText = params.get('r')
  const rarity = rarityText && /^[123]{1,3}$/.test(rarityText) ? [...new Set(rarityText.split('').map(Number))].sort() : null

  const keywords: KeywordCondition[] = []
  for (const entry of listOf(params.get('k'))) {
    const dot = entry.lastIndexOf('.')
    const minCount = dot > 0 ? parseInteger(entry.slice(dot + 1), 1, 12) : null
    const keyword = entry.slice(0, dot)
    if (minCount !== null && KEYWORD.test(keyword) && keywords.length < 2 && !keywords.some(other => other.keyword === keyword)) keywords.push({ keyword, minCount })
  }

  const deployMatch = params.get('d')?.match(/^(\d{1,2})-(\d{1,2})$/)
  const deploy = deployMatch ? normalizeDeployRange({ min: Number(deployMatch[1]), max: Number(deployMatch[2]) }) : null

  const locks: LockRef[] = []
  for (const entry of listOf(params.get('l'))) {
    const [sinnerId, identityRef, egoText, numberText, ...rest] = entry.split('.')
    if (rest.length > 0 || numberText === undefined || !SINNER_ID.test(sinnerId) || locks.some(lock => lock.sinnerId === sinnerId) || locks.length >= 12) continue
    const egoRefs = egoText ? egoText.split('_') : []
    if ((identityRef && !REF.test(identityRef)) || !egoRefs.every(ref => REF.test(ref))) continue
    locks.push({ sinnerId, identityRef: identityRef || null, egoRefs, number: numberText ? parseInteger(numberText, 1, 12) : null })
  }

  const rerolls: Record<string, number> = {}
  for (const entry of listOf(params.get('rr'))) {
    const [sinnerId, countText, ...rest] = entry.split('.')
    const count = countText ? parseInteger(countText, 1, 30) : null
    if (rest.length === 0 && count !== null && SINNER_ID.test(sinnerId)) rerolls[sinnerId] = count
  }

  const marks = params.has('m')
    ? [...new Set(listOf(params.get('m')).filter(id => SINNER_ID.test(id)))].slice(0, 12)
    : locks.map(lock => lock.sinnerId)

  const code = params.get('code')
  return {
    seed,
    settings: {
      identityEnabled: typed ? types.includes('i') : true,
      egoEnabled: typed ? types.includes('e') : true,
      keywords,
      rarity: rarity && rarity.length < 3 ? rarity : null,
      deploy,
    },
    locks,
    rerolls,
    marks,
    collectionCode: code && code.length <= MAX_CODE_LENGTH ? code : null,
  }
}

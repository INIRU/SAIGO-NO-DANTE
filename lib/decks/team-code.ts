import * as pako from 'pako'

const TEAM_CODE_BITS = 560
const TEAM_CODE_BYTES = TEAM_CODE_BITS / 8
const SINNER_COUNT = 12
const SINNER_BLOCK_BITS = 46
const HEADER_BITS = 1
const ID_BITS = 7
const DEPLOYMENT_BITS = 4
const EGO_GRADES = ['ZAYIN', 'TETH', 'HE', 'WAW', 'ALEPH'] as const

export type TeamCodeSinner = {
  id: string
  order_num: number
}

export type TeamCodeIdentity = {
  id: string
  sinner_id: string
  game_id?: string | null
}

export type TeamCodeEgo = {
  id: string
  sinner_id: string
  grade: string
  game_id?: string | null
}

export type TeamCodeDecodeResult<TIdentity, TEgo> = {
  deckSlots: Record<string, TIdentity | undefined>
  egoSlots: Record<string, Record<string, TEgo>>
  formationOrder: string[]
}

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
  return btoa(binary)
}

function encodeDoubleBase64Gzip(bytes: Uint8Array): string {
  const innerBase64 = bytesToBase64(bytes)
  const gzipOptions = {
    level: 9,
    mtime: 0,
    os: 3,
  } as NonNullable<Parameters<typeof pako.gzip>[1]> & { mtime: number; os: number }
  const compressed = pako.gzip(new TextEncoder().encode(innerBase64), gzipOptions)

  compressed[8] = 0x00
  compressed[9] = 0x0a

  return bytesToBase64(compressed)
}

function decodeDoubleBase64Gzip(code: string): Uint8Array {
  const compressed = base64ToBytes(code)
  const innerBase64 = new TextDecoder().decode(pako.ungzip(compressed))
  return base64ToBytes(innerBase64)
}

function bytesToBits(bytes: Uint8Array): string {
  return Array.from(bytes, byte => byte.toString(2).padStart(8, '0')).join('')
}

function bitsToBytes(bits: string): Uint8Array {
  const bytes = new Uint8Array(TEAM_CODE_BYTES)
  for (let i = 0; i < TEAM_CODE_BYTES; i++) {
    bytes[i] = parseInt(bits.slice(i * 8, i * 8 + 8), 2)
  }
  return bytes
}

function readBits(bits: string, start: number, length: number): number {
  return parseInt(bits.slice(start, start + length), 2)
}

function writeBits(bits: string[], start: number, length: number, value: number) {
  if (!Number.isInteger(value) || value < 0 || value >= (1 << length)) {
    throw new Error(`Team code value ${value} does not fit in ${length} bits`)
  }

  const encoded = value.toString(2).padStart(length, '0')
  for (let i = 0; i < length; i++) bits[start + i] = encoded[i]
}

export function getTeamCodeLocalId(gameId: string | number | null | undefined): number | null {
  if (gameId == null) return null
  const raw = String(gameId).trim()
  if (raw.length <= 3) return null

  const localId = Number.parseInt(raw.slice(3), 10)
  if (!Number.isInteger(localId) || localId < 0 || localId >= (1 << ID_BITS)) return null
  return localId
}

function getSortedSinners<TSinner extends TeamCodeSinner>(sinners: TSinner[]): TSinner[] {
  return [...sinners].sort((a, b) => a.order_num - b.order_num).slice(0, SINNER_COUNT)
}

function mapBySinnerAndLocalId<TItem extends { sinner_id: string; game_id?: string | null }>(items: TItem[]) {
  const map = new Map<string, Map<number, TItem>>()

  for (const item of items) {
    const localId = getTeamCodeLocalId(item.game_id)
    if (localId == null) continue

    let sinnerMap = map.get(item.sinner_id)
    if (!sinnerMap) {
      sinnerMap = new Map()
      map.set(item.sinner_id, sinnerMap)
    }
    if (!sinnerMap.has(localId)) sinnerMap.set(localId, item)
  }

  return map
}

function getBlockStart(sinnerIndex: number): number {
  return HEADER_BITS + sinnerIndex * SINNER_BLOCK_BITS
}

export function encodeTeamCode<
  TSinner extends TeamCodeSinner,
  TIdentity extends TeamCodeIdentity,
  TEgo extends TeamCodeEgo,
>({
  sinners,
  deckSlots,
  egoSlots,
  formationOrder,
}: {
  sinners: TSinner[]
  deckSlots: Record<string, TIdentity | undefined>
  egoSlots: Record<string, Record<string, TEgo>>
  formationOrder: string[]
}): string {
  const sortedSinners = getSortedSinners(sinners)
  const deploymentBySinnerId = new Map<string, number>()
  formationOrder.slice(0, SINNER_COUNT).forEach((sinnerId, index) => {
    deploymentBySinnerId.set(sinnerId, index + 1)
  })

  const bits = Array(TEAM_CODE_BITS).fill('0') as string[]

  for (let sinnerIndex = 0; sinnerIndex < SINNER_COUNT; sinnerIndex++) {
    const sinner = sortedSinners[sinnerIndex]
    if (!sinner) continue

    const blockStart = getBlockStart(sinnerIndex)
    const identityId = getTeamCodeLocalId(deckSlots[sinner.id]?.game_id) ?? 1
    writeBits(bits, blockStart, ID_BITS, identityId)
    writeBits(bits, blockStart + ID_BITS, DEPLOYMENT_BITS, deploymentBySinnerId.get(sinner.id) ?? 0)

    for (let gradeIndex = 0; gradeIndex < EGO_GRADES.length; gradeIndex++) {
      const grade = EGO_GRADES[gradeIndex]
      const egoId = getTeamCodeLocalId(egoSlots[sinner.id]?.[grade]?.game_id)
      const encodedEgoId = egoId ?? (grade === 'ZAYIN' ? 1 : 0)
      writeBits(bits, blockStart + ID_BITS + DEPLOYMENT_BITS + gradeIndex * ID_BITS, ID_BITS, encodedEgoId)
    }
  }

  return encodeDoubleBase64Gzip(bitsToBytes(bits.join('')))
}

export function decodeTeamCode<
  TSinner extends TeamCodeSinner,
  TIdentity extends TeamCodeIdentity,
  TEgo extends TeamCodeEgo,
>(
  code: string,
  sinners: TSinner[],
  identities: TIdentity[],
  egos: TEgo[],
): TeamCodeDecodeResult<TIdentity, TEgo> | null {
  try {
    const bits = bytesToBits(decodeDoubleBase64Gzip(code))
    if (bits.length !== TEAM_CODE_BITS) return null

    const sortedSinners = getSortedSinners(sinners)
    const identitiesByCode = mapBySinnerAndLocalId(identities)
    const egosByCode = mapBySinnerAndLocalId(egos)
    const deckSlots: Record<string, TIdentity | undefined> = {}
    const egoSlots: Record<string, Record<string, TEgo>> = {}
    const formationEntries: { sinnerId: string; order: number }[] = []

    for (let sinnerIndex = 0; sinnerIndex < SINNER_COUNT; sinnerIndex++) {
      const sinner = sortedSinners[sinnerIndex]
      if (!sinner) continue

      const blockStart = getBlockStart(sinnerIndex)
      const identityId = readBits(bits, blockStart, ID_BITS)
      const identity = identitiesByCode.get(sinner.id)?.get(identityId)
      if (identity) deckSlots[sinner.id] = identity

      const deploymentOrder = readBits(bits, blockStart + ID_BITS, DEPLOYMENT_BITS)
      if (deploymentOrder > 0) formationEntries.push({ sinnerId: sinner.id, order: deploymentOrder })

      const sinnerEgoSlots: Record<string, TEgo> = {}
      for (let gradeIndex = 0; gradeIndex < EGO_GRADES.length; gradeIndex++) {
        const grade = EGO_GRADES[gradeIndex]
        const egoId = readBits(bits, blockStart + ID_BITS + DEPLOYMENT_BITS + gradeIndex * ID_BITS, ID_BITS)
        if (egoId === 0) continue

        const ego = egosByCode.get(sinner.id)?.get(egoId)
        if (ego) sinnerEgoSlots[grade] = ego
      }

      if (Object.keys(sinnerEgoSlots).length > 0) egoSlots[sinner.id] = sinnerEgoSlots
    }

    formationEntries.sort((a, b) => a.order - b.order)

    return {
      deckSlots,
      egoSlots,
      formationOrder: formationEntries.map(entry => entry.sinnerId),
    }
  } catch {
    return null
  }
}

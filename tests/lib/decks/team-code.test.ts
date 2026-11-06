import { describe, expect, it } from 'vitest'
import { decodeDeckCode, encodeDeckCode } from '@/lib/decks/deck-code-utils'
import type { EGO, Identity, Sinner } from '@/lib/types'

function pad2(value: number): string {
  return String(value).padStart(2, '0')
}

function identityGameId(sinnerNumber: number, localId: number): string {
  return `1${pad2(sinnerNumber)}${pad2(localId)}`
}

function egoGameId(sinnerNumber: number, localId: number): string {
  return `2${pad2(sinnerNumber)}${pad2(localId)}`
}

function makeSinner(sinnerNumber: number): Sinner {
  return {
    id: `sinner-${sinnerNumber}`,
    name: `Sinner ${sinnerNumber}`,
    name_kr: `수감자 ${sinnerNumber}`,
    order_num: sinnerNumber,
    description: '',
    literary_source: '',
  }
}

function makeIdentity(sinnerNumber: number, localId: number): Identity {
  return {
    id: `identity-${sinnerNumber}-${localId}`,
    sinner_id: `sinner-${sinnerNumber}`,
    name: `Identity ${sinnerNumber}-${localId}`,
    name_kr: `인격 ${sinnerNumber}-${localId}`,
    tier: 0,
    hp: 0,
    speed_min: 0,
    speed_max: 0,
    def_level: 0,
    keywords: [],
    rarity: 3,
    game_id: identityGameId(sinnerNumber, localId),
    folder_name: null,
  } as Identity
}

function makeEgo(sinnerNumber: number, localId: number, grade: string): EGO {
  return {
    id: `ego-${sinnerNumber}-${localId}`,
    sinner_id: `sinner-${sinnerNumber}`,
    name: `EGO ${sinnerNumber}-${localId}`,
    name_kr: `에고 ${sinnerNumber}-${localId}`,
    grade,
    sin_affinity: null,
    description: null,
    folder_name: null,
    image_url: null,
    passive_name: null,
    passive_content: null,
    ego_skills: null,
    ego_cor_skills: null,
    resistance: null,
    cost: null,
    keywords: null,
    cor_image_url: null,
    game_id: egoGameId(sinnerNumber, localId),
  } as EGO
}

function makeFixture() {
  const sinners = Array.from({ length: 12 }, (_, index) => makeSinner(index + 1))
  const identities = sinners.flatMap((_, index) => [
    makeIdentity(index + 1, 1),
    makeIdentity(index + 1, 4),
  ])
  const egos = sinners.flatMap((_, index) => [
    makeEgo(index + 1, 1, 'ZAYIN'),
    makeEgo(index + 1, 16, 'TETH'),
    makeEgo(index + 1, 21, 'ALEPH'),
  ])

  return { sinners, identities, egos }
}

describe('in-game team code encoding', () => {
  it('16 이상의 EGO game_id 번호를 7비트로 보존한다', async () => {
    const { sinners, identities, egos } = makeFixture()
    const identity = identities.find(i => i.game_id === '10104')!
    const teth = egos.find(e => e.game_id === '20116')!

    const code = await encodeDeckCode(
      sinners,
      identities,
      egos,
      { 'sinner-1': identity },
      { 'sinner-1': { TETH: teth } },
      ['sinner-1'],
    )
    const decoded = await decodeDeckCode(code, sinners, identities, egos)

    expect(decoded?.deckSlots['sinner-1']?.game_id).toBe('10104')
    expect(decoded?.egoSlots['sinner-1']?.TETH?.game_id).toBe('20116')
  })

  it('기존 4비트 방식에서 표현할 수 없던 ALEPH EGO를 roundtrip한다', async () => {
    const { sinners, identities, egos } = makeFixture()
    const identity = identities.find(i => i.game_id === '10104')!
    const aleph = egos.find(e => e.game_id === '20121')!

    const code = await encodeDeckCode(
      sinners,
      identities,
      egos,
      { 'sinner-1': identity },
      { 'sinner-1': { ALEPH: aleph } },
      ['sinner-1'],
    )
    const decoded = await decodeDeckCode(code, sinners, identities, egos)

    expect(decoded?.egoSlots['sinner-1']?.ALEPH?.game_id).toBe('20121')
  })

  it('12명 identity, deployment, EGO 선택을 decode 후에도 유지한다', async () => {
    const { sinners, identities, egos } = makeFixture()
    const deckSlots: Record<string, Identity | undefined> = {}
    const egoSlots: Record<string, Record<string, EGO>> = {}
    const formationOrder = sinners.map(sinner => sinner.id).reverse()

    for (let sinnerNumber = 1; sinnerNumber <= 12; sinnerNumber++) {
      const sinnerId = `sinner-${sinnerNumber}`
      deckSlots[sinnerId] = identities.find(i => i.game_id === identityGameId(sinnerNumber, 4))
      egoSlots[sinnerId] = {
        TETH: egos.find(e => e.game_id === egoGameId(sinnerNumber, 16))!,
      }
    }

    const code = await encodeDeckCode(sinners, identities, egos, deckSlots, egoSlots, formationOrder)
    const decoded = await decodeDeckCode(code, sinners, identities, egos)

    expect(decoded?.formationOrder).toEqual(formationOrder)
    for (let sinnerNumber = 1; sinnerNumber <= 12; sinnerNumber++) {
      const sinnerId = `sinner-${sinnerNumber}`
      expect(decoded?.deckSlots[sinnerId]?.game_id).toBe(identityGameId(sinnerNumber, 4))
      expect(decoded?.egoSlots[sinnerId]?.TETH?.game_id).toBe(egoGameId(sinnerNumber, 16))
    }
  })
})

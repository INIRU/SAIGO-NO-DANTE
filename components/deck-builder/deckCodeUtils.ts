import type { Sinner, Identity, EGO } from '@/lib/data/sinners'

// ── 비트 읽기/쓰기 (start0: 0-indexed) ──────────────────────────────────
function readBits(bits: string, start0: number, length: number): number {
  const s = bits.slice(start0, start0 + length)
  return s.length ? parseInt(s, 2) : 0
}

function writeBitsArr(arr: string[], start0: number, length: number, value: number) {
  const s = value.toString(2).padStart(length, '0')
  for (let i = 0; i < length; i++) arr[start0 + i] = s[i]
}

// 출시 순서 정렬 (game_id 기준)
function sortedIdentities(list: Identity[]): Identity[] {
  return [...list].sort((a, b) => {
    const aId = a.game_id ? parseInt(a.game_id) : 99999
    const bId = b.game_id ? parseInt(b.game_id) : 99999
    return aId - bId
  })
}

// 비트 위치 (0-indexed, sinner block 내 상대 위치)
// 1-indexed 문서 기준: 5-8=identity, 9-12=formation, 16-19=ZAYIN, 23-26=TETH, 30-33=HE, 37-40=WAW
const CODE_BIT_POSITIONS = {
  identity:  4,  // 0-indexed = 1-indexed - 1
  formation: 8,
  ZAYIN:     15,
  TETH:      22,
  HE:        29,
  WAW:       36,
} as const

export async function decodeDeckCode(
  code: string,
  sinners: Sinner[],
  identities: Identity[],
  egos: EGO[],
): Promise<{ deckSlots: Record<string, Identity | undefined>; egoSlots: Record<string, Record<string, EGO>>; formationOrder: string[] } | null> {
  try {
    // 1) base64 decode → compressed bytes
    const compressed = Uint8Array.from(atob(code), c => c.charCodeAt(0))
    // 2) gzip decompress
    const ds = new DecompressionStream('gzip')
    const w = ds.writable.getWriter()
    w.write(compressed); w.close()
    const decompBuf = await new Response(ds.readable).arrayBuffer()
    const b64str = new TextDecoder().decode(decompBuf)
    // 3) base64 decode → bytes
    const bytes = Uint8Array.from(atob(b64str), c => c.charCodeAt(0))
    // 4) bytes → bits
    const bits = Array.from(bytes).map(b => b.toString(2).padStart(8, '0')).join('')
    if (bits.length < 560) return null

    const sorted = [...sinners].sort((a, b) => a.order_num - b.order_num)
    const deckSlots: Record<string, Identity | undefined> = {}
    const egoSlots: Record<string, Record<string, EGO>> = {}
    const formEntries: { sinnerId: string; order: number }[] = []

    for (let si = 0; si < 12; si++) {
      const sinner = sorted[si]
      if (!sinner) continue
      const off = si * 46
      const sinnerIds = sortedIdentities(identities.filter(i => i.sinner_id === sinner.id))
      const sinnerEgos = egos.filter(e => e.sinner_id === sinner.id)
        .sort((a, b) => parseInt(a.game_id ?? '99999') - parseInt(b.game_id ?? '99999'))

      const idxOrder = readBits(bits, off + CODE_BIT_POSITIONS.identity, 4)
      if (idxOrder > 0 && idxOrder <= sinnerIds.length) {
        deckSlots[sinner.id] = sinnerIds[idxOrder - 1]
      }

      const formOrder = readBits(bits, off + CODE_BIT_POSITIONS.formation, 4)
      if (formOrder > 0) formEntries.push({ sinnerId: sinner.id, order: formOrder })

      const gradeMap: Record<string, number> = {
        ZAYIN: CODE_BIT_POSITIONS.ZAYIN,
        TETH:  CODE_BIT_POSITIONS.TETH,
        HE:    CODE_BIT_POSITIONS.HE,
        WAW:   CODE_BIT_POSITIONS.WAW,
      }
      const sinnerEgoMap: Record<string, EGO> = {}
      for (const [grade, bitPos] of Object.entries(gradeMap)) {
        const egoOrder = readBits(bits, off + bitPos, 4)
        if (egoOrder > 0 && egoOrder <= sinnerEgos.length) {
          sinnerEgoMap[grade] = sinnerEgos[egoOrder - 1]
        }
      }
      if (Object.keys(sinnerEgoMap).length > 0) egoSlots[sinner.id] = sinnerEgoMap
    }

    formEntries.sort((a, b) => a.order - b.order)
    return { deckSlots, egoSlots, formationOrder: formEntries.map(e => e.sinnerId) }
  } catch {
    return null
  }
}

export async function encodeDeckCode(
  sinners: Sinner[],
  identities: Identity[],
  egos: EGO[],
  deckSlots: Record<string, Identity | undefined>,
  egoSlots: Record<string, Record<string, EGO>>,
  formationOrder: string[],
): Promise<string> {
  const sorted = [...sinners].sort((a, b) => a.order_num - b.order_num)
  const arr = Array(560).fill('0')

  for (let si = 0; si < 12; si++) {
    const sinner = sorted[si]
    if (!sinner) continue
    const off = si * 46
    const sinnerIds = sortedIdentities(identities.filter(i => i.sinner_id === sinner.id))
    const sinnerEgos = egos.filter(e => e.sinner_id === sinner.id)
      .sort((a, b) => parseInt(a.game_id ?? '99999') - parseInt(b.game_id ?? '99999'))

    const identity = deckSlots[sinner.id]
    if (identity) {
      const order = sinnerIds.findIndex(i => i.id === identity.id) + 1
      if (order > 0) writeBitsArr(arr, off + CODE_BIT_POSITIONS.identity, 4, order)

      const formIdx = formationOrder.indexOf(sinner.id)
      if (formIdx !== -1) writeBitsArr(arr, off + CODE_BIT_POSITIONS.formation, 4, formIdx + 1)
    }

    const gradeMap: Record<string, number> = {
      ZAYIN: CODE_BIT_POSITIONS.ZAYIN,
      TETH:  CODE_BIT_POSITIONS.TETH,
      HE:    CODE_BIT_POSITIONS.HE,
      WAW:   CODE_BIT_POSITIONS.WAW,
    }
    for (const [grade, bitPos] of Object.entries(gradeMap)) {
      const ego = egoSlots[sinner.id]?.[grade]
      if (!ego) continue
      const order = sinnerEgos.findIndex(e => e.id === ego.id) + 1
      if (order > 0) writeBitsArr(arr, off + bitPos, 4, order)
    }
  }

  // bits → bytes → base64
  const bytes = new Uint8Array(70)
  for (let i = 0; i < 70; i++) bytes[i] = parseInt(arr.slice(i * 8, i * 8 + 8).join(''), 2)
  const b64 = btoa(String.fromCharCode(...bytes))

  // gzip compress
  const cs = new CompressionStream('gzip')
  const cw = cs.writable.getWriter()
  cw.write(new TextEncoder().encode(b64)); cw.close()
  const compBuf = await new Response(cs.readable).arrayBuffer()

  return btoa(String.fromCharCode(...new Uint8Array(compBuf)))
}

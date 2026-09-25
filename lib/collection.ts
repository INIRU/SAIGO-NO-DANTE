// ── 컬렉션 비트 인코딩/디코딩 공유 유틸리티 ─────────────────────────────────

export type SinnerInfo = { id: string; name_kr: string; name_en?: string | null; name_jp?: string | null; order_num: number }
export type IdentityInfo = { id: string; sinner_id: string; name_kr: string; game_id: string | null; folder_name: string | null; rarity: number; keywords: string[] | null }
export type EGOInfo = { id: string; sinner_id: string; name_kr: string | null; name_en?: string | null; name_jp?: string | null; grade: string; sin_affinity: string | null; folder_name: string | null; image_url: string | null }

export type CollectionData = {
  sinners: SinnerInfo[]
  identities: Record<string, IdentityInfo[]>
  egos: Record<string, EGOInfo[]>
}

export const BITS_IDENTITY = 24
export const BITS_EGO = 16
export const BITS_PER_SINNER = BITS_IDENTITY + BITS_EGO

export async function decodeCollectionAsync(
  code: string,
  sinners: SinnerInfo[],
  identities: Record<string, IdentityInfo[]>,
  egos: Record<string, EGOInfo[]>,
): Promise<Set<string>> {
  const owned = new Set<string>()

  try {
    const compressed = Uint8Array.from(atob(code), c => c.charCodeAt(0))
    const ds = new DecompressionStream('gzip')
    const writer = ds.writable.getWriter()
    // Fire-and-forget write; catch writer errors to prevent unhandled rejection
    const writePromise = writer.write(compressed).then(() => writer.close()).catch(() => {})
    let decompressedBuf: ArrayBuffer
    try {
      decompressedBuf = await new Response(ds.readable).arrayBuffer()
    } catch {
      await writePromise
      return owned
    }
    const decompressed = new Uint8Array(decompressedBuf)

    for (let si = 0; si < 12; si++) {
      const sinner = sinners[si]
      if (!sinner) continue
      const off = si * BITS_PER_SINNER

      const ids = identities[sinner.id] ?? []
      for (let i = 0; i < ids.length && i < BITS_IDENTITY; i++) {
        const bitIdx = off + i
        if (decompressed[Math.floor(bitIdx / 8)] & (1 << (7 - (bitIdx % 8)))) {
          owned.add(ids[i].id)
        }
      }

      const egoList = egos[sinner.id] ?? []
      for (let i = 0; i < egoList.length && i < BITS_EGO; i++) {
        const bitIdx = off + BITS_IDENTITY + i
        if (decompressed[Math.floor(bitIdx / 8)] & (1 << (7 - (bitIdx % 8)))) {
          owned.add(egoList[i].id)
        }
      }
    }
  } catch {
    // 디코딩 실패 시 빈 Set 반환
  }

  return owned
}

/** LCB (1★) identities come with every account, so they always count as owned even when not ticked. */
export function withBaseIdentities(owned: Set<string>, identities: Record<string, IdentityInfo[]>): Set<string> {
  for (const list of Object.values(identities)) for (const identity of list) if (identity.rarity === 1) owned.add(identity.id)
  return owned
}

/** Formed identities (slot_order < 99; backups are optional) missing from the owned set. */
export function missingFormationCount(slots: readonly { id?: string | null; slot_order?: number | null }[], owned: ReadonlySet<string>): number {
  return slots.filter(slot => slot.id && (slot.slot_order ?? 99) < 99 && !owned.has(slot.id)).length
}


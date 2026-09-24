export interface VisualReference { id: string; imageUrl: string | null }
export interface VisualMatch { id: string; score: number }
export interface VisualCandidates {
  gifts: VisualMatch[]
  events: VisualMatch[]
  observedAt: number
  expiresAt: number
}

export interface EmbeddingIndex {
  gifts: Map<string, Float32Array>
  events: Map<string, Float32Array>
}

const DIMENSIONS = 576

function decodeVector(base64: string): Float32Array {
  const binary = atob(base64)
  if (binary.length !== DIMENSIONS * 4) throw new Error('Invalid visual embedding size')
  const bytes = Uint8Array.from(binary, character => character.charCodeAt(0))
  const vector = new Float32Array(bytes.buffer)
  if (!vector.every(Number.isFinite)) throw new Error('Invalid visual embedding values')
  return vector
}

export function decodeEmbeddingIndex(source: unknown): EmbeddingIndex {
  if (!source || typeof source !== 'object' || !('version' in source) || source.version !== 1 ||
      !('dimensions' in source) || source.dimensions !== DIMENSIONS ||
      !('gifts' in source) || !Array.isArray(source.gifts) ||
      !('events' in source) || !Array.isArray(source.events)) throw new Error('Invalid visual embedding index')
  const gifts = new Map<string, Float32Array>()
  const events = new Map<string, Float32Array>()
  for (const [entries, output] of [[source.gifts, gifts], [source.events, events]] as const) {
    for (const entry of entries) {
      if (!entry || typeof entry.id !== 'string' || typeof entry.vector !== 'string') throw new Error('Invalid visual embedding')
      output.set(entry.id, decodeVector(entry.vector))
    }
  }
  return { gifts, events }
}

export function eventArtId(imageUrl: string | null): string | null {
  if (!imageUrl) return null
  return /\/(\d+)\.webp(?:\?|$)/i.exec(imageUrl)?.[1] ?? null
}

export function cosine(left: Float32Array, right: Float32Array): number {
  if (left.length !== DIMENSIONS || right.length !== DIMENSIONS) throw new Error('Invalid embedding dimensions')
  let product = 0, leftLength = 0, rightLength = 0
  for (let index = 0; index < DIMENSIONS; index++) {
    product += left[index] * right[index]
    leftLength += left[index] * left[index]
    rightLength += right[index] * right[index]
  }
  return leftLength > 0 && rightLength > 0
    ? Math.max(-1, Math.min(1, product / Math.sqrt(leftLength * rightLength))) : 0
}

export function matchEventEmbedding(query: Float32Array, references: VisualReference[], index: EmbeddingIndex): VisualMatch[] {
  const eventIdsByArt = new Map<string, string[]>()
  for (const reference of references) {
    const artId = eventArtId(reference.imageUrl)
    if (!artId || !index.events.has(artId)) continue
    eventIdsByArt.set(artId, [...(eventIdsByArt.get(artId) ?? []), reference.id])
  }
  const ranked = [...eventIdsByArt.keys()].map(id => ({ id, score: cosine(query, index.events.get(id)!) }))
    .sort((left, right) => right.score - left.score)
  if (!ranked.length || ranked[0].score < 0.84 || ranked[0].score - (ranked[1]?.score ?? -1) < 0.08) return []
  return eventIdsByArt.get(ranked[0].id)!.map(id => ({ id, score: ranked[0].score }))
}

export function matchGiftEmbedding(query: Float32Array, references: VisualReference[], index: EmbeddingIndex): VisualMatch[] {
  const allowed = new Set(references.filter(reference => reference.imageUrl).map(reference => reference.id))
  const ranked = [...index.gifts].filter(([id]) => allowed.has(id))
    .map(([id, embedding]) => ({ id, score: cosine(query, embedding) }))
    .sort((left, right) => right.score - left.score)
  if (!ranked.length || ranked[0].score < 0.75 || ranked[0].score - (ranked[1]?.score ?? -1) < 0.04) return []
  return [ranked[0]]
}

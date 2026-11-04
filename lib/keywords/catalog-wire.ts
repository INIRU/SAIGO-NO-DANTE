import type { KeywordInfo } from '@/lib/keywords/catalog'

/** Which language names the catalogue carries: a page language's, or `all` for a section that searches across languages. */
export type KeywordNameLanguages = 'ko' | 'en' | 'ja' | 'all'

/** A catalogue entry as the [lang] layout hands it down; the cells it leaves out are filled by `expandKeywordCatalog`. */
export type KeywordInfoWire = Partial<KeywordInfo>

/**
 * The catalogue every page carries, without the cells no page reads: descriptions (tooltips load them from
 * /api/keyword-descriptions), the names of the other languages and, in Korean, the game id (only the English and
 * Japanese name indexes use it, see getLocalizedKeywordIndex).
 */
export function compactKeywordCatalog(keywords: Record<string, KeywordInfo>, names: KeywordNameLanguages): Record<string, KeywordInfoWire> {
  const out: Record<string, KeywordInfoWire> = {}
  for (const [name, info] of Object.entries(keywords)) {
    const { desc, descEn, descJp, nameEn, nameJp, gameId, ...kept } = info
    out[name] = {
      ...kept,
      ...(names !== 'ko' && gameId ? { gameId } : {}),
      ...((names === 'en' || names === 'all') && nameEn ? { nameEn } : {}),
      ...((names === 'ja' || names === 'all') && nameJp ? { nameJp } : {}),
    }
  }
  return out
}

/** Every entry with the cells the readers expect (`desc: ''`, the other names and descriptions `null`). */
export function expandKeywordCatalog(wire: Record<string, KeywordInfoWire>): Record<string, KeywordInfo> {
  const out: Record<string, KeywordInfo> = {}
  for (const [name, info] of Object.entries(wire)) out[name] = { desc: '', nameEn: null, nameJp: null, descEn: null, descJp: null, ...info }
  return out
}

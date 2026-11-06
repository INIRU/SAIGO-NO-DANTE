import { search, type IndexEntry } from '@/lib/search/engine'
import { SINNER_ALIASES } from '@/lib/search/sinner-aliases'
import { translations } from '@/lib/i18n/translations'
import type { IdentityStat } from '@/lib/meta/types'

type KeywordNames = Record<string, { nameEn?: string | null; nameJp?: string | null } | undefined>

function sinnerTexts(sinnerId: string): string[] {
  const names = (translations as Record<string, { ko?: string; en?: string; ja?: string } | undefined>)[`sinner.${sinnerId}`]
  return [names?.ko, names?.en, names?.ja, ...(SINNER_ALIASES[sinnerId] ?? [])].filter((text): text is string => !!text)
}

/**
 * The analysis identities that match `query`, best first, by the site search engine: names in all three languages,
 * the sinner's names and aliases, keywords (with their en/ja names from `keywords`), initial consonants, several
 * words and one typo. An empty query returns `rows` as given.
 */
export function searchIdentityRows(rows: IdentityStat[], query: string, keywords: KeywordNames = {}): IdentityStat[] {
  if (!query.trim()) return rows
  const entries: IndexEntry[] = rows.map(row => ({
    type: 'identity', href: row.identity_id, label: row.name_kr,
    names: { ko: row.name_kr, en: row.name_en, ja: row.name_jp },
    context: [
      ...sinnerTexts(row.sinner_id).map(text => ({ field: 'sinner' as const, text })),
      ...row.keywords.flatMap(keyword => [keyword, keywords[keyword]?.nameEn, keywords[keyword]?.nameJp])
        .filter((text): text is string => !!text).map(text => ({ field: 'keyword' as const, text })),
    ],
  }))
  const byId = new Map(rows.map(row => [row.identity_id, row]))
  return search(entries, query).map(hit => byId.get(hit.entry.href)!)
}

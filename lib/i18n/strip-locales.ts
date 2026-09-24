/** Drops the long text columns of locales other than `lang` (UI falls back to the Korean column), plus timestamps.
 *  `nested` columns hold JSON with `{ ko, en, ja }` text maps; those collapse to `lang` when it has text. */
export function withoutOtherLocales<T extends Record<string, unknown>>(row: T, lang: string, fields: string[], nested: string[] = []): T {
  const drop = ['_en', '_jp'].filter(suffix => !(suffix === '_en' && lang === 'en') && !(suffix === '_jp' && lang === 'ja'))
  const copy: Record<string, unknown> = { ...row }
  for (const field of fields) for (const suffix of drop) delete copy[field + suffix]
  for (const field of nested) if (field in copy) copy[field] = pickLocale(copy[field], lang)
  delete copy.created_at
  delete copy.updated_at
  return copy as T
}

const LOCALE_KEYS = new Set(['ko', 'en', 'ja'])

function pickLocale(value: unknown, lang: string): unknown {
  if (Array.isArray(value)) return value.map(item => pickLocale(item, lang))
  if (!value || typeof value !== 'object') return value
  const entries = Object.entries(value)
  if (entries.length > 0 && entries.every(([key]) => LOCALE_KEYS.has(key))) {
    const local = (value as Record<string, unknown>)[lang]
    return local ? { [lang]: local } : value
  }
  return Object.fromEntries(entries.map(([key, item]) => [key, pickLocale(item, lang)]))
}

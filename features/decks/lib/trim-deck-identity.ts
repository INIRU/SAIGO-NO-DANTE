import { rowsAtUptie, topUptieRows } from '@/lib/decks/deck-identity-uptie'

type Row = { uptie_level?: number | null; description?: string | null; description_en?: string | null; description_jp?: string | null }

const present = (value: string | null | undefined) => value?.trim() ? value : null

/** Same fallback chain as localizeSkillDescription / localizePassiveDescription. */
function localizedDescription(row: Row, locale: string): string | null {
  if (locale === 'en') return present(row.description_en) ?? present(row.description_jp) ?? present(row.description)
  if (locale === 'ja') return present(row.description_jp) ?? present(row.description_en) ?? present(row.description)
  return present(row.description)
}

/**
 * Rows the deck page can show: the top uptie of each skill/passive (notes, identity cards)
 * plus the slot's own uptie (insight panels). Descriptions collapse to the page language.
 */
function trimRows<T extends Row>(rows: readonly T[], identityId: string, uptie: number | null | undefined, locale: string, keyOf: (row: T) => string): T[] {
  const keep = new Set<T>(topUptieRows(rows, keyOf))
  const upties = new Map([[identityId, uptie ?? undefined]])
  for (const row of rowsAtUptie(rows.map(r => ({ ...r, identity_id: identityId, source: r })), upties)) keep.add(row.source)

  return rows.filter(row => keep.has(row)).map(row => {
    const { description_en: _en, description_jp: _jp, ...rest } = row
    const description = localizedDescription(row, locale)
    return (description === null ? rest : { ...rest, description }) as T
  })
}

/** Deck detail ships a few identities to the browser; send only the skill/passive rows and language it renders. */
export function trimDeckIdentity<
  S extends Row & { skill_order: number; variant_order?: number | null },
  P extends Row & { passive_type: string; passive_order: number },
  I extends { id: string; skills?: S[] | null; passives?: P[] | null },
>(identity: I, uptie: number | null | undefined, locale: string): I {
  return {
    ...identity,
    skills: trimRows(identity.skills ?? [], identity.id, uptie, locale, s => `${s.skill_order}:${s.variant_order ?? 0}`),
    passives: trimRows(identity.passives ?? [], identity.id, uptie, locale, p => `${p.passive_type}:${p.passive_order}`),
  }
}

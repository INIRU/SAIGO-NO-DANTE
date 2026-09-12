import type { Identity, SinType } from '../../lib/types'

const ATTRIBUTES: Record<string, SinType> = {
  CRIMSON: 'wrath', SCARLET: 'lust', AMBER: 'sloth', SHAMROCK: 'gluttony',
  AZURE: 'gloom', INDIGO: 'pride', VIOLET: 'envy',
}

type HistoricalMetadata = Pick<Identity, 'quote' | 'acquisition' | 'acquisition_info'>

export function restoreHistoricalMetadata(current: HistoricalMetadata, historical: HistoricalMetadata): HistoricalMetadata {
  const original = historical.acquisition_info
  const latest = current.acquisition_info
  // Original manual routes are authoritative; only add newly sourced banner
  // translations/IDs and decoded Walpurgis editions. Do not retain generated
  // exchange restrictions that were never present in the original record.
  const acquisitionInfo = original ? { ...original } : latest
  if (acquisitionInfo && latest && acquisitionInfo.gacha !== 'none') {
    for (const key of ['gacha_id', 'gacha_name', 'gacha_name_en', 'gacha_name_jp'] as const) {
      const value = latest[key]
      if (value != null) Object.assign(acquisitionInfo, { [key]: value })
    }
    if (acquisitionInfo.type === 'walpurgis' && latest.walpurgis_edition != null) {
      acquisitionInfo.walpurgis_edition = latest.walpurgis_edition
    }
  }
  return {
    quote: current.quote?.trim() ? current.quote : historical.quote,
    acquisition: historical.acquisition || current.acquisition,
    acquisition_info: acquisitionInfo,
  }
}

export function identityMetadata(source: { uniqueAttribute?: string; updatedDate?: number | null }) {
  const raw = String(source.updatedDate ?? '')
  const date = /^\d{8}$/.test(raw) ? `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6)}` : null
  const parsed = date ? new Date(`${date}T00:00:00Z`) : null
  return {
    sin_affinity: ATTRIBUTES[source.uniqueAttribute ?? ''] ?? null,
    // Game catalogue date, not the Drive file modification timestamp.
    release_date: parsed && Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date ? date : null,
  }
}

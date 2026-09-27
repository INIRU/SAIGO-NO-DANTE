/** A maintenance window as the proxy sees it (Supabase row subset, mirrored to Edge Config). */
export type MaintenanceEntry = {
  path: string
  message: string
  reason: string
  starts_at: string | null
  ends_at: string | null
}

export type MaintenanceRow = MaintenanceEntry & {
  id: number
  label: string
  is_active: boolean
  created_at: string
  updated_at: string
}

/** Edge Config item that holds every active window. */
export const MAINTENANCE_EDGE_KEY = 'maintenance'

/** A window blocks pages from starts_at (or right away) until ends_at (or until it is switched off). */
export function isMaintenanceOpen(entry: Pick<MaintenanceEntry, 'starts_at' | 'ends_at'>, now: Date): boolean {
  if (entry.starts_at && new Date(entry.starts_at) > now) return false
  if (entry.ends_at && new Date(entry.ends_at) <= now) return false
  return true
}

export type MaintenanceStatus = 'off' | 'scheduled' | 'live' | 'ended'

export function maintenanceStatus(row: Pick<MaintenanceRow, 'is_active' | 'starts_at' | 'ends_at'>, now: Date): MaintenanceStatus {
  if (!row.is_active) return 'off'
  if (row.ends_at && new Date(row.ends_at) <= now) return 'ended'
  if (row.starts_at && new Date(row.starts_at) > now) return 'scheduled'
  return 'live'
}

/**
 * Edge Config read URL for the maintenance item, or null when the proxy should read Supabase.
 * Edge Config is used only when the admin API can also write it (VERCEL_API_TOKEN); otherwise it would go stale.
 */
export function maintenanceEdgeReadUrl(env: Record<string, string | undefined> = process.env): string | null {
  if (!env.EDGE_CONFIG || !env.VERCEL_API_TOKEN) return null
  try {
    const url = new URL(env.EDGE_CONFIG)
    const token = url.searchParams.get('token')
    if (!token) return null
    return `${url.origin}${url.pathname}/item/${MAINTENANCE_EDGE_KEY}?token=${encodeURIComponent(token)}`
  } catch {
    return null
  }
}

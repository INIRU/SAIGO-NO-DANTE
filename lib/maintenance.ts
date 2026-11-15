/** A maintenance window as the proxy sees it (Supabase row subset). */
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

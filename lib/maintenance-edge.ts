import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import { MAINTENANCE_EDGE_KEY, type MaintenanceEntry } from '@/lib/maintenance'

const VERCEL_TEAM_ID = 'team_RxyMN3TspcaLiqajgbZ1YBuQ'

export type EdgeSync = 'synced' | 'unconfigured' | 'failed'

/** Copies every active window from Supabase to Edge Config so the proxy sees changes within seconds. */
export async function syncMaintenanceToEdge(): Promise<EdgeSync> {
  const connection = process.env.EDGE_CONFIG
  const token = process.env.VERCEL_API_TOKEN
  if (!connection || !token) return 'unconfigured'
  const { data, error } = await createAdminClient()
    .schema('limbus')
    .from('site_maintenance')
    .select('path,message,reason,starts_at,ends_at')
    .eq('is_active', true)
  if (error) return 'failed'
  try {
    const id = new URL(connection).pathname.slice(1)
    const res = await fetch(`https://api.vercel.com/v1/edge-config/${id}/items?teamId=${process.env.VERCEL_TEAM_ID ?? VERCEL_TEAM_ID}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: [{ operation: 'upsert', key: MAINTENANCE_EDGE_KEY, value: data satisfies MaintenanceEntry[] }] }),
    })
    return res.ok ? 'synced' : 'failed'
  } catch {
    return 'failed'
  }
}

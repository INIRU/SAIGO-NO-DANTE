import { describe, expect, it } from 'vitest'
import * as maintenance from '@/lib/maintenance'

const { isMaintenanceOpen, maintenanceStatus } = maintenance

const now = new Date('2026-09-28T03:00:00Z')

describe('maintenance windows', () => {
  it('blocks only between starts_at and ends_at', () => {
    expect(isMaintenanceOpen({ starts_at: null, ends_at: null }, now)).toBe(true)
    expect(isMaintenanceOpen({ starts_at: '2026-09-28T04:00:00Z', ends_at: null }, now)).toBe(false)
    expect(isMaintenanceOpen({ starts_at: '2026-09-28T02:00:00Z', ends_at: '2026-09-28T03:00:00Z' }, now)).toBe(false)
    expect(isMaintenanceOpen({ starts_at: '2026-09-28T02:00:00Z', ends_at: '2026-09-28T03:30:00Z' }, now)).toBe(true)
  })

  it('labels admin rows', () => {
    expect(maintenanceStatus({ is_active: false, starts_at: null, ends_at: null }, now)).toBe('off')
    expect(maintenanceStatus({ is_active: true, starts_at: '2026-09-28T04:00:00Z', ends_at: null }, now)).toBe('scheduled')
    expect(maintenanceStatus({ is_active: true, starts_at: null, ends_at: '2026-09-28T02:00:00Z' }, now)).toBe('ended')
    expect(maintenanceStatus({ is_active: true, starts_at: null, ends_at: null }, now)).toBe('live')
  })

  it('the proxy reads only Supabase: no Edge Config path is left', () => {
    expect(Object.keys(maintenance)).not.toContain('maintenanceEdgeReadUrl')
    expect(Object.keys(maintenance)).not.toContain('MAINTENANCE_EDGE_KEY')
  })
})

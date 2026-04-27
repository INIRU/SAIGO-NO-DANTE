import { createAdminClient } from '@/lib/supabase/admin'

export async function writeAuditLog(params: {
  actorId: string | null
  action: string
  targetType?: string
  targetId?: string
  details?: Record<string, unknown>
  severity?: 'info' | 'warning' | 'danger' | 'success'
  ip?: string | null
  country?: string | null
}) {
  const admin = createAdminClient()
  const { error } = await admin
    .schema('limbus')
    .from('audit_logs')
    .insert({
      actor_id: params.actorId,
      action: params.action,
      target_type: params.targetType ?? null,
      target_id: params.targetId ?? null,
      details: params.details ?? {},
      severity: params.severity ?? 'info',
      ip: params.ip ?? null,
      country: params.country ?? null,
    })

  return { error }
}

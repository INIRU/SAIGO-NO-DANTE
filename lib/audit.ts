import { createAdminClient } from '@/lib/supabase/admin'
import { toJson } from '@/lib/supabase/json'

export async function writeAuditLog(params: {
  actorId: string | null
  action: string
  targetType?: string
  targetId?: string
  details?: Record<string, unknown>
  severity?: 'info' | 'warning' | 'danger' | 'success'
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
      details: toJson(params.details ?? {}),
      severity: params.severity ?? 'info',
    })

  return { error }
}

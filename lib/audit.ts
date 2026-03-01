import { createAdminClient } from '@/lib/supabase/admin'

export async function writeAuditLog(params: {
  actorId: string | null
  action: string
  targetType?: string
  targetId?: string
  details?: Record<string, unknown>
}) {
  const admin = createAdminClient()
  await admin
    .schema('limbus')
    .from('audit_logs')
    .insert({
      actor_id: params.actorId,
      action: params.action,
      target_type: params.targetType ?? null,
      target_id: params.targetId ?? null,
      details: params.details ?? {},
    })
}

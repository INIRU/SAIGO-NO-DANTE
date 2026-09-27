import { z } from 'zod'

const instant = z.string().datetime({ offset: true }).nullable().default(null)

// Request validation for the admin maintenance API (kept out of lib/maintenance so the proxy does not load zod).
export const maintenanceSchema = z
  .object({
    path: z.string().trim().regex(/^\/[A-Za-z0-9/_-]*$/, '경로는 /로 시작해야 합니다.').max(120),
    reason: z.string().trim().max(120).default(''),
    message: z.string().trim().max(500).default(''),
    starts_at: instant,
    ends_at: instant,
    is_active: z.boolean().default(true),
  })
  .refine((v) => !v.starts_at || !v.ends_at || new Date(v.starts_at) < new Date(v.ends_at), '종료 시각은 시작 시각보다 늦어야 합니다.')

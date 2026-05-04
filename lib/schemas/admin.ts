import { z } from 'zod'

// ── Identity ────────────────────────────────────────────────────────────────

export const createIdentitySchema = z.object({
  sinner_id: z.string().uuid('유효한 수감자 ID 필요'),
  name: z.string().min(1, '이름 필수'),
  rarity: z.string().min(1, '등급 필수'),
  name_kr: z.string().optional().nullable(),
  tier: z.coerce.number().int().positive().optional().nullable(),
  hp: z.coerce.number().int().positive().optional().nullable(),
  speed_min: z.coerce.number().int().min(0).optional().nullable(),
  speed_max: z.coerce.number().int().min(0).optional().nullable(),
  def_level: z.coerce.number().int().min(0).optional().nullable(),
  sin_affinity: z.string().optional().nullable(),
  keywords: z.array(z.string()).optional().nullable(),
  game_id: z.coerce.number().int().optional().nullable(),
  folder_name: z.string().optional().nullable(),
  affiliation: z.string().optional().nullable(),
  quote: z.string().optional().nullable(),
  slash_res: z.coerce.number().int().optional().nullable(),
  pierce_res: z.coerce.number().int().optional().nullable(),
  blunt_res: z.coerce.number().int().optional().nullable(),
  release_date: z.string().optional().nullable(),
  acquisition: z.string().optional().nullable(),
})

export type CreateIdentityInput = z.infer<typeof createIdentitySchema>

// ── EGO ─────────────────────────────────────────────────────────────────────

export const createEgoSchema = z.object({
  sinner_id: z.string().uuid('유효한 수감자 ID 필요'),
  name: z.string().min(1, '이름 필수'),
  grade: z.string().default('ZAYIN'),
  name_kr: z.string().optional().nullable(),
  release_date: z.string().optional().nullable(),
  sin_affinity: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  corrosion_risk: z.coerce.number().int().min(0).optional().nullable(),
  folder_name: z.string().optional().nullable(),
  image_url: z.string().url().optional().nullable().or(z.literal('')),
})

export type CreateEgoInput = z.infer<typeof createEgoSchema>

// ── Announcement ────────────────────────────────────────────────────────────

export const createAnnouncementSchema = z.object({
  title: z.string().min(1, '제목 필수').trim(),
  content: z.string().optional().default(''),
  pinned: z.boolean().optional().default(false),
  lang: z.enum(['ko', 'en', 'ja']).optional().default('ko'),
})

export type CreateAnnouncementInput = z.infer<typeof createAnnouncementSchema>

export const updateAnnouncementSchema = createAnnouncementSchema.partial()
export type UpdateAnnouncementInput = z.infer<typeof updateAnnouncementSchema>

// ── Keyword ─────────────────────────────────────────────────────────────────

export const createKeywordSchema = z.object({
  name: z.string().min(1, '이름 필수').trim(),
  description: z.string().optional().nullable(),
  max_stack: z.coerce.number().int().positive().optional().nullable(),
  icon_slug: z.string().optional().nullable(),
  sin_affinity: z.string().toLowerCase().optional().nullable(),
})

export type CreateKeywordInput = z.infer<typeof createKeywordSchema>

export const updateKeywordSchema = createKeywordSchema.omit({ name: true }).partial()
export type UpdateKeywordInput = z.infer<typeof updateKeywordSchema>

// ── User ────────────────────────────────────────────────────────────────────

export const updateUserRoleSchema = z.object({
  role: z.enum(['user', 'wanjang', 'admin']),
})

export const updateUserSuspensionSchema = z.object({
  suspended: z.boolean(),
  reason: z.string().trim().max(500, '정지 사유는 500자 이하로 입력해주세요.').optional().nullable(),
  suspension_reason: z.string().trim().max(500, '정지 사유는 500자 이하로 입력해주세요.').optional().nullable(),
  suspended_until: z.string().trim().min(1).optional().nullable(),
  suspendedUntil: z.string().trim().min(1).optional().nullable(),
  duration_days: z.coerce.number().int().positive().max(3650).optional().nullable(),
  durationDays: z.coerce.number().int().positive().max(3650).optional().nullable(),
}).superRefine((data, ctx) => {
  if (!data.suspended) return

  const reason = data.reason ?? data.suspension_reason
  if (!reason?.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['reason'],
      message: '정지 사유 필수',
    })
  }

  const until = data.suspended_until ?? data.suspendedUntil
  if (until && Number.isNaN(Date.parse(until))) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['suspended_until'],
      message: '유효한 정지 종료일 필요',
    })
  }
})

// ── Legal documents ─────────────────────────────────────────────────────────

const legalSectionSchema = z.object({
  heading: z.string().trim().min(1, '섹션 제목 필수'),
  body: z.string().optional(),
  items: z.array(z.string()).optional(),
  itemAccent: z.enum(['gold', 'red']).optional(),
})

export const upsertLegalDocSchema = z.object({
  type: z.enum(['privacy', 'terms']),
  title: z.string().trim().min(1, '문서 제목 필수'),
  version: z.string().trim().min(1, '문서 버전 필수').optional(),
  last_updated: z.string().trim().min(1, '최종 수정일 필수'),
  sections: z.array(legalSectionSchema).min(1, '섹션 필수'),
}).transform(data => ({
  ...data,
  version: data.version?.trim() || data.last_updated.trim(),
}))

export type UpsertLegalDocInput = z.infer<typeof upsertLegalDocSchema>

// ── Skill ───────────────────────────────────────────────────────────────────

export const createSkillSchema = z.object({
  identity_id: z.string().uuid(),
  name: z.string().min(1, '스킬명 필수'),
  name_kr: z.string().optional().nullable(),
  skill_type: z.string().optional().nullable(),
  sin_type: z.string().optional().nullable(),
  atk_type: z.string().optional().nullable(),
  offense_level: z.coerce.number().int().optional().nullable(),
  coin_count: z.coerce.number().int().min(0).optional().nullable(),
  coin_power: z.coerce.number().int().optional().nullable(),
  base_power: z.coerce.number().int().optional().nullable(),
  weight: z.coerce.number().int().optional().nullable(),
  uptie_level: z.coerce.number().int().min(3).max(4).optional().nullable(),
  variant_order: z.coerce.number().int().optional().nullable(),
  effects: z.array(z.string()).optional().nullable(),
  coin_effects: z.array(z.string()).optional().nullable(),
})

export type CreateSkillInput = z.infer<typeof createSkillSchema>

// ── Passive ─────────────────────────────────────────────────────────────────

export const createPassiveSchema = z.object({
  identity_id: z.string().uuid(),
  name: z.string().min(1, '패시브명 필수'),
  name_kr: z.string().optional().nullable(),
  passive_type: z.string().optional().nullable(),
  sin_type: z.string().optional().nullable(),
  condition: z.string().optional().nullable(),
  effect: z.string().optional().nullable(),
})

export type CreatePassiveInput = z.infer<typeof createPassiveSchema>

// ── Update schemas (partial versions of create schemas) ─────────────────────

export const updateIdentitySchema = createIdentitySchema.partial()
export type UpdateIdentityInput = z.infer<typeof updateIdentitySchema>

export const updateEgoSchema = createEgoSchema.partial()
export type UpdateEgoInput = z.infer<typeof updateEgoSchema>

export const updateSkillSchema = createSkillSchema.omit({ identity_id: true }).partial()
export type UpdateSkillInput = z.infer<typeof updateSkillSchema>

export const updatePassiveSchema = createPassiveSchema.omit({ identity_id: true }).partial()
export type UpdatePassiveInput = z.infer<typeof updatePassiveSchema>

// ── Shared helper: parse with Zod, return { data, error } ──────────────────

export function parseBody<T>(
  schema: z.ZodSchema<T>,
  body: unknown,
): { data: T; error: null } | { data: null; error: string } {
  const result = schema.safeParse(body)
  if (result.success) return { data: result.data, error: null }
  const messages = result.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join(', ')
  return { data: null, error: messages }
}

// ── Shared helper: parse with Zod, narrowing-safe discriminated union ───────

import { NextResponse } from 'next/server'

/** Parse request body with Zod schema.
 *  Returns `{ success: true, data }` on success or
 *  `{ success: false, response }` with a 400 NextResponse already constructed.
 *  Use `if (!parsed.success) return parsed.response` to early-exit in route handlers.
 */
export function validateBody<T>(
  schema: z.ZodSchema<T>,
  body: unknown,
): { success: true; data: T } | { success: false; response: NextResponse } {
  const result = schema.safeParse(body)
  if (result.success) return { success: true, data: result.data }
  const messages = result.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join(', ')
  return { success: false, response: NextResponse.json({ error: messages }, { status: 400 }) }
}

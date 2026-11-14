import { z } from 'zod'

// ── Revalidate Request Schema ──────────────────────────────────────────────
// POST /api/revalidate body validator.
// 3가지 입력 모두 optional — 모두 비어있으면 빈 응답을 돌려준다.
//
//   tags  : 명시적으로 revalidateTag 할 태그 배열
//   paths : revalidatePath (backward compat)
//   scope : 미리 정의된 번들 (`all-game-data` | `announcements`)

const revalidateScopeSchema = z.enum(['all-game-data', 'announcements'])

export const revalidateBodySchema = z
  .object({
    tags: z.array(z.string().min(1)).max(50).optional(),
    paths: z.array(z.string().min(1)).max(50).optional(),
    scope: revalidateScopeSchema.optional(),
  })
  .strict()

export type RevalidateScope = z.infer<typeof revalidateScopeSchema>

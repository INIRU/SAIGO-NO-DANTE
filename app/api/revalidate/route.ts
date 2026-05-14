import { NextResponse } from 'next/server'
import { revalidatePath, revalidateTag } from 'next/cache'
import { ALL_GAME_DATA_TAGS, CACHE_TAGS } from '@/lib/constants/cache-tags'
import { revalidateBodySchema, type RevalidateScope } from '@/lib/schemas/revalidate'

// Admin-only on-demand revalidation endpoint.
//
// Accepts:
//   - `tags`  : string[] — explicit revalidateTag targets
//   - `paths` : string[] — revalidatePath targets (backward compat)
//   - `scope` : 'all-game-data' | 'announcements' — predefined bundles
//
// Auth: `x-revalidation-secret: ...` or `Authorization: Bearer ...`
// header matches REVALIDATION_SECRET env. Query-string secrets are rejected.
// Called by:
//   - 목요일 sync 스크립트 (scope: 'all-game-data')
//   - admin 공지 수정 훅 (scope: 'announcements')
//   - 수동 운영 (paths / tags 직접 지정)

const ALL_GAME_DATA_PATHS = ['/', '/ko', '/en', '/ja'] as const

function resolveScopeTags(scope: RevalidateScope): readonly string[] {
  if (scope === 'all-game-data') return ALL_GAME_DATA_TAGS
  if (scope === 'announcements') return [CACHE_TAGS.announcements]
  return []
}

function resolveScopePaths(scope: RevalidateScope): readonly string[] {
  if (scope === 'all-game-data') return ALL_GAME_DATA_PATHS
  return []
}

function getBearerToken(value: string | null): string | null {
  const match = value?.match(/^Bearer\s+(.+)$/i)
  return match?.[1] ?? null
}

function hasQuerySecret(request: Request): boolean {
  const { searchParams } = new URL(request.url)
  return searchParams.has('secret')
}

function isAuthorized(request: Request): boolean {
  const expectedSecret = process.env.REVALIDATION_SECRET
  if (!expectedSecret) return false

  const headerSecret = request.headers.get('x-revalidation-secret')
  const bearerToken = getBearerToken(request.headers.get('authorization'))

  return headerSecret === expectedSecret || bearerToken === expectedSecret
}

export async function POST(request: Request) {
  try {
    if (hasQuerySecret(request) || !isAuthorized(request)) {
      return NextResponse.json(
        { error: { code: 'unauthorized', message: 'Invalid secret' } },
        { status: 401 },
      )
    }

    const rawBody: unknown = await request.json().catch(() => ({}))
    const parsed = revalidateBodySchema.safeParse(rawBody)
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: {
            code: 'invalid_input',
            message: 'Invalid request body',
            issues: parsed.error.issues,
          },
        },
        { status: 400 },
      )
    }

    const { tags, paths, scope } = parsed.data

    // scope → 번들 태그로 확장
    const scopeTags = scope ? resolveScopeTags(scope) : []

    // tags (명시 입력) + scopeTags 합친 뒤 중복 제거
    const tagSet = new Set<string>([...(tags ?? []), ...scopeTags])
    const revalidatedTags = Array.from(tagSet)

    for (const tag of revalidatedTags) {
      // Next.js 16: revalidateTag(tag, profile) — 'max' 프로파일로 영구 캐시 무효화
      revalidateTag(tag, 'max')
    }

    const scopePaths = scope ? resolveScopePaths(scope) : []
    const revalidatedPaths = Array.from(new Set<string>([...(paths ?? []), ...scopePaths]))
    for (const path of revalidatedPaths) {
      revalidatePath(path)
    }

    return NextResponse.json({
      revalidated: {
        tags: revalidatedTags,
        paths: revalidatedPaths,
        scope: scope ?? null,
      },
      timestamp: Date.now(),
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal Server Error'
    return NextResponse.json(
      { error: { code: 'internal', message } },
      { status: 500 },
    )
  }
}

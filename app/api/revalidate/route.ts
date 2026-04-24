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
// Auth: `?secret=...` query param matches REVALIDATION_SECRET env.
// Called by:
//   - 목요일 sync 스크립트 (scope: 'all-game-data')
//   - admin 공지 수정 훅 (scope: 'announcements')
//   - 수동 운영 (paths / tags 직접 지정)

function resolveScopeTags(scope: RevalidateScope): readonly string[] {
  if (scope === 'all-game-data') return ALL_GAME_DATA_TAGS
  if (scope === 'announcements') return [CACHE_TAGS.announcements]
  return []
}

export async function POST(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const secret = searchParams.get('secret')

    if (secret !== process.env.REVALIDATION_SECRET) {
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

    const revalidatedPaths = paths ?? []
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

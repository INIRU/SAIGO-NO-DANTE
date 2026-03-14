import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'

const ALLOWED_ORIGINS = [
  'https://saigo-no-dante.com',
  'https://saigo-no-dante.vercel.app',
  'http://localhost:3000',
  'http://localhost:3001',
]

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// 점검 대상에서 제외할 경로 접두사
const MAINTENANCE_SKIP = ['/api', '/admin', '/maintenance', '/login', '/auth', '/_next', '/icons']

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // ── 점검 모드 체크 (페이지 요청만) ──
  if (!MAINTENANCE_SKIP.some(p => pathname.startsWith(p)) && pathname !== '/favicon.ico') {
    try {
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/site_maintenance?is_active=eq.true&select=path,message,reason,ends_at`,
        {
          headers: {
            apikey: SUPABASE_KEY,
            Authorization: `Bearer ${SUPABASE_KEY}`,
            'Accept-Profile': 'limbus',
          },
        },
      )

      if (res.ok) {
        const now = new Date()
        const entries: { path: string; message: string; reason: string; ends_at: string | null }[] = await res.json()
        const matched = entries.find(e => {
          // 종료 시간이 지난 항목은 무시
          if (e.ends_at && new Date(e.ends_at) < now) return false
          return pathname === e.path || pathname.startsWith(e.path + '/')
        })

        if (matched) {
          // 관리자는 점검 우회
          const token = await getToken({ req: request })
          if (!(token as Record<string, unknown>)?.isAdmin) {
            const url = request.nextUrl.clone()
            url.pathname = '/maintenance'
            url.searchParams.set('from', pathname)
            if (matched.message) url.searchParams.set('message', matched.message)
            if (matched.reason) url.searchParams.set('reason', matched.reason)
            if (matched.ends_at) url.searchParams.set('ends_at', matched.ends_at)
            return NextResponse.rewrite(url)
          }
        }
      }
    } catch {
      // 조회 실패 시 차단하지 않음 (fail-open)
    }
  }

  // ── 계정 정지 체크 ──
  // 쓰기 API(POST/PUT/PATCH/DELETE) 또는 보호 페이지 접근 시 정지된 사용자 차단
  const method = request.method
  const isWriteApi = pathname.startsWith('/api/') && method !== 'GET' && !pathname.startsWith('/api/auth/')
  const isSuspendedPage = ['/decks/new', '/mypage'].some(p => pathname.startsWith(p))

  if (isWriteApi || isSuspendedPage) {
    const token = await getToken({ req: request })
    if ((token as Record<string, unknown>)?.isSuspended) {
      if (isWriteApi) {
        return NextResponse.json(
          { error: '계정이 정지되었습니다. 관리자에게 문의하세요.' },
          { status: 403 },
        )
      }
      // 페이지 접근 시 정지 안내로 리다이렉트
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      url.searchParams.set('error', 'suspended')
      return NextResponse.redirect(url)
    }
  }

  // ── API 프록시 보호 ──
  if (!pathname.startsWith('/api/')) return NextResponse.next()
  if (pathname.startsWith('/api/auth/')) return NextResponse.next()

  const origin = request.headers.get('origin')
  const referer = request.headers.get('referer')

  // 서버 내부 호출 (SSR, API 내부 호출) — origin/referer 모두 없음
  if (!origin && !referer) return NextResponse.next()

  if (origin && ALLOWED_ORIGINS.some(o => origin.startsWith(o))) {
    return NextResponse.next()
  }

  if (referer && ALLOWED_ORIGINS.some(o => referer.startsWith(o))) {
    return NextResponse.next()
  }

  return NextResponse.json(
    { error: 'Forbidden' },
    { status: 403 },
  )
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon\\.ico|icons|sw\\.js|manifest).*)'],
}

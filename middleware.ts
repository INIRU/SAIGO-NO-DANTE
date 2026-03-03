import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const ALLOWED_ORIGINS = [
  'https://saigo-no-dante.com',
  'https://saigo-no-dante.vercel.app',
  'http://localhost:3000',
  'http://localhost:3001',
]

export function middleware(request: NextRequest) {
  // API 라우트만 보호 (NextAuth 콜백은 제외)
  if (!request.nextUrl.pathname.startsWith('/api/')) return NextResponse.next()
  if (request.nextUrl.pathname.startsWith('/api/auth/')) return NextResponse.next()

  // GET 요청은 서버 컴포넌트에서도 호출하므로 Origin이 없을 수 있음
  // → Referer 또는 Origin 중 하나라도 있으면 검증, 둘 다 없으면 서버 내부 호출로 간주
  const origin = request.headers.get('origin')
  const referer = request.headers.get('referer')

  // 서버 내부 호출 (SSR, API 내부 호출) — origin/referer 모두 없음
  if (!origin && !referer) return NextResponse.next()

  // Origin 체크
  if (origin && ALLOWED_ORIGINS.some(o => origin.startsWith(o))) {
    return NextResponse.next()
  }

  // Referer 체크
  if (referer && ALLOWED_ORIGINS.some(o => referer.startsWith(o))) {
    return NextResponse.next()
  }

  // 외부 요청 차단
  return NextResponse.json(
    { error: 'Forbidden' },
    { status: 403 },
  )
}

export const config = {
  matcher: '/api/:path*',
}

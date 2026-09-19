import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { checkRateLimit } from '@/lib/rate-limit'
import createMiddleware from 'next-intl/middleware'
import { routing } from './lib/i18n/routing'
import { isAllowedRequestOrigin } from './lib/request-origin'

const intlMiddleware = createMiddleware(routing)

const ALLOWED_ORIGINS = [
  'https://saigo-no-dante.com',
  'https://saigo-no-dante.vercel.app',
  'http://localhost:3000',
  'http://localhost:3001',
]

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
const SUPPORTED_LOCALES = routing.locales
type SupportedLocale = (typeof SUPPORTED_LOCALES)[number]

// 점검 대상에서 제외할 경로 접두사
const MAINTENANCE_SKIP = ['/api', '/admin', '/maintenance', '/login', '/auth', '/_next', '/icons']

// ── 봇/스캐너 프로빙 차단 패턴 ──
const BLOCKED_PATHS = [
  // WordPress
  '/wp-config.php', '/wp-admin', '/wp-login.php', '/wp-content',
  '/wp-includes', '/xmlrpc.php', '/wp-json', '/wp-cron.php',
  // PHP / 서버 설정
  '/phpMyAdmin', '/phpmyadmin', '/pma', '/.htaccess', '/.htpasswd',
  '/server-status', '/server-info', '/web.config',
  // 민감 파일
  '/.env', '/.git', '/.aws', '/.ssh', '/.DS_Store',
  '/config.json', '/config.yml', '/config.yaml',
  // DB 도구
  '/adminer', '/adminer.php',
  // 기타 공격 벡터
  '/cgi-bin', '/backup', '/dump', '/debug', '/console',
  '/telescope', '/.well-known/security.txt',
]

// 확장자 기반 차단 (Next.js에 존재하지 않는 확장자)
const BLOCKED_EXTENSIONS = ['.php', '.asp', '.aspx', '.jsp', '.cgi', '.sql', '.bak', '.swp']

function isBlockedPath(pathname: string): boolean {
  const lower = pathname.toLowerCase()
  if (BLOCKED_PATHS.some(p => lower.startsWith(p.toLowerCase()))) return true
  if (BLOCKED_EXTENSIONS.some(ext => lower.endsWith(ext))) return true
  return false
}

function isSupportedLocale(value: string | undefined): value is SupportedLocale {
  return Boolean(value && (SUPPORTED_LOCALES as readonly string[]).includes(value))
}

function normalizePathname(pathname: string): string {
  const withLeadingSlash = pathname.startsWith('/') ? pathname : `/${pathname}`
  const withoutTrailingSlash = withLeadingSlash.length > 1
    ? withLeadingSlash.replace(/\/+$/, '')
    : withLeadingSlash
  return withoutTrailingSlash || '/'
}

function getLocalizedPathInfo(pathname: string): {
  locale: SupportedLocale | null
  routePathname: string
} {
  const normalizedPathname = normalizePathname(pathname)
  const [, maybeLocale, ...rest] = normalizedPathname.split('/')

  if (!isSupportedLocale(maybeLocale)) {
    return { locale: null, routePathname: normalizedPathname }
  }

  return {
    locale: maybeLocale,
    routePathname: rest.length > 0 ? normalizePathname(`/${rest.join('/')}`) : '/',
  }
}

function hasPathPrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`)
}

function matchesMaintenancePath(routePathname: string, maintenancePath: string): boolean {
  const maintenanceRoutePathname = getLocalizedPathInfo(maintenancePath).routePathname
  if (maintenanceRoutePathname === '/') return true

  return routePathname === maintenanceRoutePathname
    || routePathname.startsWith(`${maintenanceRoutePathname}/`)
}

// 빈 403 응답 (봇에게 최소 정보 노출)
const FORBIDDEN_RESPONSE = new Response(null, { status: 403 })

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const { locale, routePathname } = getLocalizedPathInfo(pathname)

  // ── 1. 봇/스캐너 프로빙 즉시 차단 ──
  if (isBlockedPath(pathname)) {
    return FORBIDDEN_RESPONSE
  }

  // ── 2. Admin 경로 proxy 레벨 보호 ──
  if (hasPathPrefix(routePathname, '/admin')) {
    const token = await getToken({ req: request })
    if (!(token as Record<string, unknown>)?.isAdmin) {
      // 비인증 사용자에게 admin 존재 자체를 숨김 (404)
      return new Response(null, { status: 404 })
    }
  }

  // Creation routes are private; community and database views remain public.
  const isCreationPage = routePathname === '/decks/new' || routePathname === '/planner'
  if (isCreationPage) {
    const token = await getToken({ req: request })
    if (!token || token.isSuspended) {
      const url = request.nextUrl.clone()
      url.pathname = locale ? `/${locale}/login` : '/login'
      url.search = ''
      url.searchParams.set('callbackUrl', pathname + request.nextUrl.search)
      if (token?.isSuspended) url.searchParams.set('error', 'suspended')
      return NextResponse.redirect(url)
    }
  }

  // ── 3. 점검 모드 체크 (페이지 요청만) ──
  if (!MAINTENANCE_SKIP.some(p => hasPathPrefix(routePathname, p)) && pathname !== '/favicon.ico') {
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
          return matchesMaintenancePath(routePathname, e.path)
        })

        if (matched) {
          // 관리자는 점검 우회
          const token = await getToken({ req: request })
          if (!(token as Record<string, unknown>)?.isAdmin) {
            const url = request.nextUrl.clone()
            url.pathname = locale ? `/${locale}/maintenance` : '/maintenance'
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

  // ── 4. 계정 정지 체크 ──
  // 쓰기 API(POST/PUT/PATCH/DELETE) 또는 보호 페이지 접근 시 정지된 사용자 차단
  const method = request.method
  const isWriteApi = pathname.startsWith('/api/') && method !== 'GET' && !pathname.startsWith('/api/auth/')
  const isSuspendedPage = ['/decks/new', '/mypage'].some(p => hasPathPrefix(routePathname, p))

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
      url.pathname = locale ? `/${locale}/login` : '/login'
      url.searchParams.set('error', 'suspended')
      return NextResponse.redirect(url)
    }
  }

  // ── 5. Rate Limiting ──
  // 공개 GET API (scraper 방어용 퍼미시브 제한)
  const PUBLIC_GET_ROUTES = ['/api/search', '/api/keyword-meta', '/api/announcements']
  const isPublicGetApi = method === 'GET' && PUBLIC_GET_ROUTES.some(r => pathname.startsWith(r))

  // SSR 내부 호출(origin/referer 없음)은 rate limit 제외
  const origin = request.headers.get('origin')
  const referer = request.headers.get('referer')
  const isInternalCall = !origin && !referer

  if ((isWriteApi || (isPublicGetApi && !isInternalCall))) {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      ?? request.headers.get('x-real-ip')
      ?? 'unknown'
    const bucket = isWriteApi ? 'write' : 'readonly'
    const { allowed, retryAfter } = checkRateLimit(ip, bucket)
    if (!allowed) {
      return NextResponse.json(
        { error: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.' },
        {
          status: 429,
          headers: { 'Retry-After': String(retryAfter) },
        },
      )
    }
  }

  // ── 6. i18n routing (next-intl middleware) ──
  if (!pathname.startsWith('/api/')) {
    // Migration: carry over legacy preferred_lang cookie → NEXT_LOCALE so
    // returning users aren't dropped to the default locale on first visit.
    const legacyCookie = request.cookies.get('preferred_lang')?.value
    const nextLocaleCookie = request.cookies.get('NEXT_LOCALE')?.value
    if (legacyCookie && !nextLocaleCookie && isSupportedLocale(legacyCookie)) {
      // Clone the request with NEXT_LOCALE set so intlMiddleware picks it up
      const mutableHeaders = new Headers(request.headers)
      mutableHeaders.set(
        'cookie',
        `${request.headers.get('cookie') ?? ''}; NEXT_LOCALE=${legacyCookie}`,
      )
      const patchedRequest = new Request(request.url, {
        headers: mutableHeaders,
        method: request.method,
        body: request.body,
      }) as unknown as NextRequest
      const intlResponse = intlMiddleware(patchedRequest)
      // Also set NEXT_LOCALE on the response to complete the migration
      intlResponse.cookies.set('NEXT_LOCALE', legacyCookie, {
        path: '/',
        maxAge: 365 * 24 * 60 * 60,
        sameSite: 'lax',
      })
      return intlResponse
    }

    return intlMiddleware(request)
  }
  if (pathname.startsWith('/api/auth/')) return NextResponse.next()

  // 서버 내부 호출 (SSR, API 내부 호출) — origin/referer 모두 없음
  if (isInternalCall) return NextResponse.next()

  if (isAllowedRequestOrigin(origin, request.nextUrl.origin, request.headers.get('host'), ALLOWED_ORIGINS)) {
    return NextResponse.next()
  }

  if (isAllowedRequestOrigin(referer, request.nextUrl.origin, request.headers.get('host'), ALLOWED_ORIGINS)) {
    return NextResponse.next()
  }

  return NextResponse.json(
    { error: 'Forbidden' },
    { status: 403 },
  )
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon\\.ico|icons|sw\\.js|manifest|monitoring|.*\\..*).*)'],
}

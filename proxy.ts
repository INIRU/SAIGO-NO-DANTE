import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getToken, type JWT } from 'next-auth/jwt'
import { checkRateLimit } from '@/lib/rate-limit'
import { getClientIp } from '@/lib/request-meta'
import createMiddleware from 'next-intl/middleware'
import { routing } from './lib/i18n/routing'
import { isAllowedRequestOrigin } from './lib/request-origin'
import { PRIMARY_LOCALE } from './lib/seo/metadata'
import { canonicalRedirectUrl } from './lib/seo/canonical-host'
import { isMaintenanceOpen, maintenanceEdgeReadUrl, type MaintenanceEntry } from './lib/maintenance'

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
// matcher가 점이 든 경로(.php, .env, .git 등)를 proxy로 보내지 않으므로, 점 없는 경로만 둔다.
const BLOCKED_PATHS = [
  // WordPress
  '/wp-admin', '/wp-content', '/wp-includes', '/wp-json',
  // PHP / 서버 설정
  '/phpMyAdmin', '/phpmyadmin', '/pma', '/server-status', '/server-info',
  // DB 도구
  '/adminer',
  // 기타 공격 벡터
  '/cgi-bin', '/backup', '/dump', '/debug', '/console', '/telescope',
]

function isBlockedPath(pathname: string): boolean {
  const lower = pathname.toLowerCase()
  return BLOCKED_PATHS.some(p => lower.startsWith(p.toLowerCase()))
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

// 점검 목록은 요청마다 묻지 않고 인스턴스에서 잠시 재사용한다(모든 페이지 이동·미리 불러오기가 여기를 지난다).
// Edge Config가 연결되어 있으면 거기서 읽고(관리자 저장 즉시 갱신), 아니면 Supabase를 읽는다.
// 켜고 끈 점검은 인스턴스마다 최대 60초 늦게 반영된다. 읽기 요금과 맞바꾼 값이다.
const MAINTENANCE_TTL_MS = 60_000
const MAINTENANCE_EDGE_URL = maintenanceEdgeReadUrl()
let maintenanceCache: { at: number; entries: MaintenanceEntry[] } | null = null

async function fetchMaintenance(): Promise<MaintenanceEntry[] | null> {
  if (MAINTENANCE_EDGE_URL) {
    const res = await fetch(MAINTENANCE_EDGE_URL)
    if (res.ok) return await res.json()
    // 항목이 아직 없거나 Edge Config 장애: Supabase로 넘어간다
  }
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/site_maintenance?is_active=eq.true&select=path,message,reason,starts_at,ends_at`,
    { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Accept-Profile': 'limbus' } },
  )
  return res.ok ? await res.json() : null
}

async function activeMaintenance(): Promise<MaintenanceEntry[]> {
  if (maintenanceCache && Date.now() - maintenanceCache.at < MAINTENANCE_TTL_MS) return maintenanceCache.entries
  try {
    const entries = await fetchMaintenance()
    if (!entries) return maintenanceCache?.entries ?? []
    maintenanceCache = { at: Date.now(), entries }
    return maintenanceCache.entries
  } catch {
    // 조회 실패 시 차단하지 않음 (fail-open)
    return maintenanceCache?.entries ?? []
  }
}

// 빈 403 응답 (봇에게 최소 정보 노출)
const FORBIDDEN_RESPONSE = new Response(null, { status: 403 })

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const { locale, routePathname } = getLocalizedPathInfo(pathname)
  // 한 요청 안에서 로그인 토큰은 한 번만 읽는다
  let tokenPromise: Promise<JWT | null> | undefined
  const readToken = () => (tokenPromise ??= getToken({ req: request }))

  // ── 0. http·www → https 본 주소 (검색엔진이 한 주소만 보게) ──
  const canonical = canonicalRedirectUrl(request.headers.get('host'), request.headers.get('cf-visitor'), pathname + request.nextUrl.search)
  if (canonical) return NextResponse.redirect(canonical, 308)

  // ── 1. 봇/스캐너 프로빙 즉시 차단 ──
  if (isBlockedPath(pathname)) {
    return FORBIDDEN_RESPONSE
  }

  // ── 2. Admin 경로 proxy 레벨 보호 ──
  if (hasPathPrefix(routePathname, '/admin')) {
    const token = await readToken()
    if (!(token as Record<string, unknown>)?.isAdmin) {
      // 비인증 사용자에게 admin 존재 자체를 숨김 (404)
      return new Response(null, { status: 404 })
    }
  }

  // Anyone can write decks and plans (guests anonymously, with a browser key); suspended accounts cannot.
  const isCreationPage = routePathname === '/decks/new' || routePathname === '/planner'
  if (isCreationPage) {
    const token = await readToken()
    if (token?.isSuspended) {
      const url = request.nextUrl.clone()
      url.pathname = locale ? `/${locale}/login` : '/login'
      url.search = ''
      url.searchParams.set('callbackUrl', pathname + request.nextUrl.search)
      url.searchParams.set('error', 'suspended')
      return NextResponse.redirect(url)
    }
  }

  // ── 3. 점검 모드 체크 (페이지 요청만) ──
  // The local development server reads the same database: a maintenance set for the live site does not close it.
  if (process.env.NODE_ENV !== 'development' && !MAINTENANCE_SKIP.some(p => hasPathPrefix(routePathname, p)) && pathname !== '/favicon.ico') {
    const entries = await activeMaintenance()
    const now = new Date()
    // 시작 전·종료 후 항목은 무시한다(예약 점검)
    const matched = entries.find(e => isMaintenanceOpen(e, now) && matchesMaintenancePath(routePathname, e.path))

    if (matched) {
      // 관리자는 점검 우회
      const token = await readToken()
      if (!(token as Record<string, unknown>)?.isAdmin) {
        const url = request.nextUrl.clone()
        url.pathname = locale ? `/${locale}/maintenance` : '/maintenance'
        url.search = ''
        url.searchParams.set('from', pathname + request.nextUrl.search)
        if (matched.message) url.searchParams.set('message', matched.message)
        if (matched.reason) url.searchParams.set('reason', matched.reason)
        if (matched.starts_at) url.searchParams.set('starts_at', matched.starts_at)
        if (matched.ends_at) url.searchParams.set('ends_at', matched.ends_at)
        // A redirect, not a rewrite: the server listens on 127.0.0.1, which Next calls localhost in nextUrl, so a
        // rewrite looked like another host and was proxied over https to the plain-http server (500).
        return NextResponse.redirect(url, 307)
      }
    }
  }

  // ── 4. 계정 정지 체크 ──
  // 쓰기 API(POST/PUT/PATCH/DELETE) 또는 보호 페이지 접근 시 정지된 사용자 차단
  const method = request.method
  const isWriteApi = pathname.startsWith('/api/') && method !== 'GET' && !pathname.startsWith('/api/auth/')
  const isSuspendedPage = hasPathPrefix(routePathname, '/mypage')

  if (isWriteApi || isSuspendedPage) {
    const token = await readToken()
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
  // /api/meta/usage counts a filtered scope on every request (filters combine without bound, so those are not cached).
  const PUBLIC_GET_ROUTES = ['/api/search', '/api/keyword-meta', '/api/keyword-descriptions', '/api/announcements', '/api/meta/usage']
  const isPublicGetApi = method === 'GET' && PUBLIC_GET_ROUTES.some(r => pathname.startsWith(r))

  // SSR 내부 호출(origin/referer 없음)은 rate limit 제외
  const origin = request.headers.get('origin')
  const referer = request.headers.get('referer')
  const isInternalCall = !origin && !referer

  if ((isWriteApi || (isPublicGetApi && !isInternalCall))) {
    const ip = getClientIp(request.headers) ?? 'unknown'
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
  if (!hasPathPrefix(pathname, '/api')) {
    // Crawlers send no Accept-Language; next-intl would send them to the 'en' default. Korean is the primary site.
    // 308 only for the bare '/', whose canonical target is /ko; deeper paths keep 307.
    if (!locale && !request.headers.has('accept-language') && !request.cookies.has('NEXT_LOCALE') && !request.cookies.has('preferred_lang')) {
      const url = request.nextUrl.clone()
      url.pathname = `/${PRIMARY_LOCALE}${routePathname === '/' ? '' : routePathname}`
      return NextResponse.redirect(url, routePathname === '/' ? 308 : 307)
    }

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

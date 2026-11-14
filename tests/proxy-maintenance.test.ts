import { afterEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('next-auth/jwt', () => ({ getToken: async () => null }))
// The locale middleware runs after the maintenance check; its ESM build does not load under vitest.
vi.mock('next-intl/middleware', () => ({ default: () => () => new Response(null) }))

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.resetModules() })

describe('a page under maintenance sends the visitor to the maintenance screen', () => {
  it('redirects (relative to the site) instead of rewriting: the self-hosted server listens on 127.0.0.1, which Next renames localhost, so a rewrite went out as an external https proxy and failed', async () => {
    const entry = { path: '/motion', reason: '플레이어 수정', message: '고치는 중', starts_at: null, ends_at: null }
    vi.stubGlobal('fetch', vi.fn(async () => Response.json([entry])))
    const { proxy } = await import('@/proxy')
    const response = await proxy(new NextRequest('https://127.0.0.1:3000/ko/motion/skills?skill=id10101~1010101'))
    expect(response.headers.get('x-middleware-rewrite')).toBeNull()
    expect(response.status).toBe(307)
    const location = new URL(response.headers.get('location')!)
    expect(location.pathname).toBe('/ko/maintenance')
    expect(location.searchParams.get('from')).toBe('/ko/motion/skills?skill=id10101~1010101')
    expect(location.searchParams.get('reason')).toBe('플레이어 수정')
    expect(location.searchParams.get('message')).toBe('고치는 중')
  })

  it('leaves the local development server open while the site is under maintenance (it reads the same database)', async () => {
    vi.stubEnv('NODE_ENV', 'development')
    const fetchMock = vi.fn(async () => Response.json([{ path: '/', reason: null, message: null, starts_at: null, ends_at: null }]))
    vi.stubGlobal('fetch', fetchMock)
    const { proxy } = await import('@/proxy')
    const response = await proxy(new NextRequest('http://localhost:3300/ko/tools/clash'))
    expect(response.headers.get('location')).toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

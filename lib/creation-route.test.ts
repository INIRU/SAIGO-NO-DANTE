import { beforeEach, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
const { token } = vi.hoisted(() => ({ token: vi.fn() }))
vi.mock('next-auth/jwt', () => ({ getToken: token }))
vi.mock('next-intl/middleware', () => ({ default: () => () => new Response(null, {status:200}) }))
import { proxy } from '../proxy'
beforeEach(() => { token.mockResolvedValue(null); vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ok:true,json:async()=>[]})) })
it('guards creation routes in every locale and preserves query return paths', async () => {
  for (const locale of ['ko','en','ja']) for (const path of ['/decks/new?fork=abc','/planner?tab=gift']) {
    const res=await proxy(new NextRequest(`http://localhost:3001/${locale}${path}`))
    const target=new URL(res.headers.get('location')!)
    expect(target.pathname).toBe(`/${locale}/login`)
    expect(target.searchParams.get('callbackUrl')).toBe(`/${locale}${path}`)
  }
})
it('preserves public viewing and allows active sessions, but rejects suspended sessions', async () => {
  for (const path of ['/ko/decks','/ko/decks/abc','/ko/planner/community','/ko/planner/community/abc']) expect((await proxy(new NextRequest(`http://localhost:3001${path}`))).status).toBe(200)
  token.mockResolvedValue({sub:'local-test'})
  expect((await proxy(new NextRequest('http://localhost:3001/ko/planner'))).status).toBe(200)
  token.mockResolvedValue({sub:'local-test',isSuspended:true})
  expect((await proxy(new NextRequest('http://localhost:3001/ko/planner'))).headers.get('location')).toContain('error=suspended')
})

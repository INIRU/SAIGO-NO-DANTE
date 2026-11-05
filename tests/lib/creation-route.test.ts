import { beforeEach, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
const { token } = vi.hoisted(() => ({ token: vi.fn() }))
vi.mock('next-auth/jwt', () => ({ getToken: token }))
vi.mock('next-intl/middleware', () => ({ default: () => () => new Response(null, {status:200}) }))
import { proxy } from '@/proxy'
beforeEach(() => { token.mockResolvedValue(null); vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ok:true,json:async()=>[]})) })
it('opens creation routes to guests in every locale, and sends suspended accounts to login with the return path', async () => {
  for (const locale of ['ko','en','ja']) for (const path of ['/decks/new?fork=abc','/planner?tab=gift']) {
    token.mockResolvedValue(null)
    expect((await proxy(new NextRequest(`http://localhost:3001/${locale}${path}`))).status).toBe(200)
    token.mockResolvedValue({sub:'local-test',isSuspended:true})
    const target=new URL((await proxy(new NextRequest(`http://localhost:3001/${locale}${path}`))).headers.get('location')!)
    expect(target.pathname).toBe(`/${locale}/login`)
    expect(target.searchParams.get('callbackUrl')).toBe(`/${locale}${path}`)
  }
})
it('opens assist mode on every locale site', async () => {
  for (const locale of ['ko','en','ja']) expect((await proxy(new NextRequest(`http://localhost:3001/${locale}/planner/run`))).status).toBe(200)
})
it('preserves public viewing and allows active sessions, but rejects suspended sessions', async () => {
  for (const path of ['/ko/decks','/ko/decks/abc','/ko/planner/community','/ko/planner/community/abc']) expect((await proxy(new NextRequest(`http://localhost:3001${path}`))).status).toBe(200)
  token.mockResolvedValue({sub:'local-test'})
  expect((await proxy(new NextRequest('http://localhost:3001/ko/planner'))).status).toBe(200)
  token.mockResolvedValue({sub:'local-test',isSuspended:true})
  expect((await proxy(new NextRequest('http://localhost:3001/ko/planner'))).headers.get('location')).toContain('error=suspended')
})

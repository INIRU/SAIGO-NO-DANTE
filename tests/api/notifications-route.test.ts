import { beforeEach, expect, it, vi } from 'vitest'
import { NextResponse } from 'next/server'

const calls: { name: string; args: unknown }[] = []
let signedIn = true
let rpcError: { message: string } | null = null
let admin = false
let suspended = false
let inboxError: { message: string } | null = null
const rows = [
  { kind: 'reply', target_type: 'plan', target_id: 'p1', target_title: '플랜', comment_id: 'c2', actor_name: '료슈', actor_avatar: null, excerpt: '답글', created_at: '2026-10-02T12:05:00Z', unread: true },
  { kind: 'comment', target_type: 'deck', target_id: 'd1', target_title: '덱', comment_id: 'c1', actor_name: '돈키', actor_avatar: null, excerpt: '댓글', created_at: '2026-10-02T12:00:00Z', unread: false },
]
const inbox = [
  { kind: 'inquiry', target_type: 'inquiry', target_id: 'q1', target_title: '로그인 오류', comment_id: 'm1', actor_name: '파우스트', actor_avatar: null, excerpt: '문의', created_at: '2026-10-02T12:03:00Z', unread: true },
]
vi.mock('@/lib/auth', () => ({
  requireUser: async () => signedIn
    ? { error: false, session: { user: { email: 'a@b.c', isAdmin: admin, isSuspended: suspended } } }
    : { error: true, response: NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 }) },
}))
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    schema: () => ({ rpc: async (name: string, args: unknown) => {
      calls.push({ name, args })
      const error = rpcError ?? (name === 'admin_inquiry_notifications' ? inboxError : null)
      return { data: error ? null : name === 'user_notifications' ? rows : name === 'admin_inquiry_notifications' ? inbox : null, error }
    } }),
  }),
}))

import { GET, POST } from '@/app/api/notifications/route'

beforeEach(() => { calls.length = 0; signedIn = true; rpcError = null; admin = false; suspended = false; inboxError = null })

it('REQ-COMMUNITY-013 lists the session user\'s notifications with the unread count, uncached', async () => {
  const res = await GET()
  expect(res.headers.get('cache-control')).toBe('private, no-store')
  const body = await res.json()
  expect(calls).toEqual([{ name: 'user_notifications', args: { user_email: 'a@b.c' } }])
  expect(body.unread).toBe(1)
  expect(body.items.map((item: { id: string; href: string }) => [item.id, item.href])).toEqual([
    ['c2', '/planner/community/p1#plan-comments-title'], ['c1', '/decks/d1#deck-comments-title'],
  ])
})

it('REQ-COMMUNITY-013 answers 401 without a session and 500 when the lookup fails', async () => {
  signedIn = false
  expect((await GET()).status).toBe(401)
  expect((await POST()).status).toBe(401)
  expect(calls).toEqual([])
  signedIn = true
  rpcError = { message: 'boom' }
  const res = await GET()
  expect(res.status).toBe(500)
  expect(JSON.stringify(await res.json())).not.toContain('boom')
})

it('REQ-COMMUNITY-017 an administrator also gets the inquiries waiting for an answer, merged newest first', async () => {
  admin = true
  const body = await (await GET()).json()
  expect(calls.map(call => call.name).sort()).toEqual(['admin_inquiry_notifications', 'user_notifications'])
  expect(calls.every(call => JSON.stringify(call.args) === JSON.stringify({ user_email: 'a@b.c' }))).toBe(true)
  expect(body.items.map((item: { id: string; href: string }) => [item.id, item.href])).toEqual([
    ['c2', '/planner/community/p1#plan-comments-title'], ['m1', '/admin/inquiries?id=q1'], ['c1', '/decks/d1#deck-comments-title'],
  ])
  expect(body.unread).toBe(2)
})

it('REQ-COMMUNITY-017 a suspended administrator gets no inquiries, like anyone who is not an administrator', async () => {
  admin = true
  suspended = true
  const body = await (await GET()).json()
  expect(calls.map(call => call.name)).toEqual(['user_notifications'])
  expect(body.items.map((item: { id: string }) => item.id)).toEqual(['c2', 'c1'])
})

it('REQ-COMMUNITY-017 when the inquiry rows cannot be read the administrator still gets the comment notifications', async () => {
  admin = true
  inboxError = { message: 'function limbus.admin_inquiry_notifications does not exist' }
  const logged = vi.spyOn(console, 'error').mockImplementation(() => {})
  const res = await GET()
  expect(res.status).toBe(200)
  expect((await res.json()).items.map((item: { id: string }) => item.id)).toEqual(['c2', 'c1'])
  expect(logged).toHaveBeenCalled()
  logged.mockRestore()
})

it('REQ-COMMUNITY-014 marks the session user\'s notifications read', async () => {
  const res = await POST()
  expect(await res.json()).toEqual({ ok: true })
  expect(calls).toEqual([{ name: 'mark_notifications_read', args: { user_email: 'a@b.c' } }])
  rpcError = { message: 'boom' }
  expect((await POST()).status).toBe(500)
})

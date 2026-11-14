import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fakeDb, type Query, type Reply } from '../../helpers/fake-db'

const state = vi.hoisted(() => ({ reply: (() => undefined) as (query: Query) => Reply | undefined, calls: [] as Query[], discord: [] as unknown[] }))

vi.mock('next/cache', () => ({ revalidateTag: vi.fn() }))
vi.mock('@/lib/auth', () => ({ requireAdmin: async () => ({ error: false }) }))
vi.mock('@/features/admin/server', async () => {
  const { z } = await import('zod')
  return {
    announcementSchema: z.object({ title: z.string(), content: z.string(), published: z.boolean(), discord_everyone: z.boolean().optional() }),
    postAnnouncementToDiscord: async (row: unknown) => { state.discord.push(row); return 'sent' },
  }
})
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => fakeDb(query => state.reply(query), state.calls) }))

import { PATCH } from '@/app/api/admin/announcements/[id]/route'

const ID = '11111111-1111-4111-8111-111111111111'
const patch = () => PATCH(new Request('http://localhost/x', { method: 'PATCH', body: JSON.stringify({ title: 't', content: 'c', published: true }) }), { params: Promise.resolve({ id: ID }) })

beforeEach(() => { state.calls.length = 0; state.discord.length = 0; state.reply = () => undefined })

describe('PATCH /api/admin/announcements/[id]: the read of the saved state', () => {
  it('a failed read of what was published is a 500 and nothing is saved or sent to Discord', async () => {
    state.reply = ({ table, op }) => table === 'announcements' && op === 'select' ? { error: { message: 'down' } } : { data: { id: ID, published: true } }
    const res = await patch()
    expect(res.status).toBe(500)
    expect(await res.json()).toEqual({ error: '공지를 저장하지 못했습니다.' })
    expect(state.calls.some(call => call.op === 'update')).toBe(false)
    expect(state.discord).toEqual([])
  })

  it('sends to Discord when a draft is published', async () => {
    state.reply = ({ table, op }) => table === 'announcements' && op === 'select' ? { data: { published: false } } : { data: { id: ID, published: true } }
    const res = await patch()
    expect(res.status).toBe(200)
    expect(state.discord).toHaveLength(1)
  })

  it('does not send again when it was already published', async () => {
    state.reply = ({ table, op }) => table === 'announcements' && op === 'select' ? { data: { published: true } } : { data: { id: ID, published: true } }
    expect((await patch()).status).toBe(200)
    expect(state.discord).toEqual([])
  })
})

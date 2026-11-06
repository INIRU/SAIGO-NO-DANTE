import { beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({ fail: false }))
vi.mock('@/features/community/server/rising-feed', () => ({
  loadRising: async (kind: string) => { if (state.fail) throw new Error('missing'); return { posts: [{ post: { id: kind }, rise: 120 }], identities: [] } },
}))

import { GET } from '@/app/api/discovery/rising/route'

beforeEach(() => { state.fail = false })

describe('GET /api/discovery/rising', () => {
  it('REQ-COMMUNITY-074 answers a deck or plan board with its risers', async () => {
    const body = await (await GET(new Request('http://localhost/api/discovery/rising?kind=planner'))).json()
    expect(body.posts[0]).toEqual({ post: { id: 'planner' }, rise: 120 })
  })

  it('REQ-COMMUNITY-074 refuses another kind and answers 503 when the count cannot be read', async () => {
    expect((await GET(new Request('http://localhost/api/discovery/rising?kind=identity'))).status).toBe(400)
    state.fail = true
    expect((await GET(new Request('http://localhost/api/discovery/rising?kind=deck'))).status).toBe(503)
  })
})

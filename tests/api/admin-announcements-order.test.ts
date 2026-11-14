import { expect, it, vi } from 'vitest'

const order = vi.fn()
vi.mock('@/lib/auth', () => ({ requireAdmin: async () => ({ error: null }) }))
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    schema: () => ({
      from: () => {
        const query = { select: () => query, order: (...args: unknown[]) => (order(...args), query), limit: async () => ({ data: [], error: null }) }
        return query
      },
    }),
  }),
}))
vi.mock('next/cache', () => ({ revalidateTag: vi.fn() }))

it('the admin announcement list is ordered by creation date, not by last save', async () => {
  const { GET } = await import('@/app/api/admin/announcements/route')
  await GET()
  expect(order).toHaveBeenCalledWith('created_at', { ascending: false })
  expect(order).not.toHaveBeenCalledWith('updated_at', expect.anything())
})

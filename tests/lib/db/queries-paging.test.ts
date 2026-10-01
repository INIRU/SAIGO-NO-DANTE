import { beforeEach, describe, expect, it, vi } from 'vitest'

type Page = { data: { id: string }[] | null; error: { message: string } | null }
let pages: Page[] = []
const calls: { table: string; orders: string[]; range: [number, number] }[] = []

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    schema: () => ({
      from: (table: string) => {
        const call = { table, orders: [] as string[], range: [0, 0] as [number, number] }
        const chain: Record<string, unknown> = {}
        chain.select = () => chain
        chain.order = (column: string) => { call.orders.push(column); return chain }
        chain.range = async (from: number, to: number) => { call.range = [from, to]; calls.push(call); return pages[calls.length - 1] ?? { data: [], error: null } }
        return chain
      },
    }),
  }),
}))

import { getAllPassives, getAllSkills } from '@/lib/db/queries'

const rows = (count: number, start = 0) => Array.from({ length: count }, (_, i) => ({ id: String(start + i) }))

beforeEach(() => { pages = []; calls.length = 0 })

describe('REQ-SHARED-026 reading every skill and passive', () => {
  it('REQ-SHARED-026 joins the pages into one list', async () => {
    pages = [{ data: rows(1000), error: null }, { data: rows(365, 1000), error: null }, { data: [], error: null }]
    expect(await getAllPassives()).toHaveLength(1365)
  })

  it.each([['skills', getAllSkills], ['passives', getAllPassives]] as const)('REQ-SHARED-026 throws when a later page of %s fails instead of returning the rows read so far', async (_table, read) => {
    pages = [{ data: rows(1000), error: null }, { data: null, error: { message: 'timeout' } }]
    await expect(read()).rejects.toThrow(/timeout/)
  })

  it.each([['skills', getAllSkills], ['passives', getAllPassives]] as const)('REQ-SHARED-026 orders %s by id last, so rows with equal sort keys do not move between pages', async (table, read) => {
    pages = [{ data: rows(3), error: null }, { data: [], error: null }]
    await read()
    expect(calls[0].table).toBe(table)
    expect(calls[0].orders.at(-1)).toBe('id')
  })
})

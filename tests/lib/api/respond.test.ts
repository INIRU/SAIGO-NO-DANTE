import { describe, expect, it } from 'vitest'
import { fail } from '@/lib/api/respond'
import { isNoRow } from '@/lib/supabase/no-row'

describe('fail', () => {
  it('answers with the status and { error }', async () => {
    const res = fail(404, 'not found')
    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({ error: 'not found' })
  })

  it('adds code only when there is one', async () => {
    expect(await fail(409, 'taken', 'duplicate_code').json()).toEqual({ error: 'taken', code: 'duplicate_code' })
    expect(Object.keys(await fail(400, 'bad').json())).toEqual(['error'])
  })
})

describe('isNoRow', () => {
  it('is true for a .single() that found no row and for an id that is not a uuid', () => {
    expect(isNoRow({ code: 'PGRST116' })).toBe(true)
    expect(isNoRow({ code: '22P02' })).toBe(true)
  })

  it('is false for a read that failed and for no error', () => {
    expect(isNoRow({ code: '57P01' })).toBe(false)
    expect(isNoRow({})).toBe(false)
    expect(isNoRow(null)).toBe(false)
    expect(isNoRow(undefined)).toBe(false)
  })
})

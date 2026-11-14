import { afterEach, describe, expect, it, vi } from 'vitest'
import { HttpError, fetchJson, sendJson } from '@/lib/utils/http'

afterEach(() => vi.unstubAllGlobals())

const respond = (status: number, body: unknown, rawBody?: string) =>
  vi.fn(async (_url: string, _init?: RequestInit) => new Response(rawBody ?? JSON.stringify(body), { status }))

describe('fetchJson', () => {
  it('returns the parsed body of a successful response and passes the init through', async () => {
    const fetchMock = respond(200, { a: 1 })
    vi.stubGlobal('fetch', fetchMock)
    await expect(fetchJson<{ a: number }>('/api/x', { cache: 'no-store' })).resolves.toEqual({ a: 1 })
    expect(fetchMock).toHaveBeenCalledWith('/api/x', { cache: 'no-store' })
  })

  it('throws an error that carries the status, with the status as its message', async () => {
    vi.stubGlobal('fetch', respond(404, {}))
    const error = (await fetchJson('/api/x').catch(thrown => thrown)) as HttpError
    expect(error).toBeInstanceOf(HttpError)
    expect(error).toBeInstanceOf(Error)
    expect(error.status).toBe(404)
    expect(error.message).toBe('404')
  })

  it('fails the same way the hand-written SWR fetcher did', async () => {
    // components/providers/SWRProvider.tsx before the helper: `throw new Error(`${res.status}`)`.
    const before = (url: string) => fetch(url).then(res => { if (!res.ok) throw new Error(`${res.status}`); return res.json() })
    for (const status of [200, 401, 500]) {
      vi.stubGlobal('fetch', respond(status, { ok: status === 200 }))
      const expected = await before('/api/x').then(value => ({ value }), (error: Error) => ({ message: error.message }))
      const actual = await fetchJson('/api/x').then(value => ({ value }), (error: Error) => ({ message: error.message }))
      expect(actual).toEqual(expected)
    }
  })
})

describe('sendJson', () => {
  it('sends the body as JSON and returns the parsed answer', async () => {
    const fetchMock = respond(200, { done: true })
    vi.stubGlobal('fetch', fetchMock)
    await expect(sendJson('/api/x', 'POST', { code: 'a' })).resolves.toEqual({ done: true })
    expect(fetchMock).toHaveBeenCalledWith('/api/x', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"code":"a"}' })
  })

  it('sends no body when there is none, and adds the given headers', async () => {
    const fetchMock = respond(200, {})
    vi.stubGlobal('fetch', fetchMock)
    await sendJson('/api/x', 'DELETE', undefined, { headers: { 'x-guest': '1' } })
    expect(fetchMock).toHaveBeenCalledWith('/api/x', { method: 'DELETE', headers: { 'Content-Type': 'application/json', 'x-guest': '1' }, body: undefined })
  })

  it('reads an answer that is not JSON as an empty object', async () => {
    vi.stubGlobal('fetch', respond(200, null, 'ok'))
    await expect(sendJson('/api/x', 'POST')).resolves.toEqual({})
  })

  it('throws with the status, and the message the caller builds from the answer', async () => {
    vi.stubGlobal('fetch', respond(409, { code: 'taken', error: 'Already taken' }))
    const error = (await sendJson('/api/x', 'POST', {}, { errorMessage: data => (data as { error?: string }).error ?? 'failed' }).catch(thrown => thrown)) as HttpError
    expect(error).toBeInstanceOf(HttpError)
    expect(error.status).toBe(409)
    expect(error.message).toBe('Already taken')
    vi.stubGlobal('fetch', respond(500, null, 'oops'))
    expect(((await sendJson('/api/x', 'POST').catch(thrown => thrown)) as HttpError).message).toBe('500')
  })
})

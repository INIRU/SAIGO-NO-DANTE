import { describe, it, expect, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'

function worker(cached?: Response, response = new Response('new')) {
  const put = vi.fn().mockResolvedValue(undefined), fetch = vi.fn().mockResolvedValue(response)
  const cache = { match: vi.fn().mockResolvedValue(cached), put, keys: vi.fn().mockResolvedValue([]) }
  const context = { URL, Headers, Response, fetch, caches: { open: vi.fn().mockResolvedValue(cache) }, self: { location: { origin: 'https://site.test' }, addEventListener: vi.fn() } }
  return { api: runInNewContext(readFileSync('public/sw.js','utf8') + '\n;({ classifyRequest, staleWhileRevalidateImage })',context), put, fetch, cache }
}
const cachedAt = (body: string, at: number) => new Response(body, { headers: { 'x-sw-cached-at': String(at) } })

describe('service worker image freshness', () => {
  it('serves cached artwork while revalidating it with the server for the next normal visit', async () => {
    const { api, put, fetch } = worker(new Response('old'))
    const tasks: Promise<unknown>[] = []
    const response = await api.staleWhileRevalidateImage(new Request('https://site.test/icons/art.webp'), { waitUntil: (p: Promise<unknown>) => tasks.push(p) })
    expect(await response.text()).toBe('old')
    await Promise.all(tasks)
    expect(fetch).toHaveBeenCalledOnce()
    // Revalidates past the HTTP cache (a conditional request), otherwise the refresh would return the same stale copy.
    expect(fetch.mock.calls[0][1]).toEqual({ cache: 'no-cache' })
    const stored = put.mock.calls[0][1] as Response
    expect(await stored.text()).toBe('new')
    expect(Number(stored.headers.get('x-sw-cached-at'))).toBeGreaterThan(0)
  })
  it('does not refetch an image cached within the refresh window', async () => {
    const { api, put, fetch } = worker(cachedAt('recent', Date.now() - 60_000))
    const tasks: Promise<unknown>[] = []
    const response = await api.staleWhileRevalidateImage(new Request('https://site.test/_next/image?url=x&w=64&q=75'), { waitUntil: (p: Promise<unknown>) => tasks.push(p) })
    expect(await response.text()).toBe('recent')
    await Promise.all(tasks)
    expect(fetch).not.toHaveBeenCalled()
    expect(put).not.toHaveBeenCalled()
  })
  it('refreshes an image cached before the refresh window', async () => {
    const { api, fetch } = worker(cachedAt('old', Date.now() - 7 * 60 * 60 * 1000))
    const tasks: Promise<unknown>[] = []
    await api.staleWhileRevalidateImage(new Request('https://site.test/_next/image?url=x&w=64&q=75'), { waitUntil: (p: Promise<unknown>) => tasks.push(p) })
    await Promise.all(tasks)
    expect(fetch).toHaveBeenCalledOnce()
  })
  it('answers a cache miss from the network without waiting for the cache write', async () => {
    const { api, put } = worker(undefined)
    let finishWrite: () => void = () => {}
    put.mockReturnValue(new Promise<void>(resolve => { finishWrite = resolve }))
    const tasks: Promise<unknown>[] = []
    const response = await api.staleWhileRevalidateImage(new Request('https://site.test/icons/new.webp'), { waitUntil: (p: Promise<unknown>) => tasks.push(p) })
    expect(await response.text()).toBe('new')
    expect(tasks).toHaveLength(1)
    finishWrite()
    await Promise.all(tasks)
    expect(put).toHaveBeenCalledOnce()
  })
  it('refreshes mutable images but leaves hashed chunks cached and APIs untouched', () => {
    const { api } = worker()
    expect(api.classifyRequest(new Request('https://site.test/_next/image?url=x'))).toBe('stale-while-revalidate')
    expect(api.classifyRequest(new Request('https://site.test/icons/a.webp'))).toBe('stale-while-revalidate')
    expect(api.classifyRequest(new Request('https://site.test/_next/static/hash.js'))).toBe('cache-first-static')
    expect(api.classifyRequest(new Request('https://site.test/api/ego'))).toBe('skip')
  })
  it('leaves opaque storage images to the browser, which the worker could never cache', () => {
    const { api } = worker()
    const storage = 'https://lpgqcleszdlldneiwgep.supabase.co/storage/v1/object/public/limbus-assets/icons/a.webp'
    expect(api.classifyRequest(new Request(storage, { mode: 'no-cors' }))).toBe('skip')
    expect(api.classifyRequest(new Request(storage, { mode: 'cors' }))).toBe('stale-while-revalidate')
  })
})

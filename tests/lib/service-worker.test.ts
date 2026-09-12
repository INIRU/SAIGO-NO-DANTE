import { describe, it, expect, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'

function worker(cached?: Response, response = new Response('new')) {
  const put = vi.fn(), fetch = vi.fn().mockResolvedValue(response)
  const cache = { match: vi.fn().mockResolvedValue(cached), put, keys: vi.fn().mockResolvedValue([]) }
  const context = { URL, Response, fetch, caches: { open: vi.fn().mockResolvedValue(cache) }, self: { location: { origin: 'https://site.test' }, addEventListener: vi.fn() } }
  return { api: runInNewContext(readFileSync('public/sw.js','utf8') + '\n;({ classifyRequest, staleWhileRevalidateImage })',context), put, fetch }
}
describe('service worker image freshness', () => {
  it('serves cached artwork while refreshing it for the next normal visit', async () => {
    const { api, put, fetch } = worker(new Response('old'))
    const tasks: Promise<unknown>[] = []
    const response = await api.staleWhileRevalidateImage(new Request('https://site.test/icons/art.webp'), { waitUntil: (p: Promise<unknown>) => tasks.push(p) })
    expect(await response.text()).toBe('old')
    await Promise.all(tasks)
    expect(fetch).toHaveBeenCalledOnce()
    expect(await put.mock.calls[0][1].text()).toBe('new')
  })
  it('refreshes mutable images but leaves hashed chunks cached and APIs untouched', () => {
    const { api } = worker()
    expect(api.classifyRequest(new Request('https://site.test/_next/image?url=x'))).toBe('stale-while-revalidate')
    expect(api.classifyRequest(new Request('https://site.test/icons/a.webp'))).toBe('stale-while-revalidate')
    expect(api.classifyRequest(new Request('https://site.test/_next/static/hash.js'))).toBe('cache-first-static')
    expect(api.classifyRequest(new Request('https://site.test/api/ego'))).toBe('skip')
  })
})

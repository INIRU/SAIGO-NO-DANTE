import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { createEarlyErrors } from '@/lib/sentry/early'
import { scrubEvent, stripUrlQueries } from '@/lib/sentry/scrub'

const read = (path: string) => readFileSync(resolve(__dirname, '../../..', path), 'utf8')

const errorEvent = (error: unknown) => Object.assign(new Event('error'), { error, message: String(error) })
const rejection = (reason: unknown) => Object.assign(new Event('unhandledrejection'), { reason })

describe('Sentry after the page loads', () => {
  it('REQ-SHARED-088 sends the errors raised before Sentry starts once it starts, once each, in order', () => {
    const early = createEarlyErrors()
    const target = new EventTarget()
    const stop = early.listen(target)
    const first = new Error('first'), second = new Error('second')
    target.dispatchEvent(errorEvent(first))
    target.dispatchEvent(rejection(second))
    early.report('from an error page')
    const sent: unknown[] = []
    stop()
    early.connect(error => sent.push(error))
    expect(sent).toEqual([first, second, 'from an error page'])
    // after the start Sentry's own handlers catch window errors: the early listeners are gone, so nothing is sent twice
    target.dispatchEvent(errorEvent(new Error('later')))
    expect(sent).toHaveLength(3)
    // an error page reports straight to Sentry once it runs
    early.report('after')
    expect(sent.at(-1)).toBe('after')
  })

  it('REQ-SHARED-088 keeps at most 20 early errors (a loop of errors before the start cannot grow the page memory)', () => {
    const early = createEarlyErrors()
    for (let i = 0; i < 50; i++) early.report(i)
    const sent: unknown[] = []
    early.connect(error => sent.push(error))
    expect(sent).toEqual(Array.from({ length: 20 }, (_, i) => i))
  })

  it('REQ-SHARED-088 still strips personal data from every event', () => {
    const event = scrubEvent({
      user: { email: 'a@b.c', ip_address: '1.2.3.4', username: 'x' },
      request: { url: 'https://saigo-no-dante.com/ko/decks?token=1#h', headers: { Authorization: 'Bearer x', Accept: 'text/html' }, cookies: { a: 'b' }, data: 'd', query_string: 'q' },
    })
    expect(event.user).toEqual({})
    expect(event.request).toEqual({ url: 'https://saigo-no-dante.com/ko/decks', headers: { Authorization: '[Filtered]', Accept: 'text/html' } })
  })

  it('REQ-SHARED-088 keeps the Sentry SDK out of every page\'s first load', () => {
    for (const path of ['instrumentation-client.ts', 'app/[lang]/error.tsx', 'app/global-error.tsx']) {
      expect(read(path), path).not.toMatch(/import\s[^;]*from\s*['"]@sentry\/nextjs['"]/)
    }
    const client = read('instrumentation-client.ts')
    expect(client).toMatch(/import\(['"]@\/lib\/sentry\/client-init['"]\)/)
    expect(client).toMatch(/requestIdleCallback/)
    const init = read('lib/sentry/client-init.ts')
    expect(init).toMatch(/beforeSend: scrubEvent/)
    expect(init).toMatch(/beforeSendTransaction: scrubEvent/)
  })
})

describe('URL queries in what the browser Sentry sends', () => {
  it('REQ-SHARED-089 strips queries and fragments from URLs in spans, breadcrumbs and replay URLs', () => {
    const page = 'https://saigo-no-dante.com/ko/decks?q=secret&kw=burn#top'
    const event = stripUrlQueries({
      type: 'transaction',
      spans: [
        { description: `GET https://googleads.g.doubleclick.net/pagead/ads?client=x&url=${encodeURIComponent(page)}`, data: { 'url.full': page, 'http.query': '?q=secret' } },
        { description: 'GET /api/search?q=secret', data: { 'url.path': '/api/search' } },
      ],
      breadcrumbs: [{ category: 'navigation', data: { from: '/ko/decks?q=secret', to: '/ko/planner' } }],
      urls: [page],
      contexts: { trace: { data: { 'url.full': page } } },
    })
    expect(JSON.stringify(event)).not.toMatch(/secret|kw=burn|#top/)
    expect(event.spans[0].description).toBe('GET https://googleads.g.doubleclick.net/pagead/ads')
    expect(event.spans[1].description).toBe('GET /api/search')
    expect(event.urls).toEqual(['https://saigo-no-dante.com/ko/decks'])
    expect(event.breadcrumbs[0].data).toEqual({ from: '/ko/decks', to: '/ko/planner' })
  })

  it('REQ-SHARED-089 survives objects that point back at themselves and leaves the SDK\'s processing data alone', () => {
    // a transaction carries scopes in sdkProcessingMetadata that point at each other: walking them overflowed the stack and
    // the transaction was dropped
    const scope: Record<string, unknown> = { url: '/ko/decks?q=secret' }
    scope.self = scope
    const shared = { description: '/ko/decks?q=secret' }
    const event = stripUrlQueries({ sdkProcessingMetadata: { scope }, spans: [shared, shared], extra: { loop: null as unknown } })
    event.extra.loop = event.extra
    expect(() => stripUrlQueries(event)).not.toThrow()
    expect(event.spans[0].description).toBe('/ko/decks')
    expect(scope.url).toBe('/ko/decks?q=secret')
  })

  it('REQ-SHARED-089 leaves stack frames alone, so source maps still match', () => {
    const frame = { abs_path: 'https://saigo-no-dante.com/_next/static/chunks/a.js?dpl=1', filename: 'a.js?dpl=1' }
    const event = stripUrlQueries({ exception: { values: [{ value: 'x', stacktrace: { frames: [frame] } }] } })
    expect(event.exception.values[0].stacktrace.frames[0]).toEqual(frame)
  })

  it('REQ-SHARED-089 applies to every event (errors, transactions, replays) and to the replay recording\'s custom events', () => {
    const init = read('lib/sentry/client-init.ts')
    expect(init).toMatch(/on\("postprocessEvent", stripUrlQueries\)/)
    expect(init).toMatch(/beforeAddRecordingEvent: stripUrlQueries/)
  })
})

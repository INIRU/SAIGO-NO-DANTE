import { describe, expect, it, vi } from 'vitest'

vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn() }))

const rows: Record<string, object[]> = {
  identities: [{ id: '10101', sinner_id: 'yisang', release_date: '2026-09-10' }],
  ego: [{ id: 'e1', sinner_id: 'faust', release_date: '2026-08-01' }],
  decks: [{ id: 'd1', updated_at: '2026-09-24T12:00:00Z' }],
  md_plans: [{ id: 'p1', updated_at: '2026-09-21T07:35:38Z' }],
}

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    schema: () => ({
      from: (table: string) => {
        const result = { data: rows[table] ?? null, error: rows[table] ? null : { message: `unknown table ${table}` } }
        const query = { select: () => query, order: () => query, limit: () => query, then: (resolve: (value: typeof result) => void) => resolve(result) }
        return query
      },
    }),
  }),
}))

describe('sitemap', () => {
  it('lists only locale-prefixed /ko URLs with en/ja/x-default alternates and real dates', async () => {
    const { default: sitemap } = await import('@/app/sitemap')
    const entries = await sitemap()
    const urls = entries.map(entry => entry.url)

    for (const url of urls) expect(url).toMatch(/^https:\/\/saigo-no-dante\.com\/ko(\/|$)/)
    expect(urls).toContain('https://saigo-no-dante.com/ko')
    expect(urls).toContain('https://saigo-no-dante.com/ko/planner/community/p1')

    const identity = entries.find(entry => entry.url.endsWith('/sinners/yisang/identities/10101'))
    expect(identity?.alternates?.languages).toMatchObject({
      en: 'https://saigo-no-dante.com/en/sinners/yisang/identities/10101',
      ja: 'https://saigo-no-dante.com/ja/sinners/yisang/identities/10101',
      'x-default': 'https://saigo-no-dante.com/ko/sinners/yisang/identities/10101',
    })
    expect(identity?.lastModified).toEqual(new Date('2026-09-10'))
    expect(entries.find(entry => entry.url.endsWith('/ko/terms'))?.lastModified).toBeUndefined()
  })

  it('REQ-SHARED-038 lists the planner, the news calendar and the friend code board, without changefreq or priority', async () => {
    const { default: sitemap } = await import('@/app/sitemap')
    const entries = await sitemap()
    const urls = entries.map(entry => entry.url)

    for (const path of ['/calendar', '/announcements']) expect(urls).toContain(`https://saigo-no-dante.com/ko${path}`)
    expect(new Set(urls).size).toBe(urls.length)
    for (const entry of entries) {
      expect(entry).not.toHaveProperty('changeFrequency')
      expect(entry).not.toHaveProperty('priority')
    }
  })

  it('REQ-SHARED-044 leaves out personal or empty pages while keeping the community board', async () => {
    const { default: sitemap } = await import('@/app/sitemap')
    const urls = (await sitemap()).map(entry => entry.url)

    for (const path of ['/collection', '/friends', '/planner', '/planner/run', '/random', '/login']) expect(urls).not.toContain(`https://saigo-no-dante.com/ko${path}`)
    expect(urls).toContain('https://saigo-no-dante.com/ko/planner/community')
  })
})

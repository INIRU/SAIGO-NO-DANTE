import { describe, expect, it } from 'vitest'
import { ERRORS, NEWS_EXAMPLES, SCOPES, codeSample, endpointsFor } from '@/features/account/lib/api-reference'
import { newsAuthorSchema, newsSchema, newsTextSchema, parseNews } from '@/features/news/lib/payload'

const LANGS = ['ko', 'en', 'ja'] as const
const all = endpointsFor({ catalog: true, news: true })
const news = all.find(endpoint => endpoint.id === 'news')!

describe('developer API reference', () => {
  it('REQ-ACCOUNT-020 lists the endpoints an account may use and nothing about the others', () => {
    const standard = endpointsFor({ catalog: false, news: false })
    expect(standard.map(endpoint => endpoint.id)).toEqual(['decks', 'planners'])
    expect(JSON.stringify(standard)).not.toMatch(/파트너|partner|formation|news/i)
    expect(endpointsFor({ catalog: true, news: false }).map(endpoint => endpoint.id))
      .toEqual(['decks', 'planners', 'identities', 'egos', 'ego-gifts', 'theme-packs', 'md-events', 'keywords'])
    expect(all.slice(-2).map(endpoint => [endpoint.method, endpoint.path])).toEqual([['POST', '/api/v1/news'], ['DELETE', '/api/v1/news']])
    expect(endpointsFor({ catalog: true, news: true })[0].sample).toContain('formation')
  })

  it('REQ-ACCOUNT-020 describes every endpoint, field and error in ko, en and ja with a response that parses', () => {
    for (const endpoint of all) {
      for (const lang of LANGS) {
        expect(endpoint.name[lang] && endpoint.summary[lang]).toBeTruthy()
        for (const field of [...endpoint.params, ...(endpoint.body ?? [])]) expect(field.text[lang], `${endpoint.id}.${field.name}`).toBeTruthy()
      }
      expect(() => JSON.parse(endpoint.sample)).not.toThrow()
      expect(endpoint.errors.length).toBeGreaterThan(0)
      for (const status of endpoint.errors) for (const lang of LANGS) expect(ERRORS[status][lang]).toBeTruthy()
    }
    for (const scope of ['catalog:read', 'news:write'] as const) for (const lang of LANGS) expect(SCOPES[scope][lang]).toBeTruthy()
    // The identity example is the one-item read, so the skills of more than one uptie level are visible.
    const identity = JSON.parse(all.find(endpoint => endpoint.id === 'identities')!.sample).data[0]
    expect(new Set(identity.skills.map((skill: { uptie_level: number }) => skill.uptie_level)).size).toBeGreaterThan(1)
  })

  it('REQ-ACCOUNT-020 documents exactly the news fields the validation accepts', () => {
    const names = news.body!.map(field => field.name)
    const under = (prefix: string) => names.filter(name => name.startsWith(prefix) && !name.slice(prefix.length).includes('.')).map(name => name.slice(prefix.length))
    expect(names.filter(name => !name.includes('.'))).toEqual(Object.keys(newsSchema.shape))
    expect(under('content.{lang}.')).toEqual(Object.keys(newsTextSchema.shape))
    expect(under('author.')).toEqual(Object.keys(newsAuthorSchema.shape))
    const required = news.body!.filter(field => field.required).map(field => field.name)
    expect(required).toEqual(['id', 'feed', 'platform', 'published_at', 'author.name', 'content', 'content.{lang}.title', 'content.{lang}.media[].type'])
    expect(parseNews(JSON.parse(news.bodySample!)).ok).toBe(true)
  })

  it('REQ-ACCOUNT-020 gives an example that passes validation for every kind of news the bot sends', () => {
    const bodies = NEWS_EXAMPLES.map(example => {
      const result = parseNews(example.body)
      expect(result.ok, `${example.id}: ${result.ok ? '' : JSON.stringify(result.issues)}`).toBe(true)
      for (const lang of LANGS) expect(example.name[lang] && example.note[lang]).toBeTruthy()
      return example.body as { feed: string; platform: string }
    })
    expect(new Set(bodies.map(body => body.feed))).toEqual(new Set(['limbus', 'project_moon', 'hampang']))
    expect(new Set(bodies.map(body => body.platform))).toEqual(new Set(['steam', 'x', 'youtube', 'chzzk', 'partner']))
  })

  it('REQ-ACCOUNT-020 writes the request in curl, Python and JavaScript', () => {
    const request = { method: 'POST', url: 'https://saigo-no-dante.com/api/v1/news?dry_run=1', body: { spoiler: false, ends_at: null, title: "it's", ok: true } }
    const curl = codeSample('curl', request)
    expect(curl).toContain('curl -X POST "https://saigo-no-dante.com/api/v1/news?dry_run=1"')
    expect(curl).toContain('-H "Authorization: Bearer YOUR_API_KEY"')
    expect(curl).toContain(`"title": "it'\\''s"`)
    const python = codeSample('python', request)
    expect(python).toContain('requests.post(')
    expect(python).toMatch(/"spoiler": False,\s+"ends_at": None,/)
    expect(python).toContain('"ok": True')
    const javascript = codeSample('javascript', request, 'lmb_test')
    expect(javascript).toContain('method: "POST"')
    expect(javascript).toContain('Authorization: "Bearer lmb_test"')
    expect(javascript).toContain('body: JSON.stringify({')
    const get = codeSample('curl', { method: 'GET', url: 'https://saigo-no-dante.com/api/v1/decks?limit=20' })
    expect(get).toBe('curl "https://saigo-no-dante.com/api/v1/decks?limit=20" \\\n  -H "Authorization: Bearer YOUR_API_KEY"')
    expect(codeSample('python', { method: 'GET', url: 'https://x/api/v1/decks' })).not.toContain('json=')
  })
})

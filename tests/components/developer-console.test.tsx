import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const m = vi.hoisted(() => ({ status: 'authenticated', data: undefined as unknown }))
vi.mock('next-intl', () => ({ useLocale: () => 'ko' }))
vi.mock('next-auth/react', () => ({ useSession: () => ({ status: m.status }) }))
vi.mock('swr', () => ({ default: (key: string | null) => ({ data: key ? m.data : undefined, mutate: async () => {}, isLoading: false }) }))
vi.mock('@/lib/i18n/navigation', () => ({ Link: 'a' }))
vi.mock('@/hooks/useHtmlFlag', () => ({ useHtmlFlag: () => {} }))
vi.mock('@/lib/auth-return', () => ({ goToLogin: () => {} }))

import DeveloperConsole from '@/app/[lang]/developers/DeveloperConsole'
import { resourcesFor, usageByDay } from '@/app/[lang]/developers/api-reference'

const today = new Date().toISOString().slice(0, 10)
const keys = [
  { id: 'k1', name: '운영', prefix: 'lmb_11111111', revoked_at: null, developer_usage: [{ day: today, requests: 1234 }, { day: '2026-01-01', requests: 4000 }] },
  { id: 'k2', name: '예전', prefix: 'lmb_22222222', revoked_at: '2026-01-02T00:00:00Z', developer_usage: [{ day: today, requests: 6 }] },
]
const render = () => renderToStaticMarkup(<DeveloperConsole />)

beforeEach(() => { m.status = 'authenticated'; m.data = { keys, partner: null } })

describe('developer console', () => {
  it('REQ-ACCOUNT-016 shows the partner plate, partner limits and partner data only to a partner account', () => {
    const standard = render()
    expect(standard).not.toContain('협업 서포터')
    expect(standard).toContain('10,000')
    expect(standard).not.toContain('제한 없음')
    expect(standard).not.toContain('>인격<')
    expect(resourcesFor(false).map(resource => resource.id)).toEqual(['decks', 'planners'])
    expect(JSON.stringify(resourcesFor(false))).not.toMatch(/파트너|partner|formation/i)

    m.data = { keys, partner: 'discord_bot' }
    const partner = render()
    expect(partner).toContain('협업 서포터')
    expect(partner).toContain('Discord 봇')
    expect(partner).toContain('제한 없음')
    expect(partner).toContain('>600<')
    expect(partner).not.toContain('10,000')
    for (const name of ['덱', '플랜', '인격', 'E.G.O', '기프트', '테마팩', '거던 이벤트', '키워드']) expect(partner).toContain(`>${name}<`)
    expect(resourcesFor(true).map(resource => resource.id)).toEqual(['decks', 'planners', 'identities', 'egos', 'ego-gifts', 'theme-packs', 'md-events', 'keywords'])
  })

  it('REQ-ACCOUNT-017 shows the request address, options and a response example for every resource', () => {
    const html = render()
    expect(html).toContain('GET /api/v1/decks?limit=20&amp;sort=popular')
    for (const option of ['limit', 'offset', 'q', 'sort', 'id']) expect(html).toContain(`<code>${option}</code>`)
    for (const partner of [false, true]) for (const resource of resourcesFor(partner)) {
      expect(resource.params.length).toBeGreaterThan(0)
      expect(() => JSON.parse(resource.sample)).not.toThrow()
      for (const lang of ['ko', 'en', 'ja'] as const) expect(resource.name[lang] && resource.summary[lang]).toBeTruthy()
    }
    expect(resourcesFor(true)[0].sample).toContain('formation')
  })

  it('REQ-ACCOUNT-017 shows requests per key and per recent day', () => {
    const html = render()
    expect(html).toContain('>1,234<')
    expect(html).toContain('>5,234<')
    expect(html).toContain(`${today} 1,240`)
    expect(usageByDay(keys, '2026-01-03', 3)).toEqual([{ day: '2026-01-01', requests: 4000 }, { day: '2026-01-02', requests: 0 }, { day: '2026-01-03', requests: 0 }])
  })

  it('REQ-ACCOUNT-016 asks a signed-out visitor to sign in and still shows the standard limits', () => {
    m.status = 'unauthenticated'
    const html = render()
    expect(html).toContain('로그인 후 키 발급')
    expect(html).toContain('10,000')
    expect(html).not.toContain('협업 서포터')
  })
})

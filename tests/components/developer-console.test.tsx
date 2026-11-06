import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const m = vi.hoisted(() => ({ status: 'authenticated', data: undefined as unknown, query: '' }))
vi.mock('next-intl', () => ({ useLocale: () => 'ko' }))
vi.mock('next-auth/react', () => ({ useSession: () => ({ status: m.status }) }))
vi.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams(m.query), usePathname: () => '/ko/developers' }))
vi.mock('swr', () => ({ default: (key: string | null) => ({ data: key ? m.data : undefined, mutate: async () => {}, isLoading: false }) }))
vi.mock('@/lib/i18n/navigation', () => ({ Link: 'a', useRouter: () => ({ replace: () => {} }) }))
vi.mock('@/hooks/useHtmlFlag', () => ({ useHtmlFlag: () => {} }))
vi.mock('@/lib/auth-return', () => ({ goToLogin: () => {} }))
vi.mock('@/lib/toast', () => ({ showSuccess: () => {}, showError: () => {} }))

import DeveloperConsole from '@/app/[lang]/developers/DeveloperConsole'
import { usageByDay } from '@/app/[lang]/developers/api-reference'

const today = new Date().toISOString().slice(0, 10)
const keys = [
  { id: 'k1', name: '운영', prefix: 'lmb_11111111', revoked_at: null, developer_usage: [{ day: today, requests: 1234 }, { day: '2026-01-01', requests: 4000 }] },
  { id: 'k2', name: '예전', prefix: 'lmb_22222222', revoked_at: '2026-01-02T00:00:00Z', developer_usage: [{ day: today, requests: 6 }] },
]
const limpi = { code: 'limpi', name: '림피', scopes: ['catalog:read', 'news:write'] }
const render = (query = '') => { m.query = query; return renderToStaticMarkup(<DeveloperConsole />) }
const tabs = (html: string) => [...html.matchAll(/role="tab"[^>]*aria-label="([^"]+)"/g)].map(match => match[1])

beforeEach(() => { m.status = 'authenticated'; m.data = { keys, partner: null, admin: false } })

describe('developer console', () => {
  it('REQ-ACCOUNT-019 splits the tools into tabs kept in the address and opens on the guide', () => {
    const html = render()
    expect(tabs(html)).toEqual(['시작하기', 'API 문서', '테스트', '키와 사용량'])
    expect(html).toMatch(/aria-selected="true"[^>]*aria-label="시작하기"/)
    expect(html).toContain('첫 요청 보내기')
    expect(render('tab=keys')).toMatch(/aria-selected="true"[^>]*aria-label="키와 사용량"/)
    expect(render('tab=docs&item=planners')).toContain('/api/v1/planners')
    // An unknown tab, or the partner tab for an account that is not one, opens the guide.
    for (const query of ['tab=nope', 'tab=partner']) expect(render(query)).toMatch(/aria-selected="true"[^>]*aria-label="시작하기"/)
  })

  it('REQ-ACCOUNT-016 shows the partner name, code, limits and data only to a partner account', () => {
    const standard = render('tab=keys')
    expect(standard).not.toContain('협업 파트너')
    expect(standard).toContain('10,000')
    expect(standard).not.toContain('제한 없음')
    expect(render('tab=docs')).not.toContain('>인격<')

    m.data = { keys, partner: limpi, admin: false }
    const partner = render('tab=keys')
    expect(tabs(partner)).toEqual(['시작하기', 'API 문서', '테스트', '키와 사용량', '파트너'])
    for (const text of ['협업 파트너', '림피', 'limpi', '제한 없음', '>600<']) expect(partner).toContain(text)
    expect(partner).not.toContain('10,000')
    const docs = render('tab=docs')
    for (const name of ['덱', '플랜', '인격', 'E.G.O', '기프트', '테마팩', '거던 이벤트', '키워드', '소식 보내기', '소식 지우기']) expect(docs).toContain(`>${name}<`)
    const tab = render('tab=partner')
    for (const text of ['게임 데이터와 덱·플랜 상세 읽기', '캘린더에 소식 보내기와 지우기', 'Steam 공지', '햄햄팡팡 (X)', '점검 알림', 'steam:5124582150142200443']) expect(tab).toContain(text)
  })

  it('REQ-ACCOUNT-017 shows the request address, options and a response example for a resource', () => {
    const html = render('tab=docs&item=decks')
    expect(html).toContain('https://saigo-no-dante.com/api/v1/decks?limit=20&amp;sort=popular')
    for (const option of ['limit', 'offset', 'q', 'sort', 'id']) expect(html).toContain(`>${option}</code>`)
    expect(html).toContain('nextOffset')
  })

  it('REQ-ACCOUNT-017 shows requests per key and per recent day', () => {
    const html = render('tab=keys')
    expect(html).toContain('>1,234<')
    expect(html).toContain('>5,234<')
    expect(html).toContain(`${today} 1,240`)
    expect(usageByDay(keys, '2026-01-03', 3)).toEqual([{ day: '2026-01-01', requests: 4000 }, { day: '2026-01-02', requests: 0 }, { day: '2026-01-03', requests: 0 }])
  })

  it('REQ-ACCOUNT-016 asks a signed-out visitor to sign in and still shows the standard limits', () => {
    m.status = 'unauthenticated'
    const html = render('tab=keys')
    expect(html).toContain('로그인 후 키 발급')
    expect(html).toContain('10,000')
    expect(html).not.toContain('협업 파트너')
  })

  it('REQ-ACCOUNT-020 documents the news endpoint with its method, fields, code in three languages and errors', () => {
    m.data = { keys, partner: limpi, admin: false }
    const html = render('tab=docs&item=news')
    expect(html).toContain('>POST<')
    expect(html).toContain('/api/v1/news')
    for (const field of ['published_at', 'content.{lang}.title', 'content.{lang}.media[].type', 'dry_run']) expect(html).toContain(`>${field}</code>`)
    expect(html).toContain('>필수<')
    for (const kind of ['curl', 'Python', 'JavaScript']) expect(html).toContain(`>${kind}<`)
    expect(html).toContain('curl -X POST')
    for (const status of [400, 401, 403, 413, 429, 503]) expect(html).toContain(`>${status}<`)
    expect(html).toContain('본문 64KB 초과')
  })

  it('REQ-ACCOUNT-021 offers a request form with an unsaved key field, and dry-runs news by default', () => {
    m.data = { keys, partner: limpi, admin: false }
    const html = render('tab=test&item=news')
    expect(html).toMatch(/<input[^>]*type="password"[^>]*autoComplete="off"|<input[^>]*autoComplete="off"[^>]*type="password"/i)
    expect(html).toContain('요청 보내기')
    expect(html).toContain('curl 복사')
    expect(html).toMatch(/<input[^>]*type="checkbox"[^>]*checked=""/)
    expect(html).toContain('시험 전송')
    expect(html).toContain('steam:5124582150142200443')
    const read = render('tab=test&item=decks')
    expect(read).not.toContain('type="checkbox"')
    expect(read).toContain('value="20"')
  })

  it('REQ-ACCOUNT-022 shows every tab and every document to an administrator who is not a partner', () => {
    m.data = { keys, partner: null, admin: true }
    expect(tabs(render())).toEqual(['시작하기', 'API 문서', '테스트', '키와 사용량', '파트너'])
    const docs = render('tab=docs&item=news')
    for (const name of ['인격', '소식 보내기']) expect(docs).toContain(`>${name}<`)
    const partner = render('tab=partner')
    expect(partner).toContain('관리자 보기')
    expect(partner).toContain('Steam 공지')
  })
})

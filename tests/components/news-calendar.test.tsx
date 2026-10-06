import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ko from '@/messages/ko.json'
import en from '@/messages/en.json'
import ja from '@/messages/ja.json'

const m = vi.hoisted(() => ({ lang: 'ko', admin: false }))
vi.mock('next-intl', () => ({
  useLocale: () => m.lang,
  useTranslations: (namespace: 'calendar') => (key: string, values?: Record<string, unknown>) => {
    const text = key.split('.').reduce<unknown>((node, part) => (node as Record<string, unknown>)?.[part], ({ ko, en, ja } as Record<string, Record<string, unknown>>)[m.lang][namespace])
    return String(text).replace(/\{(\w+)\}/g, (_, name) => String(values?.[name]))
  },
}))
vi.mock('next-auth/react', () => ({ useSession: () => ({ data: { user: { isAdmin: m.admin } } }) }))
vi.mock('next/image', () => ({ default: ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} /> }))
vi.mock('@/lib/i18n/navigation', () => ({ useRouter: () => ({ push: () => {}, refresh: () => {} }) }))
vi.mock('@/lib/toast', () => ({ showSuccess: () => {}, showError: () => {} }))
vi.mock('@/components/ui/ConfirmModal', () => ({ default: () => null }))
vi.mock('@/components/ui/BaseModal', () => ({ default: ({ open, children }: { open: boolean; children: React.ReactNode }) => (open ? <div role="dialog">{children}</div> : null) }))

import NewsCalendar from '@/components/news/NewsCalendar'
import type { NewsItem } from '@/lib/news/payload'

const text = (title: string, more: Partial<NewsItem['content']['ko'] & object> = {}) => ({ title, body: '', url: null, media: [], translated: false, ...more })
const item = (id: string, more: Partial<NewsItem>): NewsItem => ({
  id, partner: 'limpi', external_id: id, feed: 'limbus', platform: 'steam', category: 'notice', published_at: '2026-10-06T18:00:00+09:00',
  starts_at: null, ends_at: null, spoiler: false, author: null, content: { ko: text(id) }, ...more,
})
const items = [
  item('steam-notice', { category: 'update', content: { ko: text('정기 점검 안내', { body: '첫 줄\n둘째 줄', url: 'https://store.steampowered.com/news/1', media: [{ type: 'image', url: 'https://clan.fastly.steamstatic.com/images/1/a.png' }] }), en: text('Scheduled maintenance', { translated: true, url: 'https://store.steampowered.com/news/1?l=english' }) } }),
  item('ham-video', { feed: 'hampang', platform: 'youtube', category: 'video', published_at: '2026-10-06T09:00:00+09:00', author: { name: '햄햄팡팡', handle: 'Ham_PangPang', url: null }, content: { ko: text('신메뉴 영상', { media: [{ type: 'youtube', id: 'dQw4w9WgXcQ' }] }) } }),
  item('spoiler-pv', { platform: 'x', spoiler: true, published_at: '2026-10-06T12:00:00+09:00', content: { ko: text('신규 인격 PV', { media: [{ type: 'image', url: 'https://pbs.twimg.com/media/secret.jpg' }] }) } }),
  item('pm-goods', { feed: 'project_moon', platform: 'x', published_at: '2026-10-04T23:30:00+09:00', content: { ko: text('굿즈 예약 안내') } }),
]
const render = (props: Partial<Parameters<typeof NewsCalendar>[0]> = {}) => renderToStaticMarkup(<NewsCalendar month="2026-10" today="2026-10-06" date={null} feed="all" items={items} {...props} />)

beforeEach(() => { m.lang = 'ko'; m.admin = false })

describe('news calendar', () => {
  it('REQ-NEWS-009 opens on the month with today marked and the days that have news, nothing opened', () => {
    const html = render()
    for (const shown of ['소식 캘린더', '2026년 10월', '림피가 전한 소식', '/assets/limpi/runner.png', '/assets/news/feed-limbus.png', '/assets/news/feed-hampang.png']) expect(html).toContain(shown)
    expect(html).toMatch(/<button[^>]*aria-pressed="false"[^>]*aria-current="date"[^>]*aria-label="10월 6일 화요일, 3건"/)
    expect(html).toMatch(/<button[^>]*aria-label="10월 4일 일요일, 1건"/)
    // A day without news is not a button, and each day lists its titles.
    expect(html).not.toContain('aria-label="10월 7일 수요일')
    for (const title of ['정기 점검 안내', '신메뉴 영상', '굿즈 예약 안내']) expect(html).toContain(`>${title}</span>`)
    expect(html).not.toContain('role="dialog"')
    expect(html).not.toContain('원문 보기')
  })

  it('REQ-NEWS-009 shows a day in full when it is opened: title, body, author, source, time, media and the original', () => {
    const html = render({ date: '2026-10-06' })
    expect(html).toMatch(/<button[^>]*aria-pressed="true"[^>]*aria-label="10월 6일 화요일, 3건"/)
    const dialog = html.slice(html.indexOf('role="dialog"'))
    for (const shown of ['10월 6일 화요일', '정기 점검 안내</h3>', '첫 줄\n둘째 줄', '신메뉴 영상</h3>', '햄햄팡팡', '@Ham_PangPang', '>Steam<', '>YouTube<', '>업데이트<', '>18:00<', '>09:00<', '원문 보기'])
      expect(dialog).toContain(shown)
    expect(dialog).toContain('href="https://store.steampowered.com/news/1"')
    expect(dialog).toContain('src="https://clan.fastly.steamstatic.com/images/1/a.png"')
    expect(dialog).toContain('https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg')
    expect(dialog).not.toContain('굿즈 예약 안내')
    expect(dialog).not.toContain('>삭제<')
    m.admin = true
    expect(render({ date: '2026-10-06' })).toContain('>삭제<')
  })

  it('REQ-NEWS-009 handles a day with nothing, a day of another month and a failed read', () => {
    const empty = render({ date: '2026-10-07' })
    expect(empty.slice(empty.indexOf('role="dialog"'))).toContain('소식 없음')
    expect(render({ date: '2026-09-30' })).not.toContain('role="dialog"')
    expect(render({ items: null })).toContain('소식을 불러오지 못했습니다.')
    // Away from the current month, a button leads back to today.
    expect(render()).not.toContain('>오늘<')
    expect(render({ today: '2026-11-02' })).toContain('>오늘<')
  })

  it('REQ-NEWS-009 writes its own text in ko, en and ja and marks a machine translation', () => {
    m.lang = 'en'
    const english = render({ date: '2026-10-06' })
    for (const shown of ['News calendar', 'News from Limpi', 'October 2026', 'Scheduled maintenance', 'Machine translated', 'Open original']) expect(english).toContain(shown)
    // No English text for this item, so the Korean is shown.
    expect(english).toContain('신메뉴 영상')
    m.lang = 'ja'
    const japanese = render({ date: '2026-10-07' })
    for (const shown of ['ニュースカレンダー', 'リンピが届けたニュース', '2026年10月', 'ニュースなし']) expect(japanese).toContain(shown)
  })

  it('REQ-NEWS-010 keeps only the chosen feed on the calendar and in the opened day', () => {
    const html = render({ feed: 'hampang', date: '2026-10-06' })
    expect(html).toMatch(/aria-pressed="true"[^>]*>(<img[^>]*>)?햄햄팡팡</)
    expect(html).toContain('aria-label="10월 6일 화요일, 1건"')
    expect(html).not.toContain('aria-label="10월 4일 일요일')
    expect(html).toContain('신메뉴 영상')
    expect(html).not.toContain('정기 점검 안내')
    expect(render()).toMatch(/aria-pressed="true"[^>]*>전체</)
  })

  it('REQ-NEWS-010 covers the media of a spoiler item until it is asked for', () => {
    const html = render({ date: '2026-10-06' })
    expect(html).toContain('신규 인격 PV</h3>')
    expect(html).toContain('스포일러 보기')
    expect(html).not.toContain('secret.jpg')
  })
})

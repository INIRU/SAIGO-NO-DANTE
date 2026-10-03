import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import type { Notification } from '@/lib/notifications'

// `pathname: null` stands for a route whose params are unknown while prerendering: reading it there never returns.
const nav = vi.hoisted(() => ({ pathname: null as string | null }))
const feed = vi.hoisted(() => ({ items: [] as Notification[], unread: 0 }))
const auth = vi.hoisted(() => ({ status: 'authenticated' as 'authenticated' | 'loading', supportUnread: false }))
vi.mock('@/lib/i18n/navigation', async () => {
  const { use } = await import('react')
  const hang = new Promise<never>(() => {})
  const read = () => (nav.pathname === null ? use(hang) : nav.pathname)
  return { usePathname: read, useRouter: () => { read(); return { replace: vi.fn() } } }
})
vi.mock('next-intl', () => ({
  // t('key', values) and t.rich('key', values) both print the key and the plain values (tag functions are left out).
  useTranslations: (namespace?: string) => {
    const t = (key: string, values?: Record<string, unknown>) => [namespace, key].filter(Boolean).join('.') + (values ? JSON.stringify(values) : '')
    return Object.assign(t, { rich: t })
  },
  useLocale: () => 'ko',
}))
vi.mock('next-auth/react', () => ({
  useSession: () => (auth.status === 'authenticated' ? { data: { user: { email: 'a@b.c' } }, status: 'authenticated' } : { data: null, status: 'loading' }),
  signOut: vi.fn(),
}))
vi.mock('@/hooks/useSupportUnread', () => ({ useSupportUnread: () => auth.supportUnread }))
vi.mock('@/hooks/useNotifications', () => ({ useNotifications: () => ({ ...feed, open: vi.fn() }) }))
vi.mock('@/components/community/easterEggs', () => ({ useTapEgg: () => () => {} }))
vi.mock('next/dynamic', async () => {
  const { lazy } = await import('react')
  return { default: (loader: () => Promise<{ default: React.ComponentType }>) => lazy(loader) }
})
vi.mock('@/components/ui/SearchModal', async () => {
  await new Promise(() => {})
  return { default: () => null }
})
// eslint-disable-next-line @next/next/no-img-element
vi.mock('next/image', () => ({ default: ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} /> }))

const items: Notification[] = [
  { id: 'c2', kind: 'reply', target: 'plan', href: '/planner/community/p1#plan-comments-title', title: '화상 플랜', actor: '료슈', avatar: null, excerpt: '답글 내용', at: '2026-10-02T12:05:00Z', unread: true },
  { id: 'c1', kind: 'comment', target: 'deck', href: '/decks/d1#deck-comments-title', title: '출혈 덱', actor: null, avatar: null, excerpt: '댓글 내용', at: '2026-10-02T12:00:00Z', unread: false },
]

beforeEach(() => { nav.pathname = null; feed.items = []; feed.unread = 0; auth.status = 'authenticated'; auth.supportUnread = false })

describe('REQ-COMMUNITY-015 the navbar bell shows unread notifications and its panel lists them', () => {
  it('REQ-COMMUNITY-015 the list links each item to its post\'s comments and names only unread ones as new', async () => {
    const { NotificationList } = await import('@/components/layout/NavNotifications')
    const html = renderToStaticMarkup(<NotificationList items={items} onNavigate={() => {}} />)
    expect(html).toContain('href="/ko/planner/community/p1#plan-comments-title"')
    expect(html).toContain('href="/ko/decks/d1#deck-comments-title"')
    for (const text of ['료슈', 'notifications.someone', 'notifications.reply', 'notifications.comment', '출혈 덱', '답글 내용', '댓글 내용']) expect(html).toContain(text)
    expect(html.match(/notifications\.new</g)).toHaveLength(1)
  })

  it('REQ-COMMUNITY-015 an empty list says so', async () => {
    const { NotificationList } = await import('@/components/layout/NavNotifications')
    expect(renderToStaticMarkup(<NotificationList items={[]} onNavigate={() => {}} />)).toContain('notifications.empty')
  })

  it('REQ-COMMUNITY-015 a signed-in navbar has the bell on desktop and mobile, with the unread count only while something is unread, without reading the pathname', async () => {
    const { default: Navbar } = await import('@/components/layout/Navbar')
    // No Suspense above: a navbar that needed the pathname would hang here instead of returning markup.
    const quiet = renderToStaticMarkup(<Navbar mainNavLabel="main" />)
    expect(quiet.match(/data-testid="nav-notify-bell"/g)).toHaveLength(2)
    expect(quiet).not.toContain('nav-notify-badge')
    feed.items = items
    feed.unread = 12
    const html = renderToStaticMarkup(<Navbar mainNavLabel="main" />)
    expect(html.match(/data-testid="nav-notify-badge"[^>]*>9\+</g)).toHaveLength(2)
    expect(html).toContain('notifications.unread{&quot;count&quot;:12}')
    // The panel is closed until the bell is pressed.
    expect(html).not.toContain('답글 내용')
  })

  it('REQ-COMMUNITY-015 while the session is still loading the bell\'s place is kept for a returning user and no bell is shown', async () => {
    auth.status = 'loading'
    const { default: Navbar } = await import('@/components/layout/Navbar')
    const html = renderToStaticMarkup(<Navbar mainNavLabel="main" />)
    expect(html).not.toContain('nav-notify-bell')
    expect(html.match(/data-testid="nav-notify-slot"/g)).toHaveLength(2)
  })
})

describe('REQ-COMMUNITY-017 an inquiry waiting for an answer is a row of an administrator\'s list', () => {
  it('REQ-COMMUNITY-017 the row names the inquirer and the inquiry, shows its last words and links to it in the admin inbox', async () => {
    const { NotificationList } = await import('@/components/layout/NavNotifications')
    const inquiry: Notification = { id: 'm1', kind: 'inquiry', target: 'inquiry', href: '/admin/inquiries?id=q1', title: '로그인 오류', actor: '파우스트', avatar: null, excerpt: '문의 내용', at: '2026-10-03T09:00:00Z', unread: true }
    const html = renderToStaticMarkup(<NotificationList items={[inquiry]} onNavigate={() => {}} />)
    expect(html).toContain('href="/ko/admin/inquiries?id=q1"')
    for (const text of ['notifications.inquiry', '파우스트', '로그인 오류', '문의 내용']) expect(html).toContain(text)
    // The sentence exists in every public language, with the name in bold and the inquiry's title.
    for (const locale of ['ko', 'en', 'ja']) {
      const messages = JSON.parse(readFileSync(resolve(__dirname, `../../messages/${locale}.json`), 'utf8'))
      expect(messages.notifications.inquiry).toMatch(/<b>\{name\}<\/b>.*\{title\}/)
    }
  })
})

describe('REQ-COMMUNITY-018 opening the panel does not flash a scrollbar', () => {
  it('REQ-COMMUNITY-018 the rows of the scrolling list stay in place: the rise is on the card inside each row', () => {
    const css = readFileSync(resolve(__dirname, '../../components/layout/NavNotifications.module.css'), 'utf8')
    // A row moved below its place sticks out of the list, which then shows a scrollbar until the row lands.
    expect(css).not.toMatch(/\.row \{[^}]*animation/)
    expect(css).toMatch(/\.row \.card \{ animation: arrive 240ms ease-out both; animation-delay: calc\(var\(--i\) \* 40ms\); \}/)
    expect(css).toMatch(/prefers-reduced-motion: reduce\) \{[^@]*\.row \.card \{ animation: none; \}/)
  })
})

describe('REQ-COMMUNITY-016 a new notification is announced as a toast card', () => {
  it('REQ-COMMUNITY-016 the card shows who did what and the comment, opens the panel when pressed and has a close button', async () => {
    const { NotificationToast } = await import('@/components/layout/NavNotifications')
    const html = renderToStaticMarkup(<NotificationToast item={items[0]} sentence={<><b>료슈</b> replied</>} closeLabel="닫기" onOpen={() => {}} onClose={() => {}} />)
    expect(html).toContain('<b>료슈</b> replied')
    expect(html).toContain('답글 내용')
    expect(html.match(/<button/g)).toHaveLength(2)
    expect(html).toContain('aria-label="닫기"')
  })
})

describe('REQ-SHARED-031 the navbar\'s right side holds search, language, the bell and the account only', () => {
  it('REQ-SHARED-031 support is not a button of the bar or a menu group item: it is with the account', async () => {
    const { NAV_GROUPS } = await import('@/components/layout/nav-shared')
    expect(NAV_GROUPS.flatMap(group => group.items.map(item => item.href))).not.toContain('/support')
    const { default: Navbar } = await import('@/components/layout/Navbar')
    // The avatar menu that holds the support link is closed in this markup.
    expect(renderToStaticMarkup(<Navbar mainNavLabel="main" />)).not.toContain('href="/ko/support"')
    const { default: NavbarMobileSheet } = await import('@/components/layout/NavbarMobileSheet')
    nav.pathname = '/decks'
    const sheet = (isSignedIn: boolean) => renderToStaticMarkup(
      <NavbarMobileSheet mainNavLabel="main" sessionStatus={isSignedIn ? 'authenticated' : 'unauthenticated'} avatarUrl={null} isSignedIn={isSignedIn} isAdmin={false} onClose={() => {}} />,
    )
    expect(sheet(true)).toContain('href="/ko/support"')
    expect(sheet(false)).not.toContain('href="/ko/support"')
  })

  it('REQ-SHARED-031 the desktop language button is an icon that names the current language for screen readers', async () => {
    const { default: LanguageSwitcher } = await import('@/components/ui/LanguageSwitcher')
    const html = renderToStaticMarkup(<LanguageSwitcher compact />)
    expect(html).toMatch(/aria-label="[^"]*한국어[^"]*"/)
    expect(html).not.toMatch(/>한국어</)
  })

  it('REQ-SHARED-031 a new support reply adds one to the bell and leads the panel\'s list', async () => {
    auth.supportUnread = true
    feed.unread = 2
    const { default: Navbar } = await import('@/components/layout/Navbar')
    expect(renderToStaticMarkup(<Navbar mainNavLabel="main" />).match(/data-testid="nav-notify-badge"[^>]*>3</g)).toHaveLength(2)
    const { NotificationList } = await import('@/components/layout/NavNotifications')
    const html = renderToStaticMarkup(<NotificationList items={items} supportUnread onNavigate={() => {}} />)
    expect(html.indexOf('href="/ko/support"')).toBeGreaterThan(-1)
    expect(html.indexOf('href="/ko/support"')).toBeLessThan(html.indexOf('href="/ko/planner/community/p1'))
    expect(html).toContain('notifications.supportReply')
    expect(renderToStaticMarkup(<NotificationList items={[]} supportUnread onNavigate={() => {}} />)).not.toContain('notifications.empty')
  })
})

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { renderToStaticMarkup } from 'react-dom/server'
import { NAV_AUTH_HINT_KEY, NAV_BOOT_SCRIPT } from '@/lib/constants/nav-boot'

const session = vi.hoisted(() => ({ value: { data: null as unknown, status: 'loading' as string } }))
vi.mock('next-auth/react', () => ({ useSession: () => session.value, signOut: vi.fn() }))
vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key, useLocale: () => 'ko' }))
vi.mock('@/lib/i18n/navigation', () => ({
  Link: ({ children, href, ...rest }: { children?: React.ReactNode; href: string }) => <a href={href} {...rest}>{children}</a>,
  usePathname: () => '/ko',
}))
vi.mock('@/components/ui/LanguageSwitcher', () => ({ default: () => null }))
vi.mock('@/hooks/useSupportUnread', () => ({ useSupportUnread: () => false }))
vi.mock('@/components/brand/easter-eggs', () => ({ useTapEgg: () => () => {} }))

function runBootScript(userAgent: string, hint: string | null) {
  const attrs = new Set<string>()
  const documentElement = { setAttribute: (name: string) => attrs.add(name) }
  const localStorage = { getItem: (key: string) => (key === NAV_AUTH_HINT_KEY ? hint : null) }
  new Function('document', 'navigator', 'localStorage', NAV_BOOT_SCRIPT)({ documentElement }, { userAgent }, localStorage)
  return attrs
}

describe('REQ-SHARED-017 navbar paints its final shape before hydration', () => {
  beforeEach(() => { session.value = { data: null, status: 'loading' } })

  it('REQ-SHARED-017 head script marks the platform and a remembered sign-in before paint', () => {
    expect([...runBootScript('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', '1')].sort()).toEqual(['data-auth-hint', 'data-mac'])
    expect([...runBootScript('Mozilla/5.0 (Windows NT 10.0; Win64; x64)', null)]).toEqual([])
  })

  it('REQ-SHARED-017 renders both shortcut labels and both auth slots while the session loads, chosen by CSS', async () => {
    const { default: Navbar } = await import('@/components/layout/Navbar')
    const html = renderToStaticMarkup(<Navbar mainNavLabel="main" />)
    expect(html).toContain('nav-kbd-mac')
    expect(html).toContain('nav-kbd-other')
    expect(html).toContain('nav-auth-user')
    expect(html).toMatch(/<a [^>]*(href="\/ko\/login"[^>]*nav-auth-guest|nav-auth-guest[^>]*href="\/ko\/login")/)
    const css = readFileSync('app/globals.css', 'utf8')
    expect(css).toContain('html[data-auth-hint] .nav-auth-guest')
    expect(css).toContain('html[data-mac] .nav-kbd-other')
  })

  it('REQ-SHARED-017 shows only the login link once the session is known to be signed out', async () => {
    session.value = { data: null, status: 'unauthenticated' }
    const { default: Navbar } = await import('@/components/layout/Navbar')
    const html = renderToStaticMarkup(<Navbar mainNavLabel="main" />)
    expect(html).not.toContain('nav-auth-user')
    expect(html).not.toContain('nav-auth-guest')
    expect(html).toContain('href="/ko/login"')
  })
})

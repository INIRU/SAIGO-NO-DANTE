import { describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { Suspense } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

// `pathname: null` stands for a route whose params are unknown while prerendering (e.g. /decks/[id]): there the real
// usePathname() hangs on a never-resolving promise, and next-intl's Link/useRouter read it too.
const nav = vi.hoisted(() => ({ pathname: null as string | null }))
vi.mock('@/lib/i18n/navigation', async () => {
  const { use } = await import('react')
  const hang = new Promise<never>(() => {})
  const read = () => (nav.pathname === null ? use(hang) : nav.pathname)
  return { usePathname: read, useRouter: () => { read(); return { replace: vi.fn() } } }
})
vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key, useLocale: () => 'ko' }))
vi.mock('next-auth/react', () => ({ useSession: () => ({ data: null, status: 'loading' }), signOut: vi.fn() }))
vi.mock('@/hooks/useSupportUnread', () => ({ useSupportUnread: () => false }))
vi.mock('@/components/community/easterEggs', () => ({ useTapEgg: () => () => {} }))
// next/dynamic is React.lazy underneath; the search modal chunk never arrives here, like a slow network.
vi.mock('next/dynamic', async () => {
  const { lazy } = await import('react')
  return { default: (loader: () => Promise<{ default: React.ComponentType }>) => lazy(loader) }
})
vi.mock('@/components/ui/SearchModal', async () => {
  await new Promise(() => {})
  return { default: () => null }
})

const render = (element: React.ReactElement, pathname: string | null) => {
  nav.pathname = pathname
  return renderToStaticMarkup(element)
}

describe('REQ-SHARED-024 the navbar body is part of the static shell on every route', () => {
  it('REQ-SHARED-024 the locale layout does not put the whole navbar behind a Suspense boundary', () => {
    const layout = readFileSync('app/[lang]/layout.tsx', 'utf8')
    expect(layout).not.toContain('NavbarFallback')
    expect(layout).toMatch(/<div className="site-navigation"><Navbar [^>]*\/><\/div>/)
  })

  it('REQ-SHARED-024 logo, menu, search button, language button and login slot render without reading the pathname', async () => {
    const { default: Navbar } = await import('@/components/layout/Navbar')
    // No Suspense above: if any part of the body needed the pathname, this render would hang instead of returning markup.
    const html = render(<Navbar mainNavLabel="main" />, null)
    expect(html).toMatch(/<a [^>]*href="\/ko"/)
    for (const label of ['nav.db.title', 'nav.community.title', 'nav.tools.title', 'nav.other.title']) expect(html).toContain(label)
    expect(html).toContain('aria-label="검색 열기 (Ctrl+K)"')
    expect(html).toContain('nav-kbd-mac')
    expect(html).toContain('nav-kbd-other')
    expect(html).toContain('한국어')
    expect(html).toMatch(/<a [^>]*(href="\/ko\/login"[^>]*nav-auth-guest|nav-auth-guest[^>]*href="\/ko\/login")/)
    expect(html).toContain('nav-auth-user')
  })

  it('REQ-SHARED-024 the menu groups show the same bar before and after the pathname arrives', async () => {
    const { NavbarGroups } = await import('@/components/layout/NavbarIslands')
    for (const island of [<NavbarGroups key="g" />]) {
      const pending = render(<Suspense fallback={null}>{island}</Suspense>, null)
      const resolvedElsewhere = render(<Suspense fallback={null}>{island}</Suspense>, '/nowhere')
      expect(pending.length).toBeGreaterThan(200)
      expect(pending).toBe(resolvedElsewhere)
    }
  })

  it('REQ-SHARED-024 only the pathname-dependent mark is filled in late: the current group underline', async () => {
    const { NavbarGroups } = await import('@/components/layout/NavbarIslands')
    const groupsHere = render(<NavbarGroups />, '/sinners/yi-sang')
    const groupsElsewhere = render(<NavbarGroups />, '/nowhere')
    expect(groupsHere.match(/pointer-events-none absolute inset-x-3 bottom-0/g)).toHaveLength(1)
    expect(groupsElsewhere).not.toContain('pointer-events-none absolute inset-x-3 bottom-0')
    expect(groupsHere.length - groupsElsewhere.length).toBeLessThan(400)
  })

  it('REQ-SHARED-024 the language button shows its label without the pathname, only the option list reads it', async () => {
    const { default: LanguageSwitcher } = await import('@/components/ui/LanguageSwitcher')
    const html = render(<LanguageSwitcher />, null)
    expect(html).toContain('한국어')
    expect(html).toContain('aria-haspopup="listbox"')
  })

  it('REQ-SHARED-024 a slow search modal chunk suspends only its own boundary, not the navbar or the page around it', async () => {
    const { default: NavbarSearchModal } = await import('@/components/layout/NavbarSearchModal')
    const html = render(<Suspense fallback={<i>OUTER-FALLBACK</i>}><NavbarSearchModal open preload onClose={() => {}} /></Suspense>, '/ko')
    expect(html).not.toContain('OUTER-FALLBACK')
  })

  it('REQ-SHARED-024 the mobile menu sheet marks the current page and is not part of the closed navbar markup', async () => {
    const { default: Navbar } = await import('@/components/layout/Navbar')
    const { default: NavbarMobileSheet } = await import('@/components/layout/NavbarMobileSheet')
    expect(render(<Navbar mainNavLabel="main" />, null)).not.toContain('id="mobile-navigation-menu"')
    const sheet = render(
      <NavbarMobileSheet mainNavLabel="main" sessionStatus="unauthenticated" avatarUrl={null} isSignedIn={false} isAdmin={false} onClose={() => {}} />,
      '/decks/abc',
    )
    expect(sheet).toMatch(/href="\/ko\/decks"[^>]*aria-current="page"|aria-current="page"[^>]*href="\/ko\/decks"/)
    expect(sheet.match(/aria-current="page"/g)).toHaveLength(1)
  })
})

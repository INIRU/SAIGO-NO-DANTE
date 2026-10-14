import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it, vi } from 'vitest'
import { NAV_GROUPS } from '@/components/layout/nav-shared'

// The real catalog answers, so a label key the footer cannot resolve shows up as a raw key.
vi.mock('next-intl/server', async () => {
  const { createTranslator } = await import('next-intl')
  const catalogs: Record<string, unknown> = {
    ko: (await import('@/messages/ko.json')).default,
    en: (await import('@/messages/en.json')).default,
    ja: (await import('@/messages/ja.json')).default,
  }
  return {
    getTranslations: async ({ locale, namespace }: { locale: string; namespace?: string }) =>
      createTranslator({ locale, messages: catalogs[locale] as never, namespace: namespace as never }),
  }
})

it('REQ-SHARED-041 the footer links every DB, community and tools page of the menu as a locale-prefixed anchor', async () => {
  const { default: Footer } = await import('@/components/layout/Footer')
  const groups = NAV_GROUPS.filter(group => ['nav.db.title', 'nav.community.title', 'nav.tools.title'].includes(group.labelKey))
  expect(groups).toHaveLength(3)

  for (const lang of ['ko', 'en', 'ja']) {
    const html = renderToStaticMarkup(await Footer({ lang }))
    const hrefs = [...html.matchAll(/<a [^>]*href="([^"]+)"/g)].map(match => match[1])

    // The menu's dropdowns exist only while open, so these anchors are the links a crawler finds on every page.
    for (const item of groups.flatMap(group => group.items)) expect(hrefs).toContain(`/${lang}${item.href}`)
    expect(hrefs).toEqual(expect.arrayContaining([`/${lang}/terms`, `/${lang}/privacy`]))
    expect(new Set(hrefs).size).toBe(hrefs.length)
    // Every group and link is named in the page language, inside the footer's nav landmark.
    expect(html).not.toMatch(/>nav\.[\w.]+</)
    expect(html.match(/<nav[^>]*>[\s\S]*<\/nav>/)![0]).toContain(`href="/${lang}/mirror-dungeon"`)
  }
})

import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it, vi } from 'vitest'

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
vi.mock('next/cache', () => ({ cacheLife: () => {} }))

it('REQ-SHARED-064 the footer links the licenses page, labelled in the page language', async () => {
  const { default: Footer } = await import('@/components/layout/Footer')
  const labels: Record<string, string> = { ko: '라이선스', en: 'Licenses', ja: 'ライセンス' }
  for (const lang of ['ko', 'en', 'ja']) {
    const html = renderToStaticMarkup(await Footer({ lang }))
    expect(html).toMatch(new RegExp(`<a [^>]*href="/${lang}/licenses"[^>]*>${labels[lang]}</a>`))
  }
})

it('REQ-SHARED-064 the licenses page names each font and the Spine runtime with its holder and license, linked to the license text', async () => {
  const { LICENSES } = await import('@/lib/licenses')
  const { default: LicensesPage } = await import('@/app/[lang]/licenses/page')
  const names = LICENSES.flatMap(group => group.items.map(item => item.name))
  for (const name of ['Pretendard', 'M PLUS 1p', 'Corporate Logo', 'Noto Sans Mono', 'Paperlogy', 'Bebas Kai', 'Mikodacs', 'Spine Runtimes']) expect(names).toContain(name)
  for (const item of LICENSES.flatMap(group => group.items)) {
    expect(item.holder).toBeTruthy()
    // A license text the site serves itself is really there.
    if (item.url.startsWith('/')) expect(existsSync(join(process.cwd(), 'public', item.url))).toBe(true)
  }
  for (const lang of ['ko', 'en', 'ja']) {
    const html = renderToStaticMarkup(await LicensesPage({ params: Promise.resolve({ lang }) }))
    expect(html).toContain('Esoteric Software LLC')
    expect(html).toContain('href="/licenses/spine-runtimes.txt"')
    expect(html).toContain('SIL Open Font License 1.1')
  }
})

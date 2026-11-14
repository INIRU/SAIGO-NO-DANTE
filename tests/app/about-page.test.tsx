import { readFileSync } from 'node:fs'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

vi.mock('next/link', () => ({ default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => <a href={href} {...rest}>{children}</a> }))

describe('the about page says who runs the site, where the data comes from and how to reach it', () => {
  it('names the site, the unofficial status, Project Moon\'s rights and the contact in each language', async () => {
    const { default: AboutPage } = await import('@/app/[lang]/about/page')
    const titles = { ko: '사이트 소개', en: 'About', ja: 'サイトについて' }
    for (const lang of ['ko', 'en', 'ja'] as const) {
      const html = renderToStaticMarkup(await AboutPage({ params: Promise.resolve({ lang }) }))
      expect(html, lang).toContain(`>${titles[lang]}<`)
      expect(html, lang).toContain('Project Moon')
      expect(html, lang).toContain('sellindev@icloud.com')
      expect(html, lang).toContain(`href="/${lang}/support"`)
      if (lang !== 'ko') expect(html.replace(/<[^>]+>/g, ''), lang).not.toMatch(/[가-힣]/)
    }
  })

  it('the footer links it and the sitemap lists it', async () => {
    expect(readFileSync('components/layout/Footer.tsx', 'utf8')).toContain('`/${lang}/about`')
    expect(readFileSync('app/sitemap.ts', 'utf8')).toContain("entry('/about')")
  })
})

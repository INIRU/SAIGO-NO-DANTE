import { renderToStaticMarkup } from 'react-dom/server'
import { NextIntlClientProvider } from 'next-intl'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import LimpiLink from '@/components/home/LimpiLink'
import ko from '@/messages/ko.json'
import en from '@/messages/en.json'
import ja from '@/messages/ja.json'

const render = (locale: string, messages: typeof ko) => renderToStaticMarkup(
  <NextIntlClientProvider locale={locale} messages={messages} timeZone="Asia/Seoul"><LimpiLink /></NextIntlClientProvider>)

describe('Limpi link in the home hero', () => {
  it('REQ-HOME-005 opens the Limpi site in a new window, with the runner art and a label in every language', () => {
    for (const [locale, messages] of [['ko', ko], ['en', en], ['ja', ja]] as const) {
      const html = render(locale, messages as typeof ko)
      expect(html).toContain('href="https://limpi.site"')
      expect(html).toContain('target="_blank"')
      expect(html).toContain('rel="noopener noreferrer"')
      expect(html).toContain(`aria-label="${messages.home.limpi.open}"`)
      expect(html).toContain(`<strong>${messages.home.limpi.name}</strong>`)
      expect(html).toContain(`<small>${messages.home.limpi.kind}</small>`)
      expect(html).toContain('/assets/limpi/runner.png')
    }
  })
})

describe('home hero height on phones', () => {
  it('REQ-HOME-006 sizes the first screen by the small viewport, which does not change while the browser bar hides on scroll', () => {
    for (const file of ['app/[lang]/(home)/HomeClient.tsx', 'app/[lang]/(home)/loading.tsx']) {
      const source = readFileSync(resolve(__dirname, '../..', file), 'utf8')
      // dvh follows the collapsing browser bar, so the hero and its artwork were resized on every scroll frame.
      expect(source).not.toMatch(/\d*dvh/)
      expect(source).toContain('min-h-svh')
      expect(source).toContain('pt-[30svh]')
    }
  })
})

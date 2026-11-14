import { renderToStaticMarkup } from 'react-dom/server'
import { NextIntlClientProvider } from 'next-intl'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import DiscordSupportLink from '@/app/[lang]/(home)/_components/DiscordSupportLink'
import ko from '@/messages/ko.json'
import en from '@/messages/en.json'
import ja from '@/messages/ja.json'

const render = (locale: string, messages: typeof ko) => renderToStaticMarkup(
  <NextIntlClientProvider locale={locale} messages={messages} timeZone="Asia/Seoul"><DiscordSupportLink /></NextIntlClientProvider>)

describe('support Discord link in the home hero', () => {
  it('opens the support server in a new window with a name, a kind and a label in every language', () => {
    for (const [locale, messages] of [['ko', ko], ['en', en], ['ja', ja]] as const) {
      const html = render(locale, messages as typeof ko)
      expect(html).toContain('href="https://discord.gg/efaGjQwsVB"')
      expect(html).toContain('target="_blank"')
      expect(html).toContain('rel="noopener noreferrer"')
      expect(html).toContain(`aria-label="${messages.home.support.open}"`)
      expect(html).toContain(`<strong>${messages.home.support.name}</strong>`)
      expect(html).toContain(`<small>${messages.home.support.kind}</small>`)
    }
  })

  it('sits under the Limpi link in the hero actions', () => {
    const home = readFileSync(resolve(__dirname, '../../app/[lang]/(home)/HomeClient.tsx'), 'utf8')
    expect(home).toMatch(/<LimpiLink \/>\s*<DiscordSupportLink \/>/)
  })
})

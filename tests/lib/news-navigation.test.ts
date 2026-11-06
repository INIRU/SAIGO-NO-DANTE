import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'
import ko from '@/messages/ko.json'
import en from '@/messages/en.json'
import ja from '@/messages/ja.json'
import { NAV_GROUPS } from '@/components/layout/nav-shared'

const read = (path: string) => readFileSync(path, 'utf8')

it('REQ-NEWS-012 links the calendar from an icon beside the language button, named in every locale', () => {
  expect([ko, en, ja].map(messages => messages.nav.other.calendar)).toEqual(['소식 캘린더', 'News calendar', 'ニュースカレンダー'])
  // It is its own element, not an entry of a menu group.
  expect(NAV_GROUPS.flatMap(group => group.items.map(item => item.href))).not.toContain('/calendar')
  for (const file of ['components/layout/Navbar.tsx', 'components/layout/NavbarMobileSheet.tsx']) {
    const source = read(file)
    const link = source.indexOf('href="/calendar"'), language = source.indexOf('<LanguageSwitcher', link)
    expect(link, file).toBeGreaterThan(0)
    expect(source.slice(link, language), file).toContain("aria-label={t('nav.other.calendar' as TranslationKey)}")
    expect(source.slice(link, language), file).toContain('<CalendarIcon')
    // Nothing but the link sits between it and the language button.
    expect(source.slice(link, language).match(/<NavLink|<button|<div/g), file).toBeNull()
  }
})

it('REQ-NEWS-011 keeps the page scrollbar while a dialog locks scrolling, so the page and navbar keep their width', () => {
  const css = read('app/globals.css')
  expect(css).toContain('html { scrollbar-gutter: stable; }')
  // `html body` outranks the rule Radix injects; its margin compensation would shift the page a second time.
  const rule = css.match(/html body\[data-scroll-locked\]\s*\{([^}]*)\}/)?.[1] ?? ''
  for (const declaration of ['overflow-y: scroll !important', 'margin-right: 0 !important', 'padding-right: 0 !important']) expect(rule).toContain(declaration)
})

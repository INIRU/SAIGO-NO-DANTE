import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import HeroWordmark from '@/components/home/HeroWordmark'
import ko from '@/messages/ko.json'
import en from '@/messages/en.json'
import ja from '@/messages/ja.json'

vi.mock('@/components/brand/easter-eggs', () => ({ useTapEgg: () => () => {} }))

describe('the home heading says what the site is', () => {
  it('the h1 reads the given label, and the moving letters stay hidden from assistive technology', () => {
    const html = renderToStaticMarkup(<HeroWordmark label={ko.home.heading} />)
    expect(html).toMatch(/^<h1[^>]*><span class="sr-only">최애의 관리자 — 림버스 컴퍼니 정보·도감<\/span><span[^>]*aria-hidden="true">/)
    // The letters of the animation are the only other text in the heading.
    expect(html.replace(/<span class="sr-only">.*?<\/span>/, '').replace(/<[^>]+>/g, '')).toBe('HOSHISAIGOSAIGONO DANTE')
  })

  it('the heading names the site and the game in every language, and the home page passes it', () => {
    expect([ko, en, ja].map(messages => messages.home.heading)).toEqual([
      '최애의 관리자 — 림버스 컴퍼니 정보·도감',
      'SAIGO NO DANTE — Limbus Company Fan Archive',
      'SAIGO NO DANTE — リンバスカンパニー情報サイト',
    ])
    const home = readFileSync(resolve(__dirname, '../../../app/[lang]/(home)/HomeClient.tsx'), 'utf8')
    expect(home).toMatch(/<HeroWordmark label=\{t\('home\.heading'\)\}/)
  })

  it('elsewhere (the sign-in card) the wordmark reads as the site name only', () => {
    expect(renderToStaticMarkup(<HeroWordmark as="p" />)).toContain('<span class="sr-only">SAIGO NO DANTE</span>')
  })
})

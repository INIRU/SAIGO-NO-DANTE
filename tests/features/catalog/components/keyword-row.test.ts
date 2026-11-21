import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'
import ko from '@/messages/ko.json'
import en from '@/messages/en.json'
import ja from '@/messages/ja.json'

// DESIGN.md "게임 정보 창": keywords and marks are icon + coloured text in a row, never chips or boxes.
it('the E.G.O detail lists its keywords without a box around each', () => {
  const css = readFileSync('features/catalog/components/EgoDetailView.module.css', 'utf8')
  const rule = css.match(/\.keyword \{[^}]*\}/)?.[0] ?? ''
  expect(rule).not.toMatch(/border|background|padding/)
})

it('the identity detail draws keywords and acquisition marks without chips', () => {
  const source = readFileSync('features/catalog/components/IdentityInfoCard.tsx', 'utf8')
  expect(source).not.toContain('rounded-md border border-white/10')
  expect(source).not.toMatch(/padding: '2px 8px'/)
})

it.each([['ko', ko], ['en', en], ['ja', ja]])('the %s label over an identity\'s affiliations is one word, not two joined by a dot', (_, catalog) => {
  expect(catalog.identity.info.traits).not.toMatch(/[·・]/)
})

import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'

const read = (path: string) => readFileSync(path, 'utf8')

// Terms, privacy and about are reading pages: a plain dot for list items, sections parted by space.
it('a legal document marks list items with a round dot, not a rotated square', () => {
  const source = read('features/account/components/LegalDocument.tsx')
  expect(source).not.toContain('rotate-45')
  expect(source).toContain('before:rounded-full')
})

it('a legal document parts its sections by space, with no rule between them', () => {
  const section = read('features/account/components/LegalDocument.tsx').match(/const SECTION = '([^']*)'/)?.[1] ?? ''
  expect(section).not.toMatch(/\bborder-t\b/)
})

// The compact footer (announcements, support, developer console, public profile) keeps one rule on top.
it('the compact footer draws a single rule: the legal row loses its own top border', () => {
  expect(read('components/layout/Footer.tsx')).toContain('footer-legal')
  expect(read('styles/globals/workspaces.css')).toMatch(/html\[data-with-compact-footer\] \.footer-legal \{[^}]*border-top: 0;/)
})

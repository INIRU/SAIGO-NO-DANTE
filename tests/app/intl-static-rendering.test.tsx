import { existsSync, readFileSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { expect, it } from 'vitest'

// Next renders a page alongside its layout, so a page can run before the layout's setRequestLocale. Without a locale,
// next-intl then reads it from headers() and the page renders per request instead of being prerendered.
it('passes the route locale to next-intl in pages', () => {
  const pages = execSync("git ls-files 'app/*page.tsx'", { encoding: 'utf8' }).split('\n').filter(file => file && existsSync(file))
  const localeless = /\bgetLocale\(\)|\bgetTranslations\(\s*(?:(['"])[^'"]*\1\s*)?\)|\bget(?:Messages|Formatter|Now|TimeZone)\(\)/
  expect(pages.filter(file => localeless.test(readFileSync(file, 'utf8')))).toEqual([])
})

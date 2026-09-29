import { existsSync, readFileSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { isValidElement, type ReactElement, type ReactNode } from 'react'
import { expect, it, vi } from 'vitest'
import NotFound from '@/app/not-found'
import IntlClientProvider from '@/components/providers/IntlClientProvider'
import { routing } from '@/lib/i18n/routing'

vi.mock('@/components/ui/PageError', () => ({ default: () => null }))

// next-intl's NextIntlClientProvider, rendered from a server component, reads the request config (and headers()) for
// every prop it is not given. The root not-found is in every route's RSC payload, so that made every page request-time.
it('renders next-intl providers only from client modules', () => {
  const files = execSync("git ls-files 'app/*.tsx' 'components/*.tsx' 'lib/*.tsx'", { encoding: 'utf8' }).split('\n').filter(file => file && existsSync(file))
  const serverUsers = files.filter(file => {
    const source = readFileSync(file, 'utf8')
    return /\bNextIntlClientProvider\b/.test(source) && !/^\s*['"]use client['"]/.test(source)
  })
  expect(serverUsers).toEqual([])
})

function findElement(node: ReactNode, type: unknown): ReactElement<Record<string, unknown>> | null {
  if (Array.isArray(node)) {
    for (const child of node) {
      const found = findElement(child, type)
      if (found) return found
    }
    return null
  }
  if (!isValidElement<{ children?: ReactNode }>(node)) return null
  if (node.type === type) return node as ReactElement<Record<string, unknown>>
  return findElement(node.props.children, type)
}

it('gives the root not-found provider its locale, messages and time zone', () => {
  const provider = findElement(NotFound(), IntlClientProvider)
  expect(provider?.props).toMatchObject({ locale: routing.defaultLocale, timeZone: 'Asia/Seoul' })
  expect(provider?.props.messages).toHaveProperty('errorPage')
})

// Next renders a page alongside its layout, so a page can run before the layout's setRequestLocale. Without a locale,
// next-intl then reads it from headers() and the page renders per request instead of being prerendered.
it('passes the route locale to next-intl in pages', () => {
  const pages = execSync("git ls-files 'app/*page.tsx'", { encoding: 'utf8' }).split('\n').filter(file => file && existsSync(file))
  const localeless = /\bgetLocale\(\)|\bgetTranslations\(\s*(?:(['"])[^'"]*\1\s*)?\)|\bget(?:Messages|Formatter|Now|TimeZone)\(\)/
  expect(pages.filter(file => localeless.test(readFileSync(file, 'utf8')))).toEqual([])
})

import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it, vi } from 'vitest'

vi.mock('next-intl', () => ({ useLocale: () => 'ko', useTranslations: () => (key: string) => key }))
import { KeywordCardSkeleton } from '@/app/[lang]/keywords/_components/KeywordCard'

// Every shimmering bone sits in a box the browser skips while it is off screen: the placeholder cards wait below the list
// (the scroll sentinel) and their endless sweep re-styled the page 60 times a second while nobody saw them.
const bonesOutsideSkippedBoxes = (html: string) => {
  // walk the tags: an open tag whose class names a bone counts when no open ancestor skips its contents off screen
  const stack: string[] = []
  let outside = 0
  for (const [, close, cls = ''] of html.matchAll(/<(\/)?[a-z]+(?:[^>]*?class="([^"]*)")?[^>]*>/g)) {
    if (close) { stack.pop(); continue }
    if (/bone/.test(cls) && !stack.some(c => c.includes('content-visibility:auto'))) outside++
    stack.push(cls)
  }
  return outside
}

it('a keyword placeholder card shimmers only while on screen', () => {
  for (const compact of [false, true]) {
    const html = renderToStaticMarkup(<KeywordCardSkeleton compact={compact} />)
    expect(html).toMatch(/bone/)
    expect(bonesOutsideSkippedBoxes(html), `compact=${compact}`).toBe(0)
  }
})

it('the list placeholder is a row: no boxed card and no three-number strip', () => {
  const html = renderToStaticMarkup(<KeywordCardSkeleton />)
  expect(html).not.toContain('grid-cols-3')
  expect(html).not.toContain('rounded-md border')
  expect(html).toContain('border-b')
})

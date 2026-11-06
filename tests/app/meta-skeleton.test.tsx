import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { DEFAULT_META_PERIOD, DEFAULT_META_SOURCE, type MetaData } from '@/lib/meta/types'
import MetaClient from '@/app/[lang]/meta/_components/MetaClient'
import MetaSkeleton from '@/features/meta/components/MetaSkeleton'

vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key, useLocale: () => 'ko' }))
// The URL holds the defaults, and the request has not answered: the page shows what the server handed it.
vi.mock('nuqs', () => ({
  parseAsString: { withDefault: (value: string) => value },
  parseAsArrayOf: () => ({ withDefault: (value: string[]) => value }),
  parseAsStringLiteral: () => ({ withDefault: (value: string) => value }),
  useQueryState: (_key: string, value: string) => [value, () => {}],
  useQueryStates: (values: object) => [values, () => {}],
}))
vi.mock('swr', () => ({ default: (_key: string, _fetch: unknown, options: { fallbackData?: unknown }) => ({ data: options.fallbackData, isLoading: !options.fallbackData }) }))
vi.mock('@/features/meta/components/MetaOverview', () => ({ default: () => <div data-overview /> }))
vi.mock('@/features/meta/components/IdentityAnalysis', () => ({ default: () => null }))
vi.mock('@/features/meta/components/DungeonAnalysis', () => ({ default: () => null }))
vi.mock('@/features/meta/components/MetaFilters', () => ({ default: () => null }))

const read = (file: string) => readFileSync(resolve(__dirname, '../..', file), 'utf8')
const PARTS = ['toolbar', 'summary', 'views', 'body']
const data = { source: DEFAULT_META_SOURCE, period: DEFAULT_META_PERIOD, sampleCount: 40, sourceCounts: { decks: 30, planner: 10 }, excludedSamples: 0 } as unknown as MetaData

it('REQ-META-007 holds the page\'s place with a skeleton of the toolbar, summary, tabs and body while the data is on its way', () => {
  expect(read('app/[lang]/meta/page.tsx')).toMatch(/<Suspense fallback=\{<MetaSkeleton \/>\}>/)
  const html = renderToStaticMarkup(<MetaSkeleton />)
  expect(html).toContain('role="status"')
  expect([...html.matchAll(/data-meta-skeleton="(\w+)"/g)].map(match => match[1])).toEqual(PARTS)
  // The client without data (the request failed on the server and is being retried): the real toolbar over the same body.
  const loading = renderToStaticMarkup(<MetaClient initialData={null} />)
  expect([...loading.matchAll(/data-meta-skeleton="(\w+)"/g)].map(match => match[1])).toEqual(['body'])
})

it('REQ-META-008 the summary, tabs and panel rise in order when the data arrives, and the panel alone on a tab switch', () => {
  const html = renderToStaticMarkup(<MetaClient initialData={data} />)
  expect(html).not.toContain('data-meta-skeleton')
  // CSS modules render as _name_hash in tests.
  expect([...html.matchAll(/class="[^"]*_arrive_\w+[^"]*" style="--i:(\d)"/g)].map(match => match[1])).toEqual(['0', '1', '2'])
  // The tab's own content is redrawn per tab (keyed), so it rises on a switch, with no place in the order to wait for.
  expect(html).toMatch(/<div class="_arrive_\w+" data-meta-panel="overall"><div data-overview/)
  const css = read('styles/components/MetaAnalysis.module.css')
  expect(css).toMatch(/\.arrive \{ animation: arrive 280ms [^}]*animation-delay: calc\(var\(--i, 0\) \* 80ms\); \}/)
  expect(css).toMatch(/prefers-reduced-motion: reduce\) \{[^@]*\.arrive \{ animation: none; \}/)
})

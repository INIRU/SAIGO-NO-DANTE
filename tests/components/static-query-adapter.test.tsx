import { renderToString } from 'react-dom/server'
import { parseAsString, useQueryState } from 'nuqs'
import { expect, it, vi } from 'vitest'
import StaticQueryAdapter from '@/components/providers/StaticQueryAdapter'

// On the server both hooks make the page request-time (useSearchParams) or need a request; the adapter must not call them.
vi.mock('next/navigation', () => ({
  useSearchParams: () => { throw new Error('useSearchParams() called on the server') },
  useRouter: () => { throw new Error('useRouter() called on the server') },
}))

function Probe() {
  const [tab] = useQueryState('tab', parseAsString.withDefault('gifts'))
  return <p data-tab={tab}>{tab}</p>
}

// Pages under this adapter are prerendered once in their default view; the URL's query applies after hydration.
it('server-renders the default query state without reading the request', () => {
  expect(renderToString(<StaticQueryAdapter><Probe /></StaticQueryAdapter>)).toContain('data-tab="gifts"')
})

// A page opened with a query shows the skeleton, not that default view, until the filtered view has rendered.
it('ships the skeleton hidden with a pre-paint switch for query links', () => {
  const html = renderToString(<StaticQueryAdapter fallback={<i data-skeleton="" />}><Probe /></StaticQueryAdapter>)
  expect(html).toMatch(/<script>if\(location\.search\.length>1\)document\.documentElement\.setAttribute\('data-query-pending',''\)<\/script>/)
  expect(html).toMatch(/<div data-static-query-fallback="">[^]*data-skeleton[^]*<div data-static-query="">[^]*data-tab="gifts"/)
})

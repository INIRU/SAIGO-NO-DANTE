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

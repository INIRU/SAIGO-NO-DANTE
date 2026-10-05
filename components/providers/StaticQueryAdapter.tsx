'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import {
  renderQueryString,
  unstable_createAdapterProvider as createAdapterProvider,
  type unstable_AdapterInterface as AdapterInterface,
  type unstable_UpdateUrlFunction as UpdateUrlFunction,
} from 'nuqs/adapters/custom'
import { Fragment, startTransition, useCallback, useLayoutEffect, useOptimistic, useRef, useState, useSyncExternalStore, type ReactNode } from 'react'

const EMPTY = new URLSearchParams()
const noop = () => {}
const subscribe = () => noop
// Fixed per environment, so each side always calls the same hooks in the same order.
const onServer = typeof window === 'undefined'
const SERVER_ADAPTER: AdapterInterface = { searchParams: EMPTY, updateUrl: noop }

/** False on the server and while hydrating (the server snapshot), true afterwards and on client-side navigations. */
function useHydrated() {
  return useSyncExternalStore(subscribe, () => true, () => false)
}

/** nuqs's next/app adapter, except that the server and the hydrating render see no query. */
function useStaticFirstAdapter(): AdapterInterface {
  const hydrated = useHydrated()
  if (onServer) return SERVER_ADAPTER
  /* eslint-disable react-hooks/rules-of-hooks -- `onServer` is constant for the lifetime of the bundle */
  const router = useRouter()
  const current = useSearchParams()
  const [searchParams, setOptimisticSearchParams] = useOptimistic<URLSearchParams>(current)
  // A query written to the URL reaches useSearchParams() a render later (Next takes it from the history call in a
  // transition), and nuqs has dropped its own pending value by then: without this the old query shows for a moment
  // (a pressed filter goes off, then on again). The written query stands in until Next's own query changes.
  const [written, setWritten] = useState<{ search: URLSearchParams; over: URLSearchParams } | null>(null)
  const currentRef = useRef(current)
  useLayoutEffect(() => { currentRef.current = current })
  const updateUrl = useCallback<UpdateUrlFunction>((search, options) => {
    setWritten({ search, over: currentRef.current })
    startTransition(() => {
      if (!options.shallow) setOptimisticSearchParams(search)
      const url = location.origin + location.pathname + renderQueryString(search) + location.hash
      ;(options.history === 'push' ? history.pushState : history.replaceState).call(history, null, '', url)
      if (options.scroll) window.scrollTo(0, 0)
      if (!options.shallow) router.replace(url, { scroll: false })
    })
  }, [router, setOptimisticSearchParams])
  /* eslint-enable react-hooks/rules-of-hooks */
  // rateLimitFactor as in nuqs's next/app adapter: each update is several history calls (browser rate limits).
  const shown = written?.over === current ? written.search : searchParams
  return { searchParams: hydrated ? shown : EMPTY, updateUrl, rateLimitFactor: 3, autoResetQueueOnUpdate: true }
}

const Provider = createAdapterProvider(useStaticFirstAdapter)

// Runs as the HTML is parsed, before the content below paints: a page opened with a query shows `fallback` (via
// globals.css) instead of the unfiltered view until the filtered one has rendered.
const PENDING_SCRIPT = "if(location.search.length>1)document.documentElement.setAttribute('data-query-pending','')"

/**
 * Lets a page whose client components keep their state in the URL (nuqs) be a static shell. useSearchParams() makes
 * a page render per request; below this the server renders the default view (no query) into the HTML instead.
 *
 * A page opened with a query shows `fallback` (the page's skeleton) rather than that unfiltered view. It hydrates the
 * default view out of sight, then its children mount again once, reading the URL from their first render, so no state
 * copied from the query at mount (a search box's text) starts out empty, and the filtered view replaces the skeleton
 * in the same frame. Without a query nothing mounts again, and client-side navigations read the query from their
 * first render.
 */
export default function StaticQueryAdapter({ children, fallback = null }: { children: ReactNode; fallback?: ReactNode }) {
  const hydrated = useHydrated()
  // Read once: later filter changes update the URL without mounting the page again.
  const [openedWithQuery] = useState(() => !onServer && location.search.length > 1)
  useLayoutEffect(() => {
    if (hydrated) document.documentElement.removeAttribute('data-query-pending')
  }, [hydrated])
  return (
    <>
      {!hydrated && (
        <>
          <script dangerouslySetInnerHTML={{ __html: PENDING_SCRIPT }} />
          <div data-static-query-fallback="">{fallback}</div>
        </>
      )}
      <div data-static-query="">
        <Provider>
          <Fragment key={hydrated && openedWithQuery ? 'url' : 'shell'}>{children}</Fragment>
        </Provider>
      </div>
    </>
  )
}

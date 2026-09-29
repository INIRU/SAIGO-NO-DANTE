import { Suspense } from 'react'
import { connection } from 'next/server'

async function AtRequest() {
  await connection()
  return null
}

/**
 * Renders nothing, at request time. On an otherwise static route, client components that read the URL query (nuqs,
 * useSearchParams) are left to the browser and their content is missing from the HTML; a route that renders this is
 * server-rendered per request, so those components keep their HTML for the requested query. The rest of the page
 * stays in the prerendered shell.
 */
export default function RequestTimeRoute() {
  return (
    <Suspense fallback={null}>
      <AtRequest />
    </Suspense>
  )
}

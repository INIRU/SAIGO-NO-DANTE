import 'server-only'

const ENDPOINT = 'https://api.cloudflare.com/client/v4/graphql'

/**
 * Page loads over the last `days` days from Cloudflare Web Analytics (the beacon every page already carries), one count
 * per key: every path that contains the key's path, in any language. Null when the token or account id is not set or the
 * request fails, so callers keep their own order. The counts are sampled: good for ranking, not for reporting.
 */
export async function getPageVisits<K extends string>(paths: Record<K, string>, host: string, days = 7): Promise<Record<K, number> | null> {
  const token = process.env.CLOUDFLARE_ANALYTICS_TOKEN
  const account = process.env.CLOUDFLARE_ACCOUNT_ID
  const keys = Object.keys(paths) as K[]
  // Keys become GraphQL aliases and paths go into the query text: both are fixed in code, never visitor input.
  if (!token || !account || keys.some(key => !/^[A-Za-z]\w*$/.test(key) || !/^[\w/-]+$/.test(paths[key]))) return null
  const day = (ago: number) => new Date(Date.now() - ago * 86_400_000).toISOString().slice(0, 10)
  const fields = keys.map(key =>
    `${key}:rumPageloadEventsAdaptiveGroups(limit:1,filter:{date_geq:$since,date_leq:$until,requestHost:$host,requestPath_like:"%${paths[key]}%"}){count}`).join(' ')
  try {
    // No abort timer: while Next renders a cached page ahead of time the timer fired with the request still healthy
    // (production, 2026-11-11), so the counts never arrived.
    const response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        query: `query($account:String!,$since:Date!,$until:Date!,$host:String!){viewer{accounts(filter:{accountTag:$account}){${fields}}}}`,
        variables: { account, since: day(days), until: day(0), host },
      }),
    })
    const body = await response.json() as { errors?: unknown[] | null; data?: { viewer?: { accounts?: Record<string, { count?: number }[]>[] } } }
    const row = body.data?.viewer?.accounts?.[0]
    if (!response.ok || body.errors?.length || !row) {
      // Never the token: only the status and Cloudflare's own message.
      console.error('[page-visits]', response.status, JSON.stringify(body.errors ?? null).slice(0, 300))
      return null
    }
    return Object.fromEntries(keys.map(key => [key, row[key]?.[0]?.count ?? 0])) as Record<K, number>
  } catch (error) {
    console.error('[page-visits]', error instanceof Error ? `${error.name}: ${error.message}` : 'request failed')
    return null
  }
}

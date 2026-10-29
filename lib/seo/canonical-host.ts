const APEX = 'saigo-no-dante.com'

/**
 * The https apex address for a request that reached the site over http or through www (one address per page for
 * search engines), or null. The scheme comes from Cloudflare's `cf-visitor` header: the tunnel itself reaches the
 * server over plain http, so without it nothing is redirected (no loop).
 */
export function canonicalRedirectUrl(host: string | null, cfVisitor: string | null, pathWithSearch: string): string | null {
  if (!host || !cfVisitor) return null
  const hostname = host.toLowerCase().split(':')[0]
  if (hostname !== APEX && hostname !== `www.${APEX}`) return null
  const http = /"scheme"\s*:\s*"http"/.test(cfVisitor)
  if (hostname === APEX && !http) return null
  return `https://${APEX}${pathWithSearch}`
}

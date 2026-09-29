/**
 * Browser/CDN caching of public game catalog responses. Server-side they are 'use cache' entries invalidated by the
 * game data tags, which do not reach copies already held by browsers or the CDN, so those stay short: browsers reuse a
 * response for 5 minutes and the CDN for an hour, refreshing it in the background after that.
 */
export const CATALOG_CACHE_CONTROL = 'public, max-age=300, s-maxage=3600, stale-while-revalidate=86400'

/** Same-origin requests must use the browser-visible Host, including preview tunnels. */
export function isAllowedRequestOrigin(value: string | null, requestOrigin: string, host: string | null, allowedOrigins: readonly string[]): boolean {
  if (!value) return false
  try {
    const source = new URL(value)
    if (!['http:', 'https:'].includes(source.protocol)) return false
    if (source.origin === requestOrigin || allowedOrigins.includes(source.origin)) return true
    // Next's internal URL can be localhost behind a reverse proxy. Match the
    // actual incoming Host exactly; never allow an arbitrary suffix or substring.
    return Boolean(host && source.host.toLowerCase() === host.toLowerCase())
  } catch {
    return false
  }
}

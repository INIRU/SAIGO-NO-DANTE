export function safeLoginReturn(value: string | null, locale: string): string {
  if (!value || !value.startsWith('/') || value.startsWith('//') || /[\\\x00-\x1f]/.test(value)) return `/${locale}`
  try {
    const url = new URL(value, 'https://local.invalid')
    if (url.origin !== 'https://local.invalid' || /^\/(?:ko|en|ja)\/login(?:\/|$)/.test(url.pathname) || url.pathname === '/login') return `/${locale}`
    return url.pathname + url.search + url.hash
  } catch { return `/${locale}` }
}

/** Sends the browser to the site's login page (terms consent first), coming back to `returnTo` (default: this page). */
export function goToLogin(locale: string, returnTo?: string) {
  const back = returnTo ?? window.location.pathname + window.location.search + window.location.hash
  window.location.assign(`/${locale}/login?callbackUrl=${encodeURIComponent(back)}`)
}

export function safeLoginReturn(value: string | null, locale: string): string {
  if (!value || !value.startsWith('/') || value.startsWith('//') || /[\\\x00-\x1f]/.test(value)) return `/${locale}`
  try {
    const url = new URL(value, 'https://local.invalid')
    if (url.origin !== 'https://local.invalid' || /^\/(?:ko|en|ja)\/login(?:\/|$)/.test(url.pathname) || url.pathname === '/login') return `/${locale}`
    return url.pathname + url.search + url.hash
  } catch { return `/${locale}` }
}

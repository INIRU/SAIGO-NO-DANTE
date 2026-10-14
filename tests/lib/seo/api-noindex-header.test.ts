import { expect, it, vi } from 'vitest'

// The plugins only wrap the config for the build; the headers are the config's own.
vi.mock('@sentry/nextjs', () => ({ withSentryConfig: (config: unknown) => config }))
vi.mock('next-intl/plugin', () => ({ default: () => (config: unknown) => config }))

it('REQ-SHARED-043 API responses carry X-Robots-Tag: noindex, and pages do not', async () => {
  const { default: config } = await import('@/next.config')
  const rules = await (config as { headers: () => Promise<{ source: string; headers: { key: string; value: string }[] }[]> }).headers()
  const tagged = rules.filter(rule => rule.headers.some(header => header.key === 'X-Robots-Tag'))

  expect(tagged.map(rule => rule.source)).toEqual(['/api/:path*'])
  expect(tagged[0].headers).toContainEqual({ key: 'X-Robots-Tag', value: 'noindex' })
})

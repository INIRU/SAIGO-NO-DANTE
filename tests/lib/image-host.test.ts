import { readFileSync } from 'node:fs'
import { afterEach, expect, it, vi } from 'vitest'

vi.mock('@sentry/nextjs', () => ({ withSentryConfig: (config: unknown) => config }))
vi.mock('next-intl/plugin', () => ({ default: () => (config: unknown) => config }))

async function imagePath(env: Record<string, string | undefined>) {
  vi.resetModules()
  for (const [key, value] of Object.entries(env)) vi.stubEnv(key, value)
  const { default: config } = await import('@/next.config')
  return (config as { images?: { path?: string } }).images?.path
}

afterEach(() => vi.unstubAllEnvs())

// Optimized images are over half of all requests: they leave CloudFront (billed per request) for media.*, which stays on
// the Cloudflare tunnel and its edge cache.
it('the self-hosted build points next/image at the media host, other builds keep /_next/image', async () => {
  expect(await imagePath({ SELF_HOSTED: '1' })).toBe('https://media.saigo-no-dante.com/_next/image')
  expect(await imagePath({ SELF_HOSTED: undefined })).toBeUndefined()
})

it('the self-hosted layout opens the connection to the media host early', () => {
  const layout = readFileSync('app/[lang]/layout.tsx', 'utf8')
  expect(layout).toMatch(/SELF_HOSTED === '1' \? <link rel="preconnect" href=\{MEDIA_ORIGIN\}/)
})

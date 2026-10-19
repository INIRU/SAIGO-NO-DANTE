import { afterEach, expect, it, vi } from 'vitest'

// The plugins only wrap the config for the build; the headers are the config's own.
vi.mock('@sentry/nextjs', () => ({ withSentryConfig: (config: unknown) => config }))
vi.mock('next-intl/plugin', () => ({ default: () => (config: unknown) => config }))

type HeaderRule = { source: string; headers: { key: string; value: string }[] }

async function csp(env: Record<string, string | undefined>) {
  vi.resetModules()
  for (const [key, value] of Object.entries(env)) vi.stubEnv(key, value)
  const { default: config } = await import('@/next.config')
  const rules = await (config as { headers: () => Promise<HeaderRule[]> }).headers()
  const header = rules.flatMap(rule => rule.headers).find(h => h.key === 'Content-Security-Policy')!
  return header.value.split('; ')
}

afterEach(() => vi.unstubAllEnvs())

it('REQ-SHARED-046 HTTPS deployments (Vercel or the self-hosted server) upgrade insecure requests, local http does not', async () => {
  expect(await csp({ VERCEL: '1', SELF_HOSTED: undefined })).toContain('upgrade-insecure-requests')
  expect(await csp({ VERCEL: undefined, SELF_HOSTED: '1' })).toContain('upgrade-insecure-requests')
  expect(await csp({ VERCEL: undefined, SELF_HOSTED: undefined })).not.toContain('upgrade-insecure-requests')
})

it('REQ-SHARED-047 the Cloudflare Web Analytics beacon may load and report', async () => {
  const directives = await csp({})
  expect(directives.find(d => d.startsWith('script-src'))).toContain('https://static.cloudflareinsights.com')
  expect(directives.find(d => d.startsWith('connect-src'))).toContain('https://cloudflareinsights.com')
})

import { describe, expect, it } from 'vitest'

const baseUrl = process.env.TEST_BASE_URL
const retired = ['tier-list', 'extraction', 'story', 'story/prologue', 'story/canto-1/S101B', 'calendar']

describe.runIf(baseUrl)('restored service over HTTP', () => {
  it.each(['ko', 'en', 'ja'])('%s homepage no longer links to retired features', async locale => {
    const response = await fetch(`${baseUrl}/${locale}`)
    expect(response.status).toBe(200)
    const html = await response.text()
    for (const route of retired) {
      expect(html).not.toContain(`href="/${locale}/${route}"`)
    }
  }, 30_000)

  it.each(retired)('%s is no longer served', async route => {
    const response = await fetch(`${baseUrl}/ko/${route}`)
    expect(response.status).toBe(404)
  }, 30_000)

  it('does not serve the retired calendar API', async () => {
    const response = await fetch(`${baseUrl}/api/calendar/events?year=2026&month=9`)
    expect(response.status).toBe(404)
  }, 30_000)

  it('does not serve the removed story payload', async () => {
    const response = await fetch(`${baseUrl}/data/story/prologue/index.json`)
    expect(response.status).toBe(404)
  }, 30_000)
})

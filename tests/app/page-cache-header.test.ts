import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

// The header rules of next.config.ts, read as text: loading the config runs its plugins.
const config = readFileSync('next.config.ts', 'utf8')

describe('REQ-SHARED-109 a browser never answers a page from its own stale copy', () => {
  it('REQ-SHARED-109 sends pages and their RSC payloads with private, no-cache instead of the CDN header of the framework', () => {
    const rule = config.match(/source: '\/:lang\(ko\|en\|ja\)\/:path\*',\s*headers: \[\{ key: 'Cache-Control', value: '([^']+)' \}\]/)
    expect(rule?.[1]).toBe('private, no-cache')
  })
})

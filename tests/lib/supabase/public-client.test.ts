import { readFileSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { describe, expect, it } from 'vitest'
import { publicSupabase } from '@/lib/supabase/public'

process.env.NEXT_PUBLIC_SUPABASE_URL ??= 'https://example.supabase.co'
process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??= 'publishable-test-key'

describe('REQ-SHARED-055 one public Supabase client per server', () => {
  it('REQ-SHARED-055 hands out the same client every time, with no session and no token refresh timer', () => {
    const client = publicSupabase()
    expect(publicSupabase()).toBe(client)
    // A client that refreshes tokens keeps a timer that holds it (and the clients it saw) in memory for good.
    const auth = (client as unknown as { auth: { autoRefreshToken: boolean; persistSession: boolean } }).auth
    expect(auth.autoRefreshToken).toBe(false)
    expect(auth.persistSession).toBe(false)
  })

  it('REQ-SHARED-055 creates Supabase clients only in lib/supabase/', () => {
    const files = execSync("git ls-files 'app/**/*.ts' 'app/**/*.tsx' 'lib/**/*.ts' 'lib/**/*.tsx' 'components/**/*.ts' 'components/**/*.tsx'", { encoding: 'utf8' })
      .split('\n').filter(Boolean).filter(file => !file.startsWith('lib/supabase/'))
    const offenders = files.filter(file => /from ['"]@supabase\/supabase-js['"]/.test(readFileSync(file, 'utf8')) && /\bcreateClient\s*\(/.test(readFileSync(file, 'utf8')))
    expect(offenders).toEqual([])
  })
})

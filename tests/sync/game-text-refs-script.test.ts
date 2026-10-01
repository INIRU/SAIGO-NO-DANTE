import { resolve } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { buildGameTextRefs, readGameTextSources } from '@/scripts/sync/game-text-refs-rules'

// Runs scripts/sync/game-text-refs.ts end to end against a fake Supabase client: no database, no network.
const FIXTURES = resolve(__dirname, '../fixtures/game-text-refs')
const KEYWORD_META_NAMES = ['화상', '공격레벨감소', '진동']

const fake = vi.hoisted(() => ({
  stored: [] as unknown[] | 'missing',
  upserts: [] as unknown[][],
  summary: vi.fn(),
}))

vi.mock('dotenv', () => ({ config: () => undefined }))
vi.mock('@/scripts/sync/sync-result', () => ({ failOnLoggedErrors: () => undefined, printSyncSummary: fake.summary }))
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    schema: () => ({
      from: (table: string) => ({
        select: () => ({
          order: () => ({
            range: async (from: number) => {
              if (table === 'keyword_meta') return { data: from === 0 ? KEYWORD_META_NAMES.map(name => ({ name })) : [], error: null }
              if (fake.stored === 'missing') return { data: null, error: { code: 'PGRST205', message: 'Could not find the table' } }
              return { data: from === 0 ? fake.stored : [], error: null }
            },
          }),
        }),
        upsert: async (batch: unknown[]) => { fake.upserts.push(batch); return { error: null } },
      }),
    }),
  }),
}))

const fetchMock = vi.fn()
const errors: string[] = []
let exit: ReturnType<typeof vi.spyOn>
const originalArgv = process.argv

async function run(args: string[]) {
  process.argv = ['node', 'game-text-refs.ts', ...args]
  vi.resetModules()
  await import('@/scripts/sync/game-text-refs')
  await vi.waitFor(() => { if (!fake.summary.mock.calls.length && !exit.mock.calls.length) throw new Error('script still running') })
}

describe('REQ-DATA-SYNC-034 game text refs script', () => {
  beforeEach(() => {
    fake.stored = []
    fake.upserts = []
    fake.summary.mockClear()
    errors.length = 0
    fetchMock.mockReset().mockResolvedValue({ ok: true, json: async () => ({ revalidated: ['game-text-refs'] }) })
    vi.stubGlobal('fetch', fetchMock)
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'http://supabase.test')
    vi.stubEnv('SUPABASE_SECRET_KEY', 'secret')
    vi.stubEnv('LIMBUS_DATA_DIR', FIXTURES)
    vi.stubEnv('SITE_URL', 'https://site.test')
    vi.stubEnv('REVALIDATION_SECRET', 'revalidate-secret')
    exit = vi.spyOn(process, 'exit').mockImplementation((() => undefined) as never)
    vi.spyOn(console, 'log').mockImplementation(() => undefined)
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => { errors.push(args.join(' ')) })
  })

  afterEach(() => {
    process.argv = originalArgv
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('REQ-DATA-SYNC-034 --fix with changed rows upserts them, then revalidates all game data once', async () => {
    await run(['--fix'])
    expect(fake.upserts.flat().length).toBeGreaterThan(0)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://site.test/api/revalidate')
    expect(init.headers['x-revalidation-secret']).toBe('revalidate-secret')
    expect(JSON.parse(init.body)).toEqual({ scope: 'all-game-data' })
    expect(fake.summary.mock.invocationCallOrder[0]).toBeGreaterThan(fetchMock.mock.invocationCallOrder[0])
  })

  it('REQ-DATA-SYNC-034 --fix with nothing changed writes nothing and does not revalidate', async () => {
    fake.stored = buildGameTextRefs({ ...readGameTextSources(FIXTURES), keywordMetaNames: KEYWORD_META_NAMES })
    await run(['--fix'])
    expect(fake.upserts).toEqual([])
    expect(fetchMock).not.toHaveBeenCalled()
    expect(fake.summary).toHaveBeenCalled()
  })

  it('REQ-DATA-SYNC-034 a dry run never writes or revalidates', async () => {
    await run([])
    expect(fake.upserts).toEqual([])
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('REQ-DATA-SYNC-034 --fix without the table fails naming the real migration file and does not revalidate', async () => {
    fake.stored = 'missing'
    await run(['--fix'])
    expect(exit).toHaveBeenCalledWith(1)
    expect(errors.join('\n')).toContain('20261001023933_game_text_refs.sql')
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

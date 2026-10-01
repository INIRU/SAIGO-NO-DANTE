import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Runs scripts/sync/restore-ego-passives.ts end to end against a fake Supabase client: no database, no network.
const fake = vi.hoisted(() => ({
  passiveRows: [] as Record<string, unknown>[],
  egoUpdates: [] as { id: unknown; patch: Record<string, unknown> }[],
}))

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    from: (table: string) => ({
      select: () => ({
        limit: async () => ({
          data: table === 'ego' ? [{ id: 'ego-uuid', game_id: '1', stages: [{ construe_level: 5 }] }] : fake.passiveRows,
          error: null,
        }),
      }),
      upsert: async (batch: Record<string, unknown>[]) => { fake.passiveRows = batch; return { error: null } },
      update: (patch: Record<string, unknown>) => ({
        eq: async (_column: string, id: unknown) => { fake.egoUpdates.push({ id, patch }); return { error: null } },
      }),
    }),
  }),
}))
vi.mock('@/scripts/sync/identity-data', async importActual => {
  const actual = await importActual<typeof import('@/scripts/sync/identity-data')>()
  const passive = (name: string, desc: string) => ({ name, desc })
  const maps = {
    kr: new Map([[10, passive('하나', '<color=#ff6000>열린 글')], [11, passive('둘', '닫힌 글')]]),
    en: new Map([[10, passive('One', '<color=#ff6000>open')], [11, passive('Two', 'closed')]]),
    jp: new Map([[10, passive('一', '<color=#ff6000>開')], [11, passive('二', '閉')]]),
  }
  return { ...actual, loadEgoSyncContext: () => ({ passives: maps }) }
})

let dir: string
let root: string
const originalArgv = process.argv

async function run(...args: string[]) {
  process.argv = ['node', 'restore-ego-passives.ts', ...args]
  vi.resetModules()
  await import('@/scripts/sync/restore-ego-passives')
  await vi.waitFor(() => {
    if (!log.mock.calls.length && !process.exitCode) throw new Error('script still running')
  })
}
const log = vi.spyOn(console, 'log')

describe('REQ-DATA-SYNC-035 restore-ego-passives script', () => {
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'ego-passives-src-'))
    root = mkdtempSync(join(tmpdir(), 'ego-passives-root-'))
    writeFileSync(join(dir, 'ego-1.txt'), JSON.stringify({ list: [{ id: 1, awakeningPassiveList: [10, 11], passiveList: [] }] }))
    writeFileSync(join(dir, 'passive-1.txt'), JSON.stringify({ list: [{ id: 10, requireIDList: [] }, { id: 11, requireIDList: [] }] }))
    fake.passiveRows = []
    fake.egoUpdates = []
    log.mockReset().mockImplementation(() => undefined)
    process.exitCode = undefined
    vi.stubEnv('LIMBUS_DATA_DIR', dir)
    vi.stubEnv('LIMBUS_RECOVERY_ROOT', root)
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'http://supabase.test')
    vi.stubEnv('SUPABASE_SECRET_KEY', 'secret')
    vi.useFakeTimers({ toFake: ['Date'] })
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllEnvs()
    process.argv = originalArgv
    process.exitCode = undefined
    rmSync(dir, { recursive: true, force: true })
    rmSync(root, { recursive: true, force: true })
  })

  it('REQ-DATA-SYNC-035 closes each passive description before joining them into passive_content', async () => {
    await run('--fix')
    const patch = fake.egoUpdates[0].patch
    expect(patch.passive_content).toBe('<color=#ff6000>열린 글</color>\n\n닫힌 글')
    expect(patch.passive_content_en).toBe('<color=#ff6000>open</color>\n\nclosed')
    expect(patch.passive_content_jp).toBe('<color=#ff6000>開</color>\n\n閉')
    expect(patch.passive_name).toBe('하나\n\n둘')
  })

  it('REQ-DATA-SYNC-035 writes a fresh timestamped backup on every --fix run and keeps the older ones', async () => {
    vi.setSystemTime(new Date('2026-10-01T03:00:00.000Z'))
    await run('--fix')
    const first = readdirSync(root).filter(name => name.startsWith('before-ego-passives'))
    expect(first).toHaveLength(1)
    const firstFiles = readdirSync(join(root, first[0])).sort()
    expect(firstFiles).toEqual(['ego.json', 'ego_passives.json'])
    const firstEgo = readFileSync(join(root, first[0], 'ego.json'), 'utf8')

    process.exitCode = undefined
    log.mockClear()
    vi.setSystemTime(new Date('2026-10-01T04:00:00.000Z'))
    await run('--fix')
    const second = readdirSync(root).filter(name => name.startsWith('before-ego-passives'))
    expect(second).toHaveLength(2)
    expect(second).toContain(first[0])
    expect(readFileSync(join(root, first[0], 'ego.json'), 'utf8')).toBe(firstEgo)
    expect(process.exitCode).toBeUndefined()
  })

  it('REQ-DATA-SYNC-035 writes no backup and changes nothing without --fix', async () => {
    mkdirSync(join(root, 'keep'), { recursive: true })
    await run()
    expect(readdirSync(root).filter(name => name.startsWith('before-ego-passives'))).toHaveLength(0)
    expect(fake.egoUpdates).toHaveLength(0)
  })
})

import { existsSync, mkdtempSync, readFileSync, readdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { NOTE_PREFIX } from '@/lib/notes/blocks'
import { memoKeywordIndex } from '@/lib/notes/memo-keywords'
import { MEMO_FIELDS, planConversion, restoreEditedAtSql, runMemoConversion, type MemoPatch, type MemoRow, type MemoStore, type MemoTable } from '../../scripts/notes/memo-conversion'
import { CATALOG } from '../fixtures/memo-keywords/cases'

beforeAll(() => { vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://example.supabase.co') })

const doc = (...content: object[]) => NOTE_PREFIX + JSON.stringify({ type: 'doc', content })
const paragraph = (text: string) => ({ type: 'paragraph', content: [{ type: 'text', text }] })
const index = memoKeywordIndex(CATALOG)

const rows = (): MemoRow[] => [
  { table: 'decks', id: 'd1', description: '화상 3 부여' },
  { table: 'decks', id: 'd2', description: null },
  { table: 'decks', id: 'd3', description: '키워드 없음' },
  { table: 'md_plans', id: 'p1', description: doc(paragraph('출혈 2 부여')), floor_plan: [
    { floor: 1, memo: '못 박기', gift_ids: ['a'], theme_id: 7 },
    { floor: 2, memo: '' },
    { floor: 3, memo: '그냥 글', constraints: [1] },
  ] },
  { table: 'md_plans', id: 'p2', description: '평문', floor_plan: [{ floor: 1, memo: '충전을 쌓기' }] },
  { table: 'md_plans', id: 'p3', description: '평문', floor_plan: 'not an array' },
]

describe('REQ-DECKS-011 the memo conversion plan covers every memo column', () => {
  it('REQ-DECKS-011 lists decks.description, md_plans.description and every md_plans.floor_plan memo, counts and patches', () => {
    const plan = planConversion(rows(), index)
    expect(MEMO_FIELDS).toEqual(['decks.description', 'md_plans.description', 'md_plans.floor_plan[].memo'])
    expect(plan.summary['decks.description']).toMatchObject({ memos: 3, nonEmpty: 2, changed: 1, chips: 1 })
    expect(plan.summary['md_plans.description']).toMatchObject({ memos: 3, nonEmpty: 3, changed: 1, chips: 1 })
    expect(plan.summary['md_plans.floor_plan[].memo']).toMatchObject({ memos: 4, nonEmpty: 3, changed: 2, chips: 2 })
    expect(plan.patches.map(patch => `${patch.table}:${patch.id}`)).toEqual(['decks:d1', 'md_plans:p1', 'md_plans:p2'])
    expect(plan.changes.find(change => change.id === 'p1' && change.floor === 1)).toMatchObject({ field: 'md_plans.floor_plan[].memo', before: '못 박기', after: '[k:못] 박기', ids: ['못'] })
  })

  it('REQ-DECKS-011 patches only the changed columns and keeps every other field of a floor entry', () => {
    const [deck, plan, second] = planConversion(rows(), index).patches
    expect(deck.patch).toEqual({ description: '[k:화상] 3 부여' })
    expect(Object.keys(plan.patch).sort()).toEqual(['description', 'floor_plan'])
    expect(plan.patch.floor_plan).toEqual([
      { floor: 1, memo: '[k:못] 박기', gift_ids: ['a'], theme_id: 7 },
      { floor: 2, memo: '' },
      { floor: 3, memo: '그냥 글', constraints: [1] },
    ])
    expect(Object.keys(second.patch)).toEqual(['floor_plan'])
  })

  it('REQ-DECKS-011 plans nothing for rows that are already converted', () => {
    const converted = rows().map(row => {
      const patch = planConversion([row], index).patches[0]?.patch
      return patch ? { ...row, ...patch } : row
    })
    expect(planConversion(converted, index).patches).toEqual([])
  })
})

// ── a fake database ─────────────────────────────────────────────────────────

function fakeStore(initial: MemoRow[]) {
  const data = new Map(initial.map(row => [`${row.table}:${row.id}`, structuredClone(row)]))
  const calls: string[] = []
  const store: MemoStore = {
    async loadCatalog() { calls.push('catalog'); return CATALOG },
    async loadRows(table) { calls.push(`read ${table}`); return [...data.values()].filter(row => row.table === table).map(row => structuredClone(row)) },
    async getRow(table, id) { const row = data.get(`${table}:${id}`); return row ? structuredClone(row) : null },
    async loadFullRows(table, ids) {
      calls.push(`backup ${table}`)
      return ids.map(id => ({ ...structuredClone(data.get(`${table}:${id}`)!), ...(table === 'md_plans' ? { content_edited_at: '2026-09-01T00:00:00Z', title: 't' } : { title: 't' }) }))
    },
    async updateRow(table, id, patch: MemoPatch) {
      calls.push(`update ${table}:${id}`)
      const row = data.get(`${table}:${id}`)!
      data.set(`${table}:${id}`, { ...row, ...patch } as MemoRow)
    },
  }
  return { store, data, calls }
}
const tmp = () => mkdtempSync(join(tmpdir(), 'memo-conversion-'))

describe('REQ-DECKS-011 the conversion script', () => {
  it('REQ-DECKS-011 a dry run (the default) writes a JSON and a markdown preview and never updates or backs up', async () => {
    const { store, calls } = fakeStore(rows())
    const outDir = tmp()
    const report = await runMemoConversion(store, { outDir, fix: false, now: new Date('2026-10-01T00:00:00Z') })
    expect(calls.some(call => call.startsWith('update') || call.startsWith('backup'))).toBe(false)
    expect(readdirSync(outDir).sort()).toEqual(['memo-conversion-dry-run.json', 'memo-conversion-dry-run.md'])
    expect(report).toMatchObject({ mode: 'dry-run', totals: { memos: 8, changed: 4, chips: 4, rowsToUpdate: 3 } })
    const json = JSON.parse(readFileSync(join(outDir, 'memo-conversion-dry-run.json'), 'utf8'))
    expect(json.totals.changed).toBe(4)
    expect(json.byKeyword).toEqual({ 못: 1, 충전: 1, 출혈: 1, 화상: 1 })
    expect(json.samples.length).toBeLessThanOrEqual(10)
    expect(json.samples[0]).toHaveProperty('before')
    const markdown = readFileSync(join(outDir, 'memo-conversion-dry-run.md'), 'utf8')
    expect(markdown).toContain('decks.description | 3(2) | 1 | 1')
    expect(markdown).toContain('`화상 3 부여`')
    expect(markdown).toContain('`[k:화상] 3 부여`')
  })

  it('REQ-DECKS-011 takes at most ten samples, one field after the other', async () => {
    const many: MemoRow[] = Array.from({ length: 30 }, (_, at) => ({ table: 'decks', id: `d${at}`, description: '화상 3' }))
    many.push({ table: 'md_plans', id: 'p', description: '출혈', floor_plan: [] })
    const report = await runMemoConversion(fakeStore(many).store, { outDir: tmp(), fix: false })
    expect(report.samples).toHaveLength(10)
    expect(report.samples.slice(0, 2).map(sample => sample.field)).toEqual(['decks.description', 'md_plans.description'])
  })

  it('REQ-DECKS-011 --fix needs a backup directory, and refuses an empty keyword catalog', async () => {
    await expect(runMemoConversion(fakeStore(rows()).store, { outDir: tmp(), fix: true })).rejects.toThrow('--backup')
    const { store } = fakeStore(rows())
    await expect(runMemoConversion({ ...store, loadCatalog: async () => ({}) }, { outDir: tmp(), fix: false })).rejects.toThrow('catalog is empty')
  })

  it('REQ-DECKS-011 --fix backs up the affected whole rows first, updates, reads back and verifies; a second run changes nothing', async () => {
    const { store, calls, data } = fakeStore(rows())
    const outDir = tmp(), backupDir = join(tmp(), 'backup')
    const report = await runMemoConversion(store, { outDir, backupDir, fix: true })
    const firstUpdate = calls.findIndex(call => call.startsWith('update'))
    expect(calls.slice(0, firstUpdate).filter(call => call.startsWith('backup'))).toEqual(['backup decks', 'backup md_plans'])
    expect(readdirSync(backupDir).sort()).toEqual(['decks.json', 'md_plans.json', 'restore-md-plans-content-edited-at.sql'])
    const backedUp = JSON.parse(readFileSync(join(backupDir, 'md_plans.json'), 'utf8'))
    expect(backedUp.map((row: { id: string }) => row.id)).toEqual(['p1', 'p2'])
    expect(backedUp[0]).toMatchObject({ title: 't', description: expect.stringContaining('출혈 2 부여') })
    expect(report.applied).toMatchObject({ updated: 3, verified: 3, skippedChanged: [] })
    expect(data.get('decks:d1')!.description).toBe('[k:화상] 3 부여')
    expect(readFileSync(join(outDir, 'memo-conversion-fix.md'), 'utf8')).toContain('갱신 3행, 읽어서 확인 3행')

    const again = await runMemoConversion(store, { outDir: tmp(), fix: false })
    expect(again.totals.changed).toBe(0)
    const sql = readFileSync(join(backupDir, 'restore-md-plans-content-edited-at.sql'), 'utf8')
    expect(sql).toContain("disable trigger track_plan_content_edit")
    expect(sql).toContain("set content_edited_at = '2026-09-01T00:00:00Z' where id = 'p1'")
  })

  it('REQ-DECKS-011 never overwrites an earlier backup', async () => {
    const backupDir = join(tmp(), 'backup')
    await runMemoConversion(fakeStore(rows()).store, { outDir: tmp(), backupDir, fix: true })
    await expect(runMemoConversion(fakeStore(rows()).store, { outDir: tmp(), backupDir, fix: true })).rejects.toThrow(/EEXIST/)
  })

  it('REQ-DECKS-011 leaves a row alone that was saved by its owner after it was read', async () => {
    const { store, data } = fakeStore(rows())
    const changing: MemoStore = {
      ...store,
      async getRow(table, id) {
        if (table === 'decks' && id === 'd1') data.set('decks:d1', { table: 'decks', id: 'd1', description: '작성자가 방금 고친 글' })
        return store.getRow(table, id)
      },
    }
    const report = await runMemoConversion(changing, { outDir: tmp(), backupDir: join(tmp(), 'b'), fix: true })
    expect(report.applied?.skippedChanged).toEqual([{ table: 'decks', id: 'd1' }])
    expect(data.get('decks:d1')!.description).toBe('작성자가 방금 고친 글')
    expect(report.applied?.updated).toBe(2)
  })

  it('REQ-DECKS-011 fails loudly when what is read back is not what was written', async () => {
    const { store } = fakeStore(rows())
    const lossy: MemoStore = { ...store, async updateRow(table, id, patch) { await store.updateRow(table, id, { ...patch, description: patch.description?.replace('[k:', '[x:') }) } }
    await expect(runMemoConversion(lossy, { outDir: tmp(), backupDir: join(tmp(), 'b'), fix: true })).rejects.toThrow(/differs after the update/)
  })

  it('REQ-DECKS-011 writes nothing and no backup when there is nothing to convert', async () => {
    const { store, calls } = fakeStore([{ table: 'decks', id: 'd', description: '키워드 없음' }])
    const backupDir = join(tmp(), 'backup')
    const report = await runMemoConversion(store, { outDir: tmp(), backupDir, fix: true })
    expect(report.totals.changed).toBe(0)
    expect(calls.some(call => call.startsWith('update'))).toBe(false)
    expect(existsSync(backupDir)).toBe(false)
  })

  it('REQ-DECKS-011 quotes the restore SQL values', () => {
    expect(restoreEditedAtSql([{ id: "a'b", content_edited_at: null }])).toContain("set content_edited_at = null where id = 'a''b'")
    expect(restoreEditedAtSql([])).toBeNull()
  })
})

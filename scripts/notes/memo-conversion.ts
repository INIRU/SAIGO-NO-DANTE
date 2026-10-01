import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { KeywordInfo } from '../../lib/keywords/catalog'
import { notePreviewText } from '../../lib/notes/blocks'
import { convertMemoKeywords, memoKeywordIndex, type MemoConversion, type MemoKeywordIndex, type MemoLocale } from '../../lib/notes/memo-keywords'

/**
 * Plan, report and apply the conversion of old memos to explicit keyword chips (lib/notes/memo-keywords.ts).
 * The memo tables, i.e. every column the memo renderer (NoteRenderer) reads:
 *   limbus.decks.description, limbus.md_plans.description, limbus.md_plans.floor_plan[].memo.
 * (Comments and announcements are drawn without the keyword guess; run logs and share codes live in the browser.)
 * The database is reached only through MemoStore, so the plan is testable and a dry run cannot write.
 */

export type MemoTable = 'decks' | 'md_plans'
export const MEMO_TABLES: readonly MemoTable[] = ['decks', 'md_plans']
export type MemoRow = { table: MemoTable; id: string; description: string | null; floor_plan?: unknown }
export type MemoPatch = { description?: string; floor_plan?: unknown[] }

export interface MemoStore {
  loadCatalog(): Promise<Record<string, KeywordInfo>>
  loadRows(table: MemoTable): Promise<MemoRow[]>
  /** The current memo columns of one row, or null when it is gone. */
  getRow(table: MemoTable, id: string): Promise<MemoRow | null>
  /** The whole rows (every column), for the backup. */
  loadFullRows(table: MemoTable, ids: string[]): Promise<Record<string, unknown>[]>
  updateRow(table: MemoTable, id: string, patch: MemoPatch): Promise<void>
}

export type MemoField = 'decks.description' | 'md_plans.description' | 'md_plans.floor_plan[].memo'
export const MEMO_FIELDS: readonly MemoField[] = ['decks.description', 'md_plans.description', 'md_plans.floor_plan[].memo']

export type MemoChange = {
  field: MemoField
  table: MemoTable
  id: string
  /** floor_plan entry (its `floor` number, else its position) */
  floor?: number
  format: MemoConversion['format']
  chips: number
  escapes: number
  byLocale: Record<MemoLocale, number>
  ids: string[]
  before: string
  after: string
}

export type FieldSummary = {
  memos: number
  nonEmpty: number
  changed: number
  invalid: number
  chips: number
  escapes: number
  byLocale: Record<MemoLocale, number>
}

export type RowPatch = { table: MemoTable; id: string; patch: MemoPatch; before: MemoRow }
export type MemoPlan = { summary: Record<MemoField, FieldSummary>; changes: MemoChange[]; patches: RowPatch[] }

const emptySummary = (): FieldSummary => ({ memos: 0, nonEmpty: 0, changed: 0, invalid: 0, chips: 0, escapes: 0, byLocale: { ko: 0, en: 0, ja: 0 } })

export function planConversion(rows: MemoRow[], index: MemoKeywordIndex): MemoPlan {
  const summary = Object.fromEntries(MEMO_FIELDS.map(field => [field, emptySummary()])) as Record<MemoField, FieldSummary>
  const changes: MemoChange[] = []
  const patches: RowPatch[] = []

  const visit = (field: MemoField, row: MemoRow, value: unknown, floor?: number): MemoConversion | null => {
    const stats = summary[field]
    stats.memos += 1
    if (typeof value !== 'string' || !value.trim()) return null
    stats.nonEmpty += 1
    const result = convertMemoKeywords(value, index)
    if (result.format === 'invalid') stats.invalid += 1
    if (!result.changed) return null
    stats.changed += 1
    stats.chips += result.chips
    stats.escapes += result.escapes
    for (const locale of ['ko', 'en', 'ja'] as const) stats.byLocale[locale] += result.byLocale[locale]
    changes.push({
      field, table: row.table, id: row.id, floor, format: result.format, chips: result.chips, escapes: result.escapes,
      byLocale: result.byLocale, ids: result.ids, before: value, after: result.value,
    })
    return result
  }

  for (const row of rows) {
    const patch: MemoPatch = {}
    const descriptionField: MemoField = row.table === 'decks' ? 'decks.description' : 'md_plans.description'
    const description = visit(descriptionField, row, row.description)
    if (description) patch.description = description.value
    if (row.table === 'md_plans' && Array.isArray(row.floor_plan)) {
      let touched = false
      const floors = row.floor_plan.map((entry: unknown, at: number) => {
        if (!entry || typeof entry !== 'object') return entry
        const floor = (entry as { floor?: unknown }).floor
        const result = visit('md_plans.floor_plan[].memo', row, (entry as { memo?: unknown }).memo, typeof floor === 'number' ? floor : at)
        if (!result) return entry
        touched = true
        return { ...(entry as object), memo: result.value }
      })
      if (touched) patch.floor_plan = floors
    }
    if (Object.keys(patch).length) patches.push({ table: row.table, id: row.id, patch, before: row })
  }
  return { summary, changes, patches }
}

// ─── report ────────────────────────────────────────────────────────────────

/** The window around the first difference of two texts, so a long memo shows what changed. */
export function excerpt(before: string, after: string, radius = 90): [string, string] {
  let at = 0
  while (at < before.length && at < after.length && before[at] === after[at]) at += 1
  const from = Math.max(0, at - radius)
  const cut = (value: string) => (from > 0 ? '…' : '') + value.slice(from, at + radius * 2) + (value.length > at + radius * 2 ? '…' : '')
  return [cut(before), cut(after)]
}

const shown = (value: string, format: MemoConversion['format']) => (format === 'blocks' ? notePreviewText(value) : value)

export type MemoSample = { field: MemoField; id: string; floor?: number; format: MemoConversion['format']; before: string; after: string }

/** `count` samples, taken in turn from each field so every kind of memo is represented. */
export function pickSamples(changes: MemoChange[], count = 10): MemoSample[] {
  const lists = MEMO_FIELDS.map(field => changes.filter(change => change.field === field))
  const samples: MemoSample[] = []
  for (let round = 0; samples.length < count && lists.some(list => list.length > round); round++) {
    for (const list of lists) {
      const change = list[round]
      if (!change || samples.length >= count) continue
      const [before, after] = excerpt(shown(change.before, change.format), shown(change.after, change.format))
      samples.push({ field: change.field, id: change.id, floor: change.floor, format: change.format, before, after })
    }
  }
  return samples
}

export type MemoReport = {
  mode: 'dry-run' | 'fix'
  generatedAt: string
  summary: Record<MemoField, FieldSummary>
  totals: { memos: number; changed: number; chips: number; escapes: number; rowsToUpdate: number; invalid: number }
  /** Chips added per keyword, most first: shows which names (a one-letter one like 못) make most of the chips. */
  byKeyword: Record<string, number>
  samples: MemoSample[]
  /** Every changed memo (without its text; the text is in the backup). */
  changes: Omit<MemoChange, 'before' | 'after'>[]
  /** --fix only */
  applied?: { updated: number; skippedChanged: { table: MemoTable; id: string }[]; verified: number; backupDir: string; restoreSql: string | null }
}

function tally(ids: string[]): Record<string, number> {
  const counts = new Map<string, number>()
  for (const id of ids) counts.set(id, (counts.get(id) ?? 0) + 1)
  return Object.fromEntries([...counts].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1)))
}

export function buildReport(plan: MemoPlan, mode: MemoReport['mode'], now: Date): MemoReport {
  const fields = Object.values(plan.summary)
  return {
    mode,
    generatedAt: now.toISOString(),
    summary: plan.summary,
    totals: {
      memos: fields.reduce((sum, f) => sum + f.nonEmpty, 0),
      changed: fields.reduce((sum, f) => sum + f.changed, 0),
      chips: fields.reduce((sum, f) => sum + f.chips, 0),
      escapes: fields.reduce((sum, f) => sum + f.escapes, 0),
      invalid: fields.reduce((sum, f) => sum + f.invalid, 0),
      rowsToUpdate: plan.patches.length,
    },
    byKeyword: tally(plan.changes.flatMap(change => change.ids)),
    samples: pickSamples(plan.changes),
    changes: plan.changes.map(({ before: _before, after: _after, ...rest }) => rest),
  }
}

const code = (value: string) => '`' + value.replace(/`/g, "'").replace(/\n/g, '⏎') + '`'

export function reportMarkdown(report: MemoReport): string {
  const lines = [
    `# 메모 키워드 칩 변환 ${report.mode === 'fix' ? '(적용 결과)' : '(미리보기, DB를 쓰지 않음)'}`,
    '',
    `생성: ${report.generatedAt}`,
    '',
    `- 내용이 있는 메모 ${report.totals.memos}개 중 변환 대상 ${report.totals.changed}개, 추가되는 칩 ${report.totals.chips}개, 이스케이프(\\) 보존 ${report.totals.escapes}개`,
    `- 갱신할 행 ${report.totals.rowsToUpdate}개, 읽을 수 없는 블록 문서 ${report.totals.invalid}개(건드리지 않음)`,
    '',
    '| 표.열 | 메모(내용 있음) | 변환 | 칩 | 이스케이프 | 칩 언어별 ko/en/ja |',
    '|---|---|---|---|---|---|',
    ...MEMO_FIELDS.map(field => {
      const f = report.summary[field]
      return `| ${field} | ${f.memos}(${f.nonEmpty}) | ${f.changed} | ${f.chips} | ${f.escapes} | ${f.byLocale.ko}/${f.byLocale.en}/${f.byLocale.ja} |`
    }),
    '',
    '## 키워드별 칩 수',
    '',
    Object.entries(report.byKeyword).map(([id, count]) => `${id} ${count}`).join(', ') || '(없음)',
    '',
    '## 예시 (앞 → 뒤)',
    '',
    ...report.samples.flatMap((sample, at) => [
      `${at + 1}. ${sample.field} ${sample.id}${sample.floor !== undefined ? ` 층 ${sample.floor}` : ''} (${sample.format === 'blocks' ? '블록 문서, 칩은 [k:이름]으로 표시' : '평문'})`,
      `   - 앞: ${code(sample.before)}`,
      `   - 뒤: ${code(sample.after)}`,
    ]),
  ]
  if (report.applied) {
    lines.push('', '## 적용', '',
      `- 갱신 ${report.applied.updated}행, 읽어서 확인 ${report.applied.verified}행, 그 사이 바뀌어 건너뜀 ${report.applied.skippedChanged.length}행`,
      `- 백업: ${report.applied.backupDir}`,
      ...(report.applied.restoreSql ? [`- md_plans.content_edited_at 복원 SQL: ${report.applied.restoreSql}`] : []))
  }
  return lines.join('\n') + '\n'
}

// ─── apply ─────────────────────────────────────────────────────────────────

/** JSON with sorted keys: Postgres jsonb hands object keys back in its own order. */
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`
  if (value && typeof value === 'object') {
    return `{${Object.entries(value).sort(([a], [b]) => (a < b ? -1 : 1)).map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(',')}}`
  }
  return JSON.stringify(value) ?? 'null'
}
const sameMemos = (a: MemoRow, b: MemoRow) => a.description === b.description && canonical(a.floor_plan ?? null) === canonical(b.floor_plan ?? null)

/**
 * md_plans.content_edited_at (the "recently edited" list) moves whenever a plan's content changes, and the table's trigger
 * does not let an update set it back. This SQL puts the old values back, with the trigger off while it runs; the
 * manager runs it after the update.
 */
export function restoreEditedAtSql(rows: Record<string, unknown>[]): string | null {
  const plans = rows.filter(row => typeof row.id === 'string')
  if (!plans.length) return null
  const quote = (value: unknown) => (value == null ? 'null' : `'${String(value).replace(/'/g, "''")}'`)
  return [
    '-- Run after the memo conversion: it restores md_plans.content_edited_at, which the update moved to now.',
    'begin;',
    'alter table limbus.md_plans disable trigger track_plan_content_edit;',
    ...plans.map(row => `update limbus.md_plans set content_edited_at = ${quote(row.content_edited_at)} where id = ${quote(row.id)};`),
    'alter table limbus.md_plans enable trigger track_plan_content_edit;',
    'commit;',
    '',
  ].join('\n')
}

export type RunOptions = { outDir: string; backupDir?: string; fix: boolean; now?: Date; log?: (message: string) => void }

export async function runMemoConversion(store: MemoStore, options: RunOptions): Promise<MemoReport> {
  const log = options.log ?? (() => {})
  const now = options.now ?? new Date()
  if (options.fix && !options.backupDir) throw new Error('--fix needs --backup <dir>')

  const catalog = await store.loadCatalog()
  if (!Object.keys(catalog).length) throw new Error('The keyword catalog is empty: refusing to convert without names to match')
  const index = memoKeywordIndex(catalog)
  const rows = (await Promise.all(MEMO_TABLES.map(table => store.loadRows(table)))).flat()
  const plan = planConversion(rows, index)
  const report = buildReport(plan, options.fix ? 'fix' : 'dry-run', now)
  log(`${rows.length} rows read, ${plan.changes.length} memos to convert in ${plan.patches.length} rows`)

  if (options.fix && plan.patches.length) {
    const backupDir = options.backupDir!
    mkdirSync(backupDir, { recursive: true })
    let restoreSql: string | null = null
    // The whole affected rows go to disk before the first update; an existing backup file is never overwritten.
    for (const table of MEMO_TABLES) {
      const ids = plan.patches.filter(patch => patch.table === table).map(patch => patch.id)
      if (!ids.length) continue
      const full = await store.loadFullRows(table, ids)
      if (full.length !== ids.length) throw new Error(`Backup of ${table} read ${full.length} rows for ${ids.length} ids: nothing was updated`)
      writeFileSync(join(backupDir, `${table}.json`), JSON.stringify(full, null, 2), { flag: 'wx' })
      if (table === 'md_plans') {
        restoreSql = restoreEditedAtSql(full)
        if (restoreSql) writeFileSync(join(backupDir, 'restore-md-plans-content-edited-at.sql'), restoreSql, { flag: 'wx' })
      }
    }
    log(`backup written to ${backupDir}`)

    const skippedChanged: { table: MemoTable; id: string }[] = []
    const updated: RowPatch[] = []
    for (const item of plan.patches) {
      // Someone may have saved the row since it was read: then it is left for a later run.
      const current = await store.getRow(item.table, item.id)
      if (!current || !sameMemos(current, item.before)) { skippedChanged.push({ table: item.table, id: item.id }); continue }
      await store.updateRow(item.table, item.id, item.patch)
      updated.push(item)
    }

    // Read back: what is stored must be what was planned, and a second conversion must find nothing left.
    let verified = 0
    for (const item of updated) {
      const saved = await store.getRow(item.table, item.id)
      if (!saved) throw new Error(`${item.table} ${item.id} is gone after the update`)
      if (item.patch.description !== undefined && saved.description !== item.patch.description) throw new Error(`${item.table} ${item.id} description differs after the update`)
      if (item.patch.floor_plan !== undefined && canonical(saved.floor_plan) !== canonical(item.patch.floor_plan)) throw new Error(`${item.table} ${item.id} floor_plan differs after the update`)
      if (planConversion([saved], index).changes.length) throw new Error(`${item.table} ${item.id} is not stable: a second run would change it`)
      verified += 1
    }
    report.applied = { updated: updated.length, skippedChanged, verified, backupDir, restoreSql: restoreSql ? join(backupDir, 'restore-md-plans-content-edited-at.sql') : null }
    log(`updated ${updated.length} rows, verified ${verified}, skipped ${skippedChanged.length}`)
  }

  mkdirSync(options.outDir, { recursive: true })
  const name = `memo-conversion-${report.mode}`
  writeFileSync(join(options.outDir, `${name}.json`), JSON.stringify(report, null, 2))
  writeFileSync(join(options.outDir, `${name}.md`), reportMarkdown(report))
  return report
}

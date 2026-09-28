/**
 * Sync steps log a failed write and keep going. Called by a script run directly, this makes any logged error fail the
 * run, so apply-extraction.ts stops and restores its backup instead of recording a partial apply as a success.
 */
export function failOnLoggedErrors() {
  const original = console.error
  let count = 0
  console.error = (...args: unknown[]) => { count++; original(...args) }
  process.on('exit', () => {
    if (count && !process.exitCode) { original(`${count} error(s) logged: failing the run`); process.exitCode = 1 }
  })
}

/** Machine-readable result line of a sync step: apply-extraction.ts checks its counts (see syncSummaryOf there). */
export function printSyncSummary(summary: Record<string, unknown>) {
  console.log(`SYNC_SUMMARY ${JSON.stringify(summary)}`)
}


type Summary = Record<string, unknown>
const IDENTITY_COUNTS = ['new', 'changed', 'skillDiffs', 'passiveDiffs', 'keywordDiffs', 'egoSkillUpdates', 'egoPassiveUpdates', 'acquisition'] as const

/** What an extraction lacks compared with the DB (before any write): identities, gift/theme/recipe rows and EGO. */
export function extractionGaps(identity: Summary | null, mirror: Summary | null, missingEgos: string[]): string[] {
  if (!identity || !mirror) return ['a sync step printed no SYNC_SUMMARY (site-sync bundle out of date?)']
  const gaps: string[] = []
  const identities = (identity.missingFromSource as string[] | undefined) ?? []
  if (identities.length) gaps.push(`identities ${identities.join(',')}`)
  for (const [section, value] of Object.entries(mirror)) {
    const missing = (value as { missingFromSource?: number }).missingFromSource ?? 0
    if (missing) gaps.push(`${section}: ${missing} DB rows`)
  }
  if (missingEgos.length) gaps.push(`EGO ${missingEgos.join(',')}`)
  return gaps
}

/** Changes a sync step would still make (its dry-run after --fix); anything here means the DB differs from the extraction. */
export function leftoverChanges(identity: Summary | null, mirror: Summary | null): string[] {
  if (!identity || !mirror) return ['a verify step printed no SYNC_SUMMARY']
  const left = IDENTITY_COUNTS.filter(key => Number(identity[key] ?? 0) > 0).map(key => `identity.${key}=${identity[key]}`)
  for (const [section, value] of Object.entries(mirror)) {
    const { new: created = 0, changed = 0 } = value as { new?: number; changed?: number }
    if (created || changed) left.push(`${section}: new ${created}, changed ${changed}`)
  }
  return left
}

/** The SYNC_SUMMARY object a step logged, or null. */
export function parseSyncSummary(log: string): Summary | null {
  const line = log.split(/\r?\n/).reverse().find(text => text.startsWith('SYNC_SUMMARY '))
  return line ? JSON.parse(line.slice('SYNC_SUMMARY '.length)) : null
}

/** Storage key of a public limbus-assets URL, without a cache-busting query (?v=…) and percent-encoding. */
export function storageKeyOf(url: string | null | undefined): string | null {
  const path = String(url ?? '').split('/limbus-assets/')[1]?.split(/[?#]/)[0]
  return path ? decodeURIComponent(path) : null
}

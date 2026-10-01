import { basename, join } from 'node:path'

/** The syncs apply-extraction.ts runs, in order, and how it starts them. No side effects, so tests can read it. */
export type Step = { name: string; script: string; args: string[] }
type Summary = Record<string, unknown>

export const STEPS: Step[] = [
  // Reference table for the [Id]s of raw game text, before the text that uses them lands.
  { name: 'refs', script: 'scripts/sync/game-text-refs.ts', args: [] },
  // --keywords: identity keywords follow the extraction like every other field.
  { name: 'identity', script: 'scripts/sync/identity-data.ts', args: ['--keywords'] },
  // Keyword catalogue (names, descriptions, icons, max stack) for every keyword the identities, EGO and gifts use.
  { name: 'keywords', script: 'scripts/sync/identity-data.ts', args: ['--rebuild-keyword-meta'] },
  // Same sync again: a keyword the catalogue step just added is linked to its reference rows (keyword_name) only now.
  { name: 'refs-link', script: 'scripts/sync/game-text-refs.ts', args: [] },
  // Events come from rebuild-mirror-events; the legacy event section of this script is skipped.
  { name: 'mirror', script: 'scripts/sync/mirror-dungeon-data.ts', args: ['--gifts-only', '--themes-only', '--recipes-only'] },
  { name: 'events', script: 'scripts/sync/rebuild-mirror-events.ts', args: [] },
]

/** Steps whose dry-run is repeated after --fix (events read their rows back themselves). */
export const verifySteps = () => STEPS.filter(step => step.name !== 'events')

/** Node arguments for a script: the bundle next to apply-extraction.mjs on the Windows PC, tsx from the repository otherwise. */
export const stepCommand = (script: string, rest: string[], bundleDir: string | null) => bundleDir
  ? [join(bundleDir, basename(script).replace(/\.ts$/, '.mjs')), ...rest]
  : [...(script.endsWith('.ts') ? ['--import', 'tsx'] : []), script, ...rest]

/**
 * Summaries of the mirror and keyword steps (and, with refs, each reference step under its own name), or null if any step
 * printed none. The completeness check passes refs = false: DB reference rows the source lacks are kept, not a gap.
 */
export function catalogSummaryOf(read: (step: string) => Summary | null, refs: boolean): Summary | null {
  const mirror = read('mirror'), keywords = read('keywords')
  if (!mirror || !keywords) return null
  const merged: Summary = { ...mirror, ...keywords }
  if (!refs) return merged
  for (const name of ['refs', 'refs-link']) {
    const section = read(name)?.gameTextRefs
    if (!section) return null
    merged[name] = section
  }
  return merged
}

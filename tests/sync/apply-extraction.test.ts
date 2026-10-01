import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { STEPS, catalogSummaryOf, stepCommand, verifySteps } from '@/scripts/sync/extraction-steps'
import { RESTORE_TABLES } from '@/scripts/sync/extraction-restore'
import { PLACEHOLDER_CHECK_COLUMNS } from '@/scripts/sync/placeholder-rules'
import { extractionGaps, leftoverChanges } from '@/scripts/sync/sync-result'

const names = STEPS.map(step => step.name)
const REFS = { gameTextRefs: { new: 0, changed: 0, unchanged: 1885, missingFromSource: 2, keywordMatched: 649, keywordUnmatched: 1163, tableMissing: false } }
const MIRROR = { gifts: { new: 0, changed: 0, missingFromSource: 0 } }
const KEYWORDS = { keywordMeta: { new: 0, changed: 0, missingFromSource: 0 } }

describe('REQ-DATA-SYNC-037 apply-extraction steps', () => {
  it('REQ-DATA-SYNC-037 refreshes the reference table before the identity and mirror steps, and links keywords after the catalogue step', () => {
    expect(names).toEqual(['refs', 'identity', 'keywords', 'refs-link', 'mirror', 'events'])
    for (const name of ['refs', 'refs-link']) {
      const step = STEPS.find(item => item.name === name)!
      expect(step.script).toBe('scripts/sync/game-text-refs.ts')
      expect(step.args).toEqual([])
    }
    expect(names.indexOf('refs')).toBeLessThan(names.indexOf('identity'))
    expect(names.indexOf('refs-link')).toBeGreaterThan(names.indexOf('keywords'))
    expect(names.indexOf('refs-link')).toBeLessThan(names.indexOf('mirror'))
  })

  it('REQ-DATA-SYNC-037 checks the reference table again after the apply, like every step but events', () => {
    expect(verifySteps().map(step => step.name)).toEqual(['refs', 'identity', 'keywords', 'refs-link', 'mirror'])
  })

  it('REQ-DATA-SYNC-037 runs the bundled game-text-refs.mjs next to the other bundles, tsx from the repository', () => {
    expect(stepCommand('scripts/sync/game-text-refs.ts', ['--fix'], '/tool/site-sync')).toEqual([resolve('/tool/site-sync', 'game-text-refs.mjs'), '--fix'])
    expect(stepCommand('scripts/sync/game-text-refs.ts', [], null)).toEqual(['--import', 'tsx', 'scripts/sync/game-text-refs.ts'])
  })

  it('REQ-DATA-SYNC-037 builds every script the apply runs as a bundle entry', () => {
    const build = readFileSync('scripts/sync/build-site-sync.mjs', 'utf8')
    const entries = /entryPoints: Object\.fromEntries\(\[([^\]]*)\]/.exec(build)?.[1].match(/'([\w-]+)'/g)?.map(name => name.slice(1, -1)) ?? []
    for (const step of STEPS) expect(entries, step.script).toContain(step.script.replace(/^.*\//, '').replace(/\.ts$/, ''))
    expect(entries).toEqual(expect.arrayContaining(['apply-extraction', 'extraction-restore', 'bootstrap-data', 'game-text-refs']))
  })

  it('REQ-DATA-SYNC-037 counts reference table changes left after the apply, and none before when only DB rows are extra', () => {
    const read = (changed: number) => (step: string) => step === 'mirror' ? MIRROR : step === 'keywords' ? KEYWORDS
      : step === 'refs' ? REFS : step === 'refs-link' ? { gameTextRefs: { ...REFS.gameTextRefs, changed } } : null
    expect(leftoverChanges({}, catalogSummaryOf(read(0), true))).toEqual([])
    expect(leftoverChanges({}, catalogSummaryOf(read(3), true))).toEqual(['refs-link: new 0, changed 3'])
    // DB rows the source lacks are kept, not a missing extraction: only the catalogue steps count for the completeness check.
    expect(extractionGaps({ missingFromSource: [] }, catalogSummaryOf(read(0), false), [])).toEqual([])
    expect(extractionGaps({ missingFromSource: [] }, catalogSummaryOf(read(0), true), [])).toEqual(['refs: 2 DB rows', 'refs-link: 2 DB rows'])
  })

  it('REQ-DATA-SYNC-037 treats a step without a summary as a mismatch', () => {
    const read = (step: string) => step === 'refs-link' ? null : step === 'refs' ? REFS : step === 'mirror' ? MIRROR : KEYWORDS
    expect(catalogSummaryOf(read, true)).toBeNull()
    expect(leftoverChanges({}, catalogSummaryOf(read, true))).toEqual(['a verify step printed no SYNC_SUMMARY'])
    // An older bundle's reference step prints no gameTextRefs section.
    expect(catalogSummaryOf(step => step.startsWith('refs') ? { other: {} } : step === 'mirror' ? MIRROR : KEYWORDS, true)).toBeNull()
  })

  it('REQ-DATA-SYNC-037 backs up and restores game_text_refs with the other tables the apply writes', () => {
    expect(RESTORE_TABLES.find(item => item.table === 'game_text_refs')).toEqual({ table: 'game_text_refs', key: ['id'] })
  })

  it('REQ-DATA-SYNC-037 checks leftover slots only in columns whose builders tokenize them', () => {
    // Raw skill, passive and EGO text keeps its {0}; event option messages are stored without the placeholder rule.
    expect(Object.keys(PLACEHOLDER_CHECK_COLUMNS)).toEqual(['ego_gifts', 'keyword_meta', 'md_events', 'md_event_choices'])
    expect(PLACEHOLDER_CHECK_COLUMNS.md_event_choices).toEqual(['result_text', 'result_text_en', 'result_text_jp'])
    for (const table of ['skills', 'passives', 'ego_skills', 'ego_passives']) expect(PLACEHOLDER_CHECK_COLUMNS).not.toHaveProperty(table)
  })
})

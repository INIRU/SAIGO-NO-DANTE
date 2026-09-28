import { expect, it } from 'vitest'
import { extractionGaps, leftoverChanges, parseSyncSummary, storageKeyOf } from './sync-result'

const clean = { identity: { new: 0, changed: 0, skillDiffs: 0, passiveDiffs: 0, keywordDiffs: 0, egoSkillUpdates: 0, egoPassiveUpdates: 0, acquisition: 0, missingFromSource: [] },
  mirror: { gifts: { new: 0, changed: 0, missingFromSource: 0 }, themes: { new: 0, changed: 0, missingFromSource: 0 } } }

it('refuses an extraction that lacks rows the DB has, and a step without a summary', () => {
  expect(extractionGaps(clean.identity, clean.mirror, [])).toEqual([])
  expect(extractionGaps({ ...clean.identity, missingFromSource: ['10101'] }, { ...clean.mirror, gifts: { new: 0, changed: 0, missingFromSource: 3 } }, ['20106']))
    .toEqual(['identities 10101', 'gifts: 3 DB rows', 'EGO 20106'])
  expect(extractionGaps(null, clean.mirror, [])).toHaveLength(1)
})

it('treats any change left after applying as a mismatch', () => {
  expect(leftoverChanges(clean.identity, clean.mirror)).toEqual([])
  expect(leftoverChanges({ ...clean.identity, skillDiffs: 2 }, { ...clean.mirror, themes: { new: 1, changed: 0, missingFromSource: 0 } }))
    .toEqual(['identity.skillDiffs=2', 'themes: new 1, changed 0'])
  expect(leftoverChanges(clean.identity, null)).toHaveLength(1)
})

it('reads the last SYNC_SUMMARY line of a log', () => {
  expect(parseSyncSummary('x\r\nSYNC_SUMMARY {"new":1}\nSYNC_SUMMARY {"new":0}\n')).toEqual({ new: 0 })
  expect(parseSyncSummary('no summary')).toBeNull()
})

it('derives the storage key of an icon URL without its cache-busting query', () => {
  // Gift 9818 carries ?v=20260926; with it the icon looked missing and its re-upload failed every apply.
  expect(storageKeyOf('https://x.supabase.co/storage/v1/object/public/limbus-assets/ego-gifts/ego-gift-ff2659fa.webp?v=20260926')).toBe('ego-gifts/ego-gift-ff2659fa.webp')
  expect(storageKeyOf('https://x/limbus-assets/sinners/outis/ego/To%20P%C3%A1thos/1.webp')).toBe('sinners/outis/ego/To Páthos/1.webp')
  expect(storageKeyOf(null)).toBeNull()
})

const { test } = require('node:test')
const assert = require('node:assert/strict')
const { selectEntries } = require('../../scripts/assets/sync-extracted-identities.cjs')
test('info-only selects original portraits without aliases, skills, or other identities', () => {
  const entries = [
    { kind: '인격', name: '10416_normal' },
    { kind: '인격', name: '10416_normal_info' },
    { kind: '인격', name: '10816_normal_info' },
    { kind: '스킬', name: '1041601' },
    { kind: '인격', name: '10416_normal_info_info' },
    { kind: '인격', name: '10416_gacksung_info_extra' },
    { kind: '인격', name: '104160_normal_info' },
  ]
  assert.deepEqual(selectEntries(entries, '10416', 'info'), [entries[1]])
  assert.deepEqual(selectEntries(entries, '10416', null), [entries[0], entries[1], entries[3]])
  assert.deepEqual(selectEntries([entries[0]], '10416', 'info'), [])
})
test('REQ-DATA-SYNC-010 selects avatar profiles by default and alone with profile-only', () => {
  // 2026-09-24: 10917 and earlier 10416/10816 were synced without their 256 px profiles, so avatars fell back to the
  // full illustration and were cropped.
  const entries = [
    { kind: '인격', name: '10917_normal' },
    { kind: '인격', name: '10917_normal_profile' },
    { kind: '인격', name: '10917_gacksung_profile' },
    { kind: '인격', name: '10917_normal_profile_support_personality' },
    { kind: '스킬', name: '1091701' },
  ]
  assert.deepEqual(selectEntries(entries, '10917', null), [entries[0], entries[1], entries[2], entries[3], entries[4]])
  assert.deepEqual(selectEntries(entries, '10917', 'profile'), [entries[1], entries[2]])
})
test('REQ-DATA-SYNC-048 selects the support strips by default and alone with support-only', () => {
  // 2026-10-07: the game's support line-up art (197x982) was in the extraction but never uploaded, so the 21 newest
  // identities (10917, 10315, ...) had none.
  const entries = [
    { kind: '인격', name: '10917_gacksung' },
    { kind: '인격', name: '10917_gacksung_profile' },
    { kind: '인격', name: '10917_normal_profile_support_personality' },
    { kind: '인격', name: '10917_gacksung_profile_support_personality' },
    { kind: '인격', name: '10917_gacksung_profile_support_personality_fix' },
    { kind: '인격', name: '10915_gacksung_profile_support_personality' },
    { kind: '스킬', name: '1091701' },
  ]
  assert.deepEqual(selectEntries(entries, '10917', null), [entries[0], entries[1], entries[2], entries[3], entries[6]])
  assert.deepEqual(selectEntries(entries, '10917', 'support'), [entries[2], entries[3]])
  assert.deepEqual(selectEntries(entries, '10917', 'profile'), [entries[1]])
})

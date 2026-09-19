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
  assert.deepEqual(selectEntries(entries, '10416', true), [entries[1]])
  assert.deepEqual(selectEntries(entries, '10416', false), [entries[0], entries[1], entries[3]])
  assert.deepEqual(selectEntries([entries[0]], '10416', true), [])
})

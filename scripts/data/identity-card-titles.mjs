// Builds lib/data/identity-card-titles.json: in-game identity titles with their own line breaks ("LCB\n수감자").
// Usage: LIMBUS_DATA_DIR=~/Downloads/LimbusAssets-sync-2026-09-24/complete-data node scripts/data/identity-card-titles.mjs
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.env.LIMBUS_DATA_DIR
if (!root) throw new Error('LIMBUS_DATA_DIR is required')
const out = {}
for (const [dir, lang] of [['KR', 'ko'], ['EN', 'en'], ['JP', 'ja']]) {
  for (const file of readdirSync(join(root, dir)).filter(name => new RegExp('^' + dir + '_Personalities(-.+)?\\.txt$').test(name))) {
    for (const entry of JSON.parse(readFileSync(join(root, dir, file), 'utf8')).dataList ?? []) {
      if (!entry?.id || typeof entry.title !== 'string') continue
      ;(out[entry.id] ??= {})[lang] = entry.title.replace(/\r/g, '')
    }
  }
}
const sorted = Object.fromEntries(Object.entries(out).sort(([a], [b]) => Number(a) - Number(b)))
writeFileSync('lib/data/identity-card-titles.json', JSON.stringify(sorted, null, 1) + '\n')
console.log(Object.keys(sorted).length, 'identities')

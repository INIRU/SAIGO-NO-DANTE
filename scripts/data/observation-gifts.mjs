#!/usr/bin/env node
/**
 * Writes lib/data/observation-gifts.json from the game's Mirror Dungeon observation data: the only gifts the start
 * observation can offer, and the starlight cost for observing 1, 2 or 3 of them.
 *   LIMBUS_DATA_DIR=<complete-data> node scripts/data/observation-gifts.mjs
 */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const dir = process.env.LIMBUS_DATA_DIR
if (!dir) throw new Error('LIMBUS_DATA_DIR is required')
const file = readdirSync(dir).filter(name => /^mirror-dungeon-egogift-observation-data-md\d+\.(txt|json)$/.test(name))
  .sort((a, b) => Number(b.match(/md(\d+)/)[1]) - Number(a.match(/md(\d+)/)[1]))[0]
if (!file) throw new Error('observation data not found in ' + dir)
const data = JSON.parse(readFileSync(join(dir, file), 'utf8').replace(/^\uFEFF/, ''))
const entry = data.list.at(-1)
const giftIds = [...new Set(entry.observationEgoGiftDataList.flatMap(group => group.egogiftIdList))].sort((a, b) => a - b)
const costs = entry.observationEgoGiftCostDataList.map(row => ({ count: row.egogiftCount, starlight: row.starlightCost }))
writeFileSync('lib/data/observation-gifts.json', JSON.stringify({ source: file, mirrorDungeonId: entry.mirrordungeonId, costs, giftIds }, null, 1) + '\n')
console.log(file, giftIds.length, 'gifts', JSON.stringify(costs))

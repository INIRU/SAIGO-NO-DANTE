#!/usr/bin/env node
/**
 * Writes lib/data/start-gifts.json from the game's Mirror Dungeon common data: the three start E.G.O gifts of each keyword.
 *   LIMBUS_DATA_DIR=<complete-data> node scripts/data/start-gifts.mjs
 */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const dir = process.env.LIMBUS_DATA_DIR
if (!dir) throw new Error('LIMBUS_DATA_DIR is required')
const file = readdirSync(dir).filter(name => /^mirror-dungeon-common-data-md\d+\.(txt|json)$/.test(name))
  .sort((a, b) => Number(b.match(/md(\d+)/)[1]) - Number(a.match(/md(\d+)/)[1]))[0]
if (!file) throw new Error('common data not found in ' + dir)
const data = JSON.parse(readFileSync(join(dir, file), 'utf8').replace(/^﻿/, ''))
const pools = data.startEgoGiftPools.map(pool => ({ keyword: pool.keyword, giftIds: [...pool.normalpool].sort((a, b) => a - b) }))
writeFileSync('lib/data/start-gifts.json', JSON.stringify({ source: file, mirrorDungeonId: data.currentDungeonId, pools }, null, 1) + '\n')
console.log(file, pools.map(pool => `${pool.keyword} ${pool.giftIds.join(',')}`).join(' | '))

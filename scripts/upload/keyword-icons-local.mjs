#!/usr/bin/env node
/**
 * Upload selected keyword icons from a trusted local asset directory.
 *
 * Usage:
 *   node --env-file=.env.local scripts/upload/keyword-icons-local.mjs --dry-run
 *   node --env-file=.env.local scripts/upload/keyword-icons-local.mjs --fix
 *   node --env-file=.env.local scripts/upload/keyword-icons-local.mjs --keyword "아이언 메이든" --fix
 */

import { createClient } from '@supabase/supabase-js'
import sharp from 'sharp'
import { existsSync, readdirSync, readFileSync } from 'fs'
import { basename, extname, join, resolve } from 'path'
import { homedir } from 'os'

const args = process.argv.slice(2)
const FIX = args.includes('--fix')
const DRY_RUN = args.includes('--dry-run') || !FIX
const sourceDirArg = args.indexOf('--source-dir')
const SOURCE_DIR = sourceDirArg === -1
  ? resolve(join(homedir(), 'Downloads/General'))
  : resolve(args[sourceDirArg + 1])
const keywordFilters = args
  .flatMap((arg, index) => (arg === '--keyword' && args[index + 1] ? [args[index + 1]] : []))

const TARGETS = [
  {
    keyword: '아이언 메이든',
    slug: 'iron-maiden',
    localName: 'Iron Maiden',
    preferIdentityDuplicate: true,
  },
  {
    keyword: '원호 공격',
    slug: 'assist-attack',
    localName: 'Assist Attack',
    preferIdentityDuplicate: true,
  },
  {
    keyword: '원호 방어',
    slug: 'assist-defense',
    localName: 'Assist Defense',
    preferIdentityDuplicate: true,
  },
]

const selectedTargets = keywordFilters.length > 0
  ? TARGETS.filter(target => keywordFilters.includes(target.keyword))
  : TARGETS

function usageAndExit(message) {
  if (message) console.error(message)
  console.error('Usage: node --env-file=.env.local scripts/upload/keyword-icons-local.mjs [--dry-run|--fix] [--source-dir <dir>] [--keyword <name>]')
  process.exit(1)
}

function duplicateSuffixNumber(stem, localName) {
  if (stem === localName) return 0
  const escaped = localName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = stem.match(new RegExp(`^${escaped}(?:\\s+|\\s*[-_]\\s*|\\s*\\()(\\d+)\\)?$`, 'i'))
  return match ? Number(match[1]) : null
}

function findLocalIcon(files, target) {
  const candidates = files
    .map(file => {
      const ext = extname(file)
      const stem = basename(file, ext)
      const duplicateNumber = duplicateSuffixNumber(stem, target.localName)
      return duplicateNumber === null ? null : {
        file,
        duplicateNumber,
        path: join(SOURCE_DIR, file),
      }
    })
    .filter(Boolean)
    .sort((a, b) => {
      const duplicateRank = (candidate) => (
        target.preferIdentityDuplicate && candidate.duplicateNumber === 2 ? 0 :
        candidate.duplicateNumber === 0 ? 1 :
        2
      )
      return duplicateRank(a) - duplicateRank(b)
        || a.duplicateNumber - b.duplicateNumber
        || a.file.localeCompare(b.file)
    })

  return candidates[0] ?? null
}

async function main() {
  if (!existsSync(SOURCE_DIR)) usageAndExit(`Source directory not found: ${SOURCE_DIR}`)
  if (selectedTargets.length === 0) usageAndExit(`No matching target for --keyword ${keywordFilters.join(', ')}`)

  const files = readdirSync(SOURCE_DIR)
    .filter(file => /\.(png|jpe?g|webp)$/i.test(file))
    .sort()
  const plan = selectedTargets.map(target => ({
    target,
    icon: findLocalIcon(files, target),
    storagePath: `icons/keywords/${target.slug}.webp`,
  }))

  for (const item of plan) {
    if (!item.icon) {
      throw new Error(`No local icon found for ${item.target.keyword} (${item.target.localName}) in ${SOURCE_DIR}`)
    }
    const duplicateNote = item.icon.duplicateNumber === 2
      ? 'identity duplicate suffix preferred'
      : 'exact or deterministic fallback'
    console.log(`${DRY_RUN ? '[dry-run]' : '[fix]'} ${item.target.keyword}: ${item.icon.file} -> ${item.storagePath} (${duplicateNote})`)
  }

  if (DRY_RUN) {
    console.log('\nDRY RUN: no storage upload or keyword_meta update executed.')
    return
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY
  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY/SUPABASE_SECRET_KEY')
  }

  const supabase = createClient(supabaseUrl, supabaseKey)

  for (const item of plan) {
    const sourceBuffer = readFileSync(item.icon.path)
    const webpBuffer = await sharp(sourceBuffer).webp({ quality: 90 }).toBuffer()
    const { error: uploadError } = await supabase.storage
      .from('limbus-assets')
      .upload(item.storagePath, webpBuffer, {
        contentType: 'image/webp',
        upsert: true,
      })
    if (uploadError) throw new Error(`Storage upload failed for ${item.target.keyword}: ${uploadError.message}`)

    const { error: updateError } = await supabase
      .schema('limbus')
      .from('keyword_meta')
      .update({ icon_slug: item.target.slug })
      .eq('name', item.target.keyword)
    if (updateError) throw new Error(`keyword_meta update failed for ${item.target.keyword}: ${updateError.message}`)

    console.log(`uploaded ${item.target.keyword} -> ${item.storagePath}, icon_slug=${item.target.slug}`)
  }
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})

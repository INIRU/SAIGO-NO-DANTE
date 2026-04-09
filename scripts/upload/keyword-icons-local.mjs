import { createClient } from '@supabase/supabase-js'
import sharp from 'sharp'
import { readFileSync, readdirSync } from 'fs'
import { join } from 'path'

const SOURCE_DIR = '/Users/iniru/Downloads/General'
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { db: { schema: 'limbus' } }
)

// Options
const args = process.argv.slice(2)
const dryRun = args.includes('--dry-run')
const updateDb = args.includes('--update-db')

// Common non-ASCII → ASCII replacements
const CHAR_MAP = {
  'α': 'alpha', 'β': 'beta', 'γ': 'gamma',
  'ā': 'a', 'ē': 'e', 'ī': 'i', 'ō': 'o', 'ū': 'u',
  'æ': 'ae', 'œ': 'oe', 'ñ': 'n',
}

function slugify(filename) {
  let s = filename.replace(/\.png$/i, '').toLowerCase()
  // Replace known non-ASCII chars
  for (const [from, to] of Object.entries(CHAR_MAP)) {
    s = s.replaceAll(from, to)
  }
  return s
    .replace(/[\[\]【】()（）!?'",.:;\/\\]/g, '') // strip brackets/parens/punctuation/slashes
    .replace(/[^\x20-\x7E]/g, '')              // strip remaining non-ASCII
    .replace(/\s+/g, '-')                      // spaces → hyphens
    .replace(/-{2,}/g, '-')                    // collapse multiple hyphens
    .replace(/^-|-$/g, '')                     // trim leading/trailing hyphens
}

function findPngs(dir) {
  const results = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      results.push(...findPngs(join(dir, entry.name)))
    } else if (entry.name.endsWith('.png')) {
      results.push({ fullPath: join(dir, entry.name), filename: entry.name })
    }
  }
  return results
}

async function uploadIcons() {
  const pngFiles = findPngs(SOURCE_DIR).sort((a, b) => a.filename.localeCompare(b.filename))
  console.log(`Found ${pngFiles.length} PNG files in General/ (including subfolders)\n`)

  let uploaded = 0, skipped = 0, failed = 0

  // Process in batches of 10
  for (let i = 0; i < pngFiles.length; i += 10) {
    const batch = pngFiles.slice(i, i + 10)
    await Promise.all(batch.map(async ({ fullPath, filename }) => {
      const slug = slugify(filename)
      if (!slug) {
        console.log(`  [SKIP] ${filename} (empty slug after sanitization)`)
        skipped++
        return
      }
      const destPath = `icons/keywords/${slug}.webp`

      if (dryRun) {
        console.log(`  [DRY] ${filename} → ${destPath}`)
        return
      }

      try {
        const pngBuf = readFileSync(fullPath)
        const webpBuf = await sharp(pngBuf).webp({ quality: 85 }).toBuffer()

        const { error } = await supabase.storage
          .from('limbus-assets')
          .upload(destPath, webpBuf, {
            contentType: 'image/webp',
            upsert: true,
          })

        if (error) throw error
        uploaded++
        console.log(`  ✓ ${filename} → ${slug}.webp (${webpBuf.length} bytes)`)
      } catch (e) {
        failed++
        console.error(`  ✗ ${filename}: ${e.message}`)
      }
    }))
  }

  console.log(`\nDone: ${uploaded} uploaded, ${skipped} skipped, ${failed} failed`)
}

// KR name → EN slug for keywords without name_en
const KR_TO_SLUG = {
  // Status effect 강화 → base icon
  '화상 강화': 'burn', '출혈 강화': 'bleed', '충전 강화': 'charge',
  '침잠 강화': 'sinking', '진동 강화': 'tremor', '파열 강화': 'rupture',
  '호흡 강화': 'poise',
  // Sin 강화 → sin icon
  '분노 강화': 'wrath', '색욕 강화': 'lust', '나태 강화': 'sloth',
  '탐식 강화': 'gluttony', '우울 강화': 'gloom', '오만 강화': 'pride',
  '질투 강화': 'envy',
  // Sanity-related
  '창백한 소음': 'aacepbba', '소음 공황': 'aacepbbb',
  '불순': 'aacepbbc',
  // KR-only keywords → known storage slugs
  '순환': 'cycle', '교본': 'manual',
  '분열': 'splitting-low-morale', '복수': 'revenge-low-morale',
  '도주': 'fleeing',
  '압도 (사기저하)': 'overwhelmed-1',
  '부활': 'resurrection',
}

// Try multiple slug strategies to find a match
function findBestSlug(nameEn, krName, availableSlugs) {
  if (!nameEn && !krName) return null

  const strategies = []

  if (nameEn) {
    const directSlug = slugify(nameEn + '.png')
    // 1. Direct match
    if (availableSlugs.has(directSlug)) return directSlug

    // 2. Handle apostrophe variants: 's → _s (files may use underscore)
    const underscoreSlug = nameEn.toLowerCase()
      .replace(/'/g, '_')
      .replace(/[\[\]【】()（）!?",.:;#\/\\]/g, '')
      .replace(/[^\x20-\x7E]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-{2,}/g, '-')
      .replace(/^-|-$/g, '')
    if (availableSlugs.has(underscoreSlug)) return underscoreSlug

    // 3. Strip trailing Roman numerals / numbers and try base icon
    //    e.g. "Base Power Up IV" → "base-power-up", "Resilient XII" → "resilient"
    const baseSlug = directSlug
      .replace(/-(?:i{1,3}|iv|v|vi{0,3}|ix|x{0,3}i{0,3}|x{0,3}v?i{0,3})$/, '')
      .replace(/-\d+$/, '')
    if (baseSlug !== directSlug && availableSlugs.has(baseSlug)) return baseSlug

    // 4. Try with trailing period stripped (some EN names have periods)
    const noPeriod = directSlug.replace(/\.+$/, '')
    if (noPeriod !== directSlug && availableSlugs.has(noPeriod)) return noPeriod

    // 5. Strip "boost" → try "up" variant  (e.g. "base-power-boost" → "base-power-up")
    const boostToUp = directSlug.replace(/boost$/, 'up')
    if (boostToUp !== directSlug && availableSlugs.has(boostToUp)) return boostToUp

    // 6. Strip "spurt" → try "up" variant
    const spurtToUp = directSlug.replace(/spurt$/, 'up')
    if (spurtToUp !== directSlug && availableSlugs.has(spurtToUp)) return spurtToUp

    // 7. Suffix variants: try with "-1" or "-2" appended (e.g. "the-church" → "the-church-1")
    if (availableSlugs.has(directSlug + '-1')) return directSlug + '-1'

    // 8. "resist-up" → try "resist-down" (same icon family, only down variant exists)
    const resistUpToDown = directSlug.replace(/resist-up$/, 'resist-down')
    if (resistUpToDown !== directSlug && availableSlugs.has(resistUpToDown)) return resistUpToDown

    // 9. Strip "(low-morale)" or "(panic)" suffixes and try base
    const baseSanity = directSlug.replace(/-?low-morale$/, '').replace(/-?panic$/, '')
    if (baseSanity !== directSlug && availableSlugs.has(baseSanity)) return baseSanity

    // 10. For sanity keywords, try with "-low-morale" or "-panic" suffix
    if (availableSlugs.has(directSlug + '-low-morale')) return directSlug + '-low-morale'
    if (availableSlugs.has(directSlug + '-panic')) return directSlug + '-panic'

    // 11. "Declared Duel - X" → "declared-duel"
    if (directSlug.startsWith('declared-duel-')) {
      if (availableSlugs.has('declared-duel')) return 'declared-duel'
    }

    // 12. "X Boost" → try "X" base (e.g. "slash-boost" → "slash")
    const boostBase = directSlug.replace(/-boost$/, '')
    if (boostBase !== directSlug && availableSlugs.has(boostBase)) return boostBase

    // 12b. Strip trailing "used" / "activated" etc (e.g. "k-corp-ampule-used" → "k-corp-ampule")
    const stripUsed = directSlug.replace(/-(used|activated)$/, '')
    if (stripUsed !== directSlug && availableSlugs.has(stripUsed)) return stripUsed

    // 13. "Coin Power Up I" → "coin-power-up" (strip level suffix from underscore slug too)
    const underscoreBase = underscoreSlug
      .replace(/-(?:i{1,3}|iv|v|vi{0,3}|ix|x{0,3}i{0,3}|x{0,3}v?i{0,3})$/, '')
      .replace(/-\d+$/, '')
    if (underscoreBase !== underscoreSlug && availableSlugs.has(underscoreBase)) return underscoreBase

    // 14. "Atrophied (Low Morale)" → "atrophied-1" (specific mapping for sanity states)
    const lowMoraleTo1 = directSlug.replace(/-low-morale$/, '-1')
    if (lowMoraleTo1 !== directSlug && availableSlugs.has(lowMoraleTo1)) return lowMoraleTo1
    const panicTo2 = directSlug.replace(/-panic$/, '-2')
    if (panicTo2 !== directSlug && availableSlugs.has(panicTo2)) return panicTo2
  }

  // 15. KR-only: check the manual translation map
  if (krName && KR_TO_SLUG[krName]) {
    const mappedSlug = KR_TO_SLUG[krName]
    if (availableSlugs.has(mappedSlug)) return mappedSlug
  }

  // 16. KR pattern matching for entries without name_en
  if (krName && !nameEn) {
    // 거울의 거울 entries (floor indicators) - no icon needed
    if (krName.startsWith('거울의 거울')) return null
  }

  return null
}

async function updateKeywordMetaIcons() {
  console.log('\n── Updating keyword_meta.icon_slug (enhanced matching) ──\n')

  // 1. List all files in icons/keywords/ from Storage
  const { data: storageFiles, error: listErr } = await supabase.storage
    .from('limbus-assets')
    .list('icons/keywords', { limit: 2000 })

  if (listErr) {
    console.error('Failed to list storage files:', listErr.message)
    return
  }

  const availableSlugs = new Set(
    storageFiles
      .filter(f => f.name.endsWith('.webp'))
      .map(f => f.name.replace(/\.webp$/, ''))
  )
  console.log(`Found ${availableSlugs.size} icons in storage`)

  // 2. Query all keyword_meta entries
  const { data: keywords, error: queryErr } = await supabase
    .from('keyword_meta')
    .select('name, name_en, icon_slug')

  if (queryErr) {
    console.error('Failed to query keyword_meta:', queryErr.message)
    return
  }

  console.log(`Found ${keywords.length} keyword_meta entries`)
  console.log(`  Already have icon_slug: ${keywords.filter(k => k.icon_slug).length}`)
  console.log(`  Missing icon_slug: ${keywords.filter(k => !k.icon_slug).length}\n`)

  let updated = 0, matched = 0, noMatch = 0, alreadyCorrect = 0
  const unmatchedList = []

  for (const kw of keywords) {
    const slug = findBestSlug(kw.name_en, kw.name, availableSlugs)

    if (slug) {
      matched++
      if (kw.icon_slug === slug) {
        alreadyCorrect++
        continue
      }

      if (dryRun) {
        console.log(`  [DRY] ${kw.name} → icon_slug: "${slug}"`)
        updated++
        continue
      }

      const { error: updateErr } = await supabase
        .from('keyword_meta')
        .update({ icon_slug: slug })
        .eq('name', kw.name)

      if (updateErr) {
        console.error(`  ✗ ${kw.name}: ${updateErr.message}`)
      } else {
        updated++
        console.log(`  ✓ ${kw.name} → icon_slug: "${slug}"`)
      }
    } else {
      if (!kw.icon_slug) {
        noMatch++
        unmatchedList.push({ name: kw.name, name_en: kw.name_en })
      }
    }
  }

  console.log(`\nResults:`)
  console.log(`  Matched: ${matched} (${alreadyCorrect} already correct, ${updated} updated)`)
  console.log(`  No match: ${noMatch}`)

  if (unmatchedList.length > 0) {
    console.log(`\n── Still unmatched (${unmatchedList.length}) ──`)
    for (const u of unmatchedList) {
      console.log(`  ${u.name}${u.name_en ? ' (' + u.name_en + ')' : ''}`)
    }
  }
}

async function main() {
  if (updateDb) {
    await updateKeywordMetaIcons()
  } else {
    await uploadIcons()
  }
}

main()

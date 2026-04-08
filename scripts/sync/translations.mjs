/**
 * sync-translations.mjs
 *
 * Parses EN and JP locale files from the game data directory and upserts
 * them into the limbus.game_translations Supabase table.
 *
 * Usage:
 *   node --env-file=.env.local scripts/sync/translations.mjs
 *   node --env-file=.env.local scripts/sync/translations.mjs --dry-run
 *   node --env-file=.env.local scripts/sync/translations.mjs --lang en
 *   node --env-file=.env.local scripts/sync/translations.mjs --lang jp
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const DATA_DIR = '/Users/iniru/Documents/Limbus/assets/data/Json (Text)';
const BATCH_SIZE = 500;

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const LANG_FILTER = (() => {
  const idx = args.indexOf('--lang');
  if (idx !== -1) return args[idx + 1]?.toLowerCase();
  return null; // null = sync both
})();

// ---------------------------------------------------------------------------
// Supabase client
// ---------------------------------------------------------------------------

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
).schema('limbus');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Read a game data file, strip BOM, parse JSON. Returns dataList array. */
function readDataList(filename) {
  const filepath = path.join(DATA_DIR, filename);
  if (!fs.existsSync(filepath)) return null;
  const raw = fs.readFileSync(filepath, 'utf8').replace(/^\uFEFF/, '');
  const parsed = JSON.parse(raw);
  return parsed.dataList ?? [];
}

/** Upsert rows into limbus.game_translations in batches of BATCH_SIZE. */
async function upsertBatches(rows, label) {
  if (rows.length === 0) {
    console.log(`  [${label}] 0 rows — skipped`);
    return;
  }

  if (DRY_RUN) {
    console.log(`  [${label}] DRY RUN — would upsert ${rows.length} rows`);
    return;
  }

  let inserted = 0;
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const { error } = await supabase
      .from('game_translations')
      .upsert(batch, { onConflict: 'entity_type,entity_id,lang' });
    if (error) {
      console.error(`  [${label}] Batch ${Math.floor(i / BATCH_SIZE) + 1} error:`, error.message);
    } else {
      inserted += batch.length;
    }
  }
  console.log(`  [${label}] Upserted ${inserted} / ${rows.length} rows`);
}

/** Given a levelList array, return the entry with the highest level value. */
function highestLevel(levelList) {
  if (!levelList || levelList.length === 0) return null;
  return levelList.reduce((best, cur) => (cur.level > best.level ? cur : best));
}

// ---------------------------------------------------------------------------
// Parsers — return arrays of { entity_type, entity_id, lang, name, description }
// ---------------------------------------------------------------------------

function parseBattleKeywords(dataList, lang) {
  return dataList
    .filter(item => item.id && item.name)
    .map(item => ({
      entity_type: 'keyword',
      entity_id: String(item.id),
      lang,
      name: item.name ?? null,
      description: item.desc ?? null,
    }));
}

function parseSkills(dataList, lang) {
  const rows = [];
  for (const item of dataList) {
    if (!item.id || !item.levelList?.length) continue;
    const top = highestLevel(item.levelList);
    if (!top) continue;
    rows.push({
      entity_type: 'skill',
      entity_id: String(item.id),
      lang,
      name: top.name ?? null,
      description: top.desc ?? null,
    });
  }
  return rows;
}

function parsePassives(dataList, lang) {
  return dataList
    .filter(item => item.id)
    .map(item => ({
      entity_type: 'passive',
      entity_id: String(item.id),
      lang,
      name: item.name ?? null,
      description: item.desc ?? null,
    }));
}

function parseEgoGifts(dataList, lang) {
  return dataList
    .filter(item => item.id)
    .map(item => ({
      entity_type: 'ego_gift',
      entity_id: String(item.id),
      lang,
      name: item.name ?? null,
      description: item.desc ?? null,
    }));
}

function parseBufs(dataList, lang) {
  return dataList
    .filter(item => item.id)
    .map(item => ({
      entity_type: 'buf',
      entity_id: String(item.id),
      lang,
      name: item.name ?? null,
      description: item.desc ?? null,
    }));
}

// ---------------------------------------------------------------------------
// File groups: { label, files, parser }
// Each entry in files is { prefix } — prefix will be combined with lang token
// ---------------------------------------------------------------------------

const FILE_GROUPS = [
  {
    label: 'BattleKeywords',
    files: [
      { name: 'BattleKeywords.txt' },
      { name: 'BattleKeywords-cultivation.txt' },
    ],
    parser: parseBattleKeywords,
  },
  {
    label: 'Skills (personality)',
    // Discovered at runtime via glob pattern
    filesPattern: /^{LANG}_Skills_personality-\d+\.txt$/,
    parser: parseSkills,
  },
  {
    label: 'Passives',
    files: [
      { name: 'Passives.txt' },
    ],
    parser: parsePassives,
  },
  {
    label: 'EGO Gifts',
    files: [
      { name: 'EGOgift_cultivation.txt' },
      { name: 'EGOgift_MirrorDungeon-StoryTheme.txt' },
    ],
    parser: parseEgoGifts,
  },
  {
    label: 'Bufs',
    files: [
      { name: 'Bufs.txt' },
      { name: 'Bufs-cultivation.txt' },
    ],
    parser: parseBufs,
  },
];

// ---------------------------------------------------------------------------
// Per-language sync
// ---------------------------------------------------------------------------

async function syncLang(lang) {
  const prefix = lang.toUpperCase(); // 'EN' or 'JP'
  console.log(`\n=== Language: ${prefix} ===`);

  // Enumerate all files in DATA_DIR once for pattern matching
  const allFiles = fs.readdirSync(DATA_DIR);

  for (const group of FILE_GROUPS) {
    let filenames = [];

    if (group.filesPattern) {
      // Dynamic discovery: match {LANG}_Skills_personality-NN.txt
      const pattern = new RegExp(`^${prefix}_Skills_personality-\\d+\\.txt$`);
      filenames = allFiles.filter(f => pattern.test(f));
    } else {
      filenames = group.files.map(f => `${prefix}_${f.name}`);
    }

    const rows = [];
    for (const filename of filenames) {
      const dataList = readDataList(filename);
      if (dataList === null) {
        console.log(`  [${group.label}] ${filename} — not found, skipping`);
        continue;
      }
      const parsed = group.parser(dataList, lang.toLowerCase());
      rows.push(...parsed);
      console.log(`  [${group.label}] ${filename} — ${parsed.length} entries parsed`);
    }

    await upsertBatches(rows, group.label);
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('ERROR: Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  console.log(`sync-translations.mjs`);
  console.log(`  DRY_RUN: ${DRY_RUN}`);
  console.log(`  LANG_FILTER: ${LANG_FILTER ?? 'both'}`);
  console.log(`  DATA_DIR: ${DATA_DIR}`);
  console.log(`  BATCH_SIZE: ${BATCH_SIZE}`);

  const langs = LANG_FILTER
    ? [LANG_FILTER]
    : ['en', 'jp'];

  for (const lang of langs) {
    await syncLang(lang);
  }

  console.log('\nDone.');
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});

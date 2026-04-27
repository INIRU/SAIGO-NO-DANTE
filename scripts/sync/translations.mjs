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
import { triggerRevalidation } from './_revalidate.mjs';

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
  process.env.SUPABASE_SECRET_KEY
).schema('limbus');

// ---------------------------------------------------------------------------
// Condition tag maps (EN / JP)
// ---------------------------------------------------------------------------

const CONDITION_TAG_EN = {
  OnSucceedAttack: 'On Hit',
  OnSucceedAttackHead: 'Heads Hit',
  OnSucceedAttackTail: 'Tails Hit',
  CriticalOnSucceedAttack: 'On Crit',
  CriticalOnSucceedAttackHead: 'Crit Heads Hit',
  CriticalEnemyTargetKill: 'On Crit Kill',
  WhenUse: 'On Use',
  WhenUse_Force: 'On Use',
  BeforeUse: 'Before Use',
  WhenUseEvade: 'On Evade Use',
  WinDuel: 'On Clash Win',
  WinDuelAttack: 'On Clash Attack Win',
  WinDuelAttackHead: 'Heads Clash Attack Win',
  DefeatDuel: 'On Clash Lose',
  StartDuel: 'Clash Start',
  StartBattle: 'Combat Start',
  StartBattle_Force: 'Combat Start',
  EndSkill: 'After Attack',
  EndSkillAll: 'After Attack',
  EndBattle: 'Combat End',
  BeforeAttack: 'Before Attack',
  BeforeHit: 'Before Hit',
  EnemyKill: 'On Kill',
  OnSucceedEvade: 'On Evade',
  OnStartCoin: 'Coin Start',
  OnDirectAttack: 'On Direct Attack',
  ReUseOnSucceedAttack: 'Reuse: On Hit',
  ReUseOnSucceedAttackHead: 'Reuse: Heads Hit',
  UnBrokenCoinOnSucceedAttack: 'Unbreakable Coin Hit',
  CantDuel: 'Cannot Clash',
  CantIdentify: 'Indiscriminate',
  CantChangeTarget: 'Cannot Retarget',
  TabExplain: 'Description',
  DuelCounter: 'Clashable Counter',
  DuelGuard: 'Clashable Guard',
  AllyKill: 'On Ally Kill',
  AllyKillFail: 'On Ally Kill Fail',
  EnemyKillFail: 'On Kill Fail',
  TargetKill: 'On Target Kill',
  CriticalTargetKill: 'On Crit Target Kill',
  CriticalEnemyTargetKillFail: 'On Crit Kill Fail',
  CriticalEndSkill: 'Crit After Attack',
  CriticalActivated: 'On Crit',
  EndCoin: 'After Coin',
  EndSkillHead: 'Heads After Attack',
  EndSkillTail: 'Tails After Attack',
  OnDefeatEvade: 'On Evade Fail',
  DefeatDuelAttack: 'On Clash Attack Lose',
  AlwaysUse: 'Always',
  TurnStartBattle: 'Turn Start',
}

const CONDITION_TAG_JP = {
  OnSucceedAttack: '的中時',
  OnSucceedAttackHead: '表面的中時',
  OnSucceedAttackTail: '裏面的中時',
  CriticalOnSucceedAttack: 'クリティカル的中時',
  CriticalOnSucceedAttackHead: 'クリティカル表面的中時',
  CriticalEnemyTargetKill: 'クリティカル敵処置時',
  WhenUse: '使用時',
  WhenUse_Force: '使用時',
  BeforeUse: '使用前',
  WhenUseEvade: '回避使用時',
  WinDuel: '合勝利時',
  WinDuelAttack: '合攻撃勝利時',
  WinDuelAttackHead: '表面合攻撃勝利時',
  DefeatDuel: '合敗北時',
  StartDuel: '合開始時',
  StartBattle: '戦闘開始時',
  StartBattle_Force: '戦闘開始時',
  EndSkill: '攻撃終了時',
  EndSkillAll: '攻撃終了時',
  EndBattle: '戦闘終了時',
  BeforeAttack: '攻撃開始前',
  BeforeHit: '被弾前',
  EnemyKill: '敵処置時',
  OnSucceedEvade: '回避成功時',
  OnStartCoin: 'コイン開始時',
  OnDirectAttack: '直接攻撃時',
  ReUseOnSucceedAttack: '再使用:的中時',
  ReUseOnSucceedAttackHead: '再使用:表面的中時',
  UnBrokenCoinOnSucceedAttack: '破壊不可コイン的中時',
  CantDuel: '合不可',
  CantIdentify: '敵味方識別不可',
  CantChangeTarget: 'ターゲット変更不可',
  TabExplain: '説明',
  DuelCounter: '合可能反撃',
  DuelGuard: '合可能ガード',
  AllyKill: '味方処置時',
  AllyKillFail: '味方処置失敗時',
  EnemyKillFail: '敵処置失敗時',
  TargetKill: '対象処置時',
  CriticalTargetKill: 'クリティカル対象処置時',
  CriticalEnemyTargetKillFail: 'クリティカル敵処置失敗時',
  CriticalEndSkill: 'クリティカル攻撃終了時',
  CriticalActivated: 'クリティカル発動時',
  EndCoin: 'このコイン攻撃終了時',
  EndSkillHead: '表面攻撃終了時',
  EndSkillTail: '裏面攻撃終了時',
  OnDefeatEvade: '回避失敗時',
  DefeatDuelAttack: '合攻撃敗北時',
  AlwaysUse: '常時',
  TurnStartBattle: 'ターン開始時',
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Clean a game description string:
 * 1. Strip <style="highlight"> tags (keep inner content)
 * 2. Strip Unity markup tags (noparse, u, color, link, sprite, size)
 * 3. Replace [GameTag] with display names from tagMap
 * 4. Add line breaks before condition tags
 */
function cleanDescription(desc, tagMap, conditionTags, lang = 'en') {
  if (!desc) return null
  // {0} → Potency/威力, {1} → Count/回数
  const potency = lang === 'jp' ? '威力' : 'Potency'
  const count = lang === 'jp' ? '回数' : 'Count'
  let result = desc
    .replace(/\{0\}/g, potency)
    .replace(/\{1\}/g, count)
    // <style="highlight">...</style> — strip tags, keep content
    .replace(/<style="[^"]*">/g, '')
    .replace(/<\/style>/g, '')
    // Unity markup tags
    .replace(/<\/?noparse>/g, '')
    .replace(/<\/?u>/g, '')
    .replace(/<color=[^>]*>/g, '').replace(/<\/color>/g, '')
    .replace(/<link=[^>]*>/g, '').replace(/<\/link>/g, '')
    .replace(/<sprite[^>]*\/?>/g, '')
    .replace(/<size=[^>]*>/g, '').replace(/<\/size>/g, '')
    // [GameTag] → display name
    .replace(/\[([A-Za-z_][A-Za-z0-9_]*)\]/g, (match, tag) => {
      const name = tagMap[tag]
      if (!name) return match // unknown tag — keep original
      if (conditionTags[tag]) return `[${name}]` // condition tags keep brackets
      return name
    })
  return result.trim() || null
}

/**
 * Load BattleKeywords + Bufs files for a language to build the tag map.
 * Returns { tagMap, conditionTags }.
 */
function loadTagMap(lang) {
  const prefix = lang.toUpperCase() // 'EN' or 'JP'
  const conditionTags = lang === 'en' ? CONDITION_TAG_EN : CONDITION_TAG_JP
  const map = { ...conditionTags }

  const allFiles = fs.readdirSync(DATA_DIR)
  const kwFiles = allFiles.filter(f =>
    f.startsWith(`${prefix}_BattleKeywords`) ||
    f.startsWith(`${prefix}_Bufs`) ||
    f.startsWith(`${prefix}_BuffAbilities`)
  )

  for (const filename of kwFiles) {
    const dataList = readDataList(filename)
    if (!dataList) continue
    for (const item of dataList) {
      if (item.id && item.name && !map[item.id]) {
        map[item.id] = item.name
      }
    }
  }

  console.log(`  Tag map [${prefix}]: ${Object.keys(map).length} entries (${kwFiles.length} files loaded)`)
  return { tagMap: map, conditionTags }
}

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

function parseBattleKeywords(dataList, lang, tagMap, conditionTags) {
  return dataList
    .filter(item => item.id && item.name)
    .map(item => ({
      entity_type: 'keyword',
      entity_id: String(item.id),
      lang,
      name: item.name ?? null,
      description: cleanDescription(item.desc, tagMap, conditionTags, lang),
    }));
}

function parseSkills(dataList, lang, tagMap, conditionTags) {
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
      description: cleanDescription(top.desc, tagMap, conditionTags, lang),
    });
  }
  return rows;
}

function parsePassives(dataList, lang, tagMap, conditionTags) {
  return dataList
    .filter(item => item.id)
    .map(item => ({
      entity_type: 'passive',
      entity_id: String(item.id),
      lang,
      name: item.name ?? null,
      description: cleanDescription(item.desc, tagMap, conditionTags, lang),
    }));
}

function parseEgoGifts(dataList, lang, tagMap, conditionTags) {
  return dataList
    .filter(item => item.id)
    .map(item => ({
      entity_type: 'ego_gift',
      entity_id: String(item.id),
      lang,
      name: item.name ?? null,
      description: cleanDescription(item.desc, tagMap, conditionTags, lang),
    }));
}

function parseBufs(dataList, lang, tagMap, conditionTags) {
  return dataList
    .filter(item => item.id)
    .map(item => ({
      entity_type: 'buf',
      entity_id: String(item.id),
      lang,
      name: item.name ?? null,
      description: cleanDescription(item.desc, tagMap, conditionTags, lang),
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

/**
 * Update source tables (skills/passives) with EN/JP name and description.
 */
async function updateSourceTables(rows, entityType, lang) {
  const colName = lang === 'en' ? 'name_en' : 'name_jp'
  const colDesc = lang === 'en' ? 'description_en' : 'description_jp'
  const tableName = entityType === 'skill' ? 'skills' : 'passives'

  let updated = 0
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE)
    for (const row of batch) {
      if (!row.entity_id) continue
      const { error } = await supabase
        .from(tableName)
        .update({ [colName]: row.name, [colDesc]: row.description })
        .eq('game_id', parseInt(row.entity_id, 10))
      if (!error) updated++
    }
  }
  console.log(`  [${entityType}→${tableName}] Updated ${updated} ${colName}/${colDesc}`)
}

async function syncLang(lang) {
  const prefix = lang.toUpperCase(); // 'EN' or 'JP'
  console.log(`\n=== Language: ${prefix} ===`);

  // Load tag map for this language
  const { tagMap, conditionTags } = loadTagMap(lang.toLowerCase());

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
      const parsed = group.parser(dataList, lang.toLowerCase(), tagMap, conditionTags);
      rows.push(...parsed);
      console.log(`  [${group.label}] ${filename} — ${parsed.length} entries parsed`);
    }

    await upsertBatches(rows, group.label);

    // Also update source tables (skills/passives) directly
    if (!DRY_RUN) {
      if (group.label.includes('Skills')) {
        await updateSourceTables(rows, 'skill', lang.toLowerCase());
      }
      if (group.label === 'Passives') {
        await updateSourceTables(rows, 'passive', lang.toLowerCase());
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SECRET_KEY) {
    console.error('ERROR: Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY');
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

  // On-demand cache invalidation after a successful non-dry-run.
  if (!DRY_RUN) {
    await triggerRevalidation({ scope: 'all-game-data' });
  }
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});

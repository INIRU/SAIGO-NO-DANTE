/**
 * EGO 기프트 + 레시피 시드 스크립트
 * 실행: node --env-file=.env.local scripts/seed-ego-gifts.mjs
 */

import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const headers = {
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${SUPABASE_KEY}`,
  'Content-Type': 'application/json',
  'Accept-Profile': 'limbus',
  'Content-Profile': 'limbus',
}

// JSON 로드
const giftsRaw = JSON.parse(readFileSync(resolve(__dirname, '../../ego gift/ego_gifts.json'), 'utf-8'))
const recipesRaw = JSON.parse(readFileSync(resolve(__dirname, '../../ego gift/recipes.json'), 'utf-8'))
const imageKeyMap = JSON.parse(readFileSync(resolve(__dirname, '../../ego gift/image_key_mapping.json'), 'utf-8'))

const STORAGE_BASE = 'https://lpgqcleszdlldneiwgep.supabase.co/storage/v1/object/public/limbus-assets/ego-gifts'

console.log(`Loaded ${giftsRaw.length} gifts, ${recipesRaw.length} recipes, ${Object.keys(imageKeyMap).length} image mappings`)

// ── 1) 기존 데이터 삭제 ──
async function clearTables() {
  for (const table of ['ego_gift_recipes', 'ego_gifts']) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?id=not.is.null`, {
      method: 'DELETE',
      headers,
    })
    if (!res.ok) {
      console.error(`Failed to clear ${table}:`, await res.text())
    } else {
      console.log(`Cleared ${table}`)
    }
  }
}

// ── 2) EGO 기프트 INSERT ──
async function seedGifts() {
  const rows = giftsRaw.map(g => ({
    name: g.name,
    keyword: g.keyword,
    grade: String(g.grade),
    tier: g.tier || null,
    enhancement: g.enhancement === '가능',
    price: g.price ?? null,
    sell_price: g.sell_price ?? null,
    buy_disabled: g.buy_disabled ?? false,
    effect_base: g.effect_base || null,
    effect_plus: g.effect_plus || null,
    effect_plusplus: g.effect_plusplus || null,
    min_identities: g.min_identities ?? null,
    is_synthesis: g.is_synthesis ?? false,
    first_appearance: g.first_appearance || null,
    related: g.related || null,
    image_url: imageKeyMap[g.image_file]
      ? `${STORAGE_BASE}/${imageKeyMap[g.image_file]}`
      : g.storage_url || null,
  }))

  // 배치 INSERT (50개씩)
  const BATCH = 50
  let inserted = 0
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH)
    const res = await fetch(`${SUPABASE_URL}/rest/v1/ego_gifts`, {
      method: 'POST',
      headers: { ...headers, Prefer: 'return=minimal' },
      body: JSON.stringify(batch),
    })
    if (!res.ok) {
      console.error(`Gift batch ${i} failed:`, await res.text())
    } else {
      inserted += batch.length
      console.log(`Gifts: ${inserted}/${rows.length}`)
    }
  }
}

// ── 3) 레시피 INSERT ──
async function seedRecipes() {
  const rows = recipesRaw.map(r => ({
    result_name: r.result,
    keyword: r.keyword,
    ingredients: r.ingredients,
    final_result: r.final_result || null,
  }))

  const res = await fetch(`${SUPABASE_URL}/rest/v1/ego_gift_recipes`, {
    method: 'POST',
    headers: { ...headers, Prefer: 'return=minimal' },
    body: JSON.stringify(rows),
  })
  if (!res.ok) {
    console.error('Recipes failed:', await res.text())
  } else {
    console.log(`Recipes: ${rows.length} inserted`)
  }
}

// ── 실행 ──
await clearTables()
await seedGifts()
await seedRecipes()
console.log('Done!')

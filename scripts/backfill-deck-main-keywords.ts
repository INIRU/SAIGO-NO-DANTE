#!/usr/bin/env tsx
/**
 * Dry-run/apply persisted deck main_keywords from formation slots 1-7.
 *
 * Dry-run:
 *   npx tsx scripts/backfill-deck-main-keywords.ts --dry-run
 *
 * Apply:
 *   npx tsx scripts/backfill-deck-main-keywords.ts --fix
 */

import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { computeDeckMainKeywordsFromSlots, type DeckKeywordSlot } from '../lib/decks/keyword-rules'

config({ path: '.env.local' })

const args = process.argv.slice(2)
const FIX = args.includes('--fix')
const DRY_RUN = args.includes('--dry-run') || !FIX

if (FIX && args.includes('--dry-run')) {
  console.error('Use either --dry-run or --fix, not both.')
  process.exit(1)
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY/SUPABASE_SECRET_KEY.')
  process.exit(1)
}

type DeckRow = {
  id: string
  title: string | null
  main_keywords?: string[] | null
  deck_identities?: DeckKeywordSlot[] | null
}

type Candidate = {
  id: string
  title: string | null
  current: string[]
  next: string[]
}

const SELECT_WITH_MAIN_KEYWORDS = `
  id, title, main_keywords,
  deck_identities(slot_order, identities(id, skill_keyword_list))
`
const SELECT_LEGACY = `
  id, title,
  deck_identities(slot_order, identities(id, skill_keyword_list))
`
const PAGE_SIZE = 200

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, { db: { schema: 'limbus' } })

function isMissingMainKeywordsError(error: { message?: string } | null) {
  return Boolean(error?.message?.includes('main_keywords'))
}

function sameKeywords(a: string[], b: string[]) {
  return a.length === b.length && a.every((value, index) => value === b[index])
}

async function fetchDecks() {
  const rows: DeckRow[] = []
  let select = SELECT_WITH_MAIN_KEYWORDS
  let usedLegacySelect = false
  let start = 0

  while (true) {
    let { data, error } = await supabase
      .from('decks')
      .select(select)
      .order('created_at', { ascending: false })
      .range(start, start + PAGE_SIZE - 1)

    if (isMissingMainKeywordsError(error)) {
      select = SELECT_LEGACY
      usedLegacySelect = true
      const retry = await supabase
        .from('decks')
        .select(select)
        .order('created_at', { ascending: false })
        .range(start, start + PAGE_SIZE - 1)
      data = retry.data
      error = retry.error
    }

    if (error) throw new Error(`decks read failed: ${error.message}`)
    const page = (data ?? []) as unknown as DeckRow[]
    rows.push(...page)
    if (page.length < PAGE_SIZE) break
    start += PAGE_SIZE
  }

  return { rows, usedLegacySelect }
}

async function main() {
  const { rows, usedLegacySelect } = await fetchDecks()
  if (FIX && usedLegacySelect) {
    throw new Error('decks.main_keywords column is missing. Apply supabase/migrations/20260501_deck_main_keywords.sql before --fix.')
  }
  const candidates: Candidate[] = []
  let emptyMainKeywords = 0

  for (const deck of rows) {
    const current = deck.main_keywords ?? []
    if (current.length === 0) emptyMainKeywords += 1
    const next = computeDeckMainKeywordsFromSlots(deck.deck_identities ?? [])
    if (current.length === 0 && !sameKeywords(current, next)) {
      candidates.push({ id: deck.id, title: deck.title, current, next })
    }
  }

  console.log(`mode=${DRY_RUN ? 'dry-run' : 'fix'}`)
  console.log(`main_keywords_column=${usedLegacySelect ? 'missing' : 'present'}`)
  console.log(`decks_read=${rows.length}`)
  console.log(`empty_main_keywords=${emptyMainKeywords}`)
  console.log(`would_update=${candidates.length}`)

  for (const candidate of candidates.slice(0, 20)) {
    console.log(`${candidate.id}\t${candidate.title ?? '(untitled)'}\t[${candidate.next.join(', ')}]`)
  }
  if (candidates.length > 20) {
    console.log(`... ${candidates.length - 20} more`)
  }

  if (DRY_RUN) return

  let updated = 0
  for (const candidate of candidates) {
    const { error } = await supabase
      .from('decks')
      .update({ main_keywords: candidate.next })
      .eq('id', candidate.id)
      .eq('main_keywords', '{}')

    if (error) throw new Error(`deck update failed for ${candidate.id}: ${error.message}`)
    updated += 1
  }

  const { rows: afterRows } = await fetchDecks()
  const afterEmpty = afterRows.filter(deck => (deck.main_keywords ?? []).length === 0).length
  console.log(`updated=${updated}`)
  console.log(`empty_main_keywords_after=${afterEmpty}`)
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})

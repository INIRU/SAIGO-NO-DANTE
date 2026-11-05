#!/usr/bin/env tsx

import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { normalizeFloorPlanDifficulty } from '../../lib/planner/floor-difficulty'

config({ path: '.env.local' })

type MdPlanRow = {
  id: string
  difficulty: string | null
  floor_plan: unknown
}

type MigrationStats = {
  total: number
  changed: number
  unchanged: number
  errors: number
  sampleChangedPlanIds: string[]
}

const args = process.argv.slice(2)
const APPLY = args.includes('--apply')
const limitIndex = args.indexOf('--limit')
const LIMIT = limitIndex === -1 ? null : parseLimit(args[limitIndex + 1])
const SAMPLE_LIMIT = 10

function parseLimit(value: string | undefined) {
  if (!value || !/^\d+$/.test(value)) {
    console.error('Invalid --limit value. Use: --limit <positive integer>')
    process.exit(1)
  }

  const parsed = Number(value)
  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    console.error('Invalid --limit value. Use: --limit <positive integer>')
    process.exit(1)
  }

  return parsed
}

function printStats(stats: MigrationStats) {
  console.log(`total: ${stats.total}`)
  console.log(`changed: ${stats.changed}`)
  console.log(`unchanged: ${stats.unchanged}`)
  console.log(`errors: ${stats.errors}`)
  console.log(`sample changed plan ids: ${stats.sampleChangedPlanIds.length > 0 ? stats.sampleChangedPlanIds.join(', ') : '(none)'}`)
}

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseKey) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY/SUPABASE_SERVICE_ROLE_KEY')
    process.exit(1)
  }

  const supabase = createClient(supabaseUrl, supabaseKey, { db: { schema: 'limbus' } })
  console.log(`mode: ${APPLY ? 'apply' : 'dry-run'}`)
  if (LIMIT !== null) console.log(`limit: ${LIMIT}`)

  let query = supabase
    .from('md_plans')
    .select('id, difficulty, floor_plan')
    .order('created_at', { ascending: true })

  if (LIMIT !== null) query = query.limit(LIMIT)

  const { data, error } = await query
  if (error) {
    console.error(`Failed to fetch md_plans: ${error.message}`)
    process.exit(1)
  }

  const stats: MigrationStats = {
    total: 0,
    changed: 0,
    unchanged: 0,
    errors: 0,
    sampleChangedPlanIds: [],
  }

  for (const plan of (data ?? []) as MdPlanRow[]) {
    stats.total += 1

    try {
      const normalized = normalizeFloorPlanDifficulty(plan.floor_plan, plan.difficulty)
      if (!normalized.changed) {
        stats.unchanged += 1
        continue
      }

      stats.changed += 1
      if (stats.sampleChangedPlanIds.length < SAMPLE_LIMIT) {
        stats.sampleChangedPlanIds.push(plan.id)
      }

      if (!APPLY) continue

      const { error: updateError } = await supabase
        .from('md_plans')
        .update({ floor_plan: normalized.floorPlan })
        .eq('id', plan.id)

      if (updateError) {
        stats.errors += 1
        console.error(`Failed to update ${plan.id}: ${updateError.message}`)
      }
    } catch (err) {
      stats.errors += 1
      console.error(`Failed to normalize ${plan.id}: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  printStats(stats)

  if (!APPLY) {
    console.log('dry-run only: no updates were written. Re-run with --apply to write changes.')
  }

  if (stats.errors > 0) process.exitCode = 1
}

void main()

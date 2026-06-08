import { NextResponse } from 'next/server'
import { revalidatePath, revalidateTag } from 'next/cache'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { CACHE_TAGS } from '@/lib/constants/cache-tags'

const REROLL_CATEGORY = 'reroll'
const REROLL_TIERS = ['S+', 'S', 'A', 'B', 'C'] as const
const SUPPORTED_LOCALES = ['ko', 'en', 'ja'] as const
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
type RerollTier = typeof REROLL_TIERS[number]

function isValidTier(value: string): value is RerollTier {
  return REROLL_TIERS.includes(value as RerollTier)
}

function revalidateTierListCaches() {
  revalidateTag(CACHE_TAGS.tierList, 'max')
  for (const locale of SUPPORTED_LOCALES) {
    revalidatePath(`/${locale}/tier-list`)
  }
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.isAdmin) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

    const supabase = createAdminClient()

    // 배정된 인격
    const { data: assigned, error: assignedErr } = await supabase
      .schema('limbus')
      .from('tier_list')
      .select(`
        category, tier, sort_order,
        identity:identities(id, name_kr, rarity, sinner_id, game_id, folder_name, acquisition_info, release_date)
      `)
      .eq('category', REROLL_CATEGORY)
      .in('tier', [...REROLL_TIERS])
      .order('sort_order')

    if (assignedErr) return NextResponse.json({ error: assignedErr.message }, { status: 500 })

    // 배정된 identity_id 목록
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const assignedIds = (assigned ?? []).map((r: any) => {
      const ident = Array.isArray(r.identity) ? r.identity[0] : r.identity
      return ident?.id
    }).filter(Boolean) as string[]

    // 미배정 인격
    let unassignedQuery = supabase
      .schema('limbus')
      .from('identities')
      .select('id, name_kr, rarity, sinner_id, game_id, folder_name, acquisition_info, release_date')
      .order('name_kr')

    if (assignedIds.length > 0) {
      // not.in 필터로 배정된 인격 제외
      unassignedQuery = unassignedQuery.not('id', 'in', `(${assignedIds.join(',')})`)
    }

    const { data: unassigned, error: unassignedErr } = await unassignedQuery

    if (unassignedErr) return NextResponse.json({ error: unassignedErr.message }, { status: 500 })

    return NextResponse.json({ assigned: assigned ?? [], unassigned: unassigned ?? [] })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal Server Error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.isAdmin) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

    const supabase = createAdminClient()
    const body = await request.json()
    const { tiers } = body as { tiers: Record<string, string[]> }

    if (!tiers || typeof tiers !== 'object' || Array.isArray(tiers)) {
      return NextResponse.json({ error: 'tiers 데이터가 필요합니다.' }, { status: 400 })
    }

    const rows: { identity_id: string; tier: RerollTier; sort_order: number; category: typeof REROLL_CATEGORY }[] = []
    const seenIdentityIds = new Set<string>()
    for (const [tier, ids] of Object.entries(tiers)) {
      if (!isValidTier(tier)) {
        return NextResponse.json({ error: `유효하지 않은 티어입니다: ${tier}` }, { status: 400 })
      }
      if (!Array.isArray(ids)) {
        return NextResponse.json({ error: `유효하지 않은 identity 목록입니다: ${tier}` }, { status: 400 })
      }

      for (const [idx, id] of ids.entries()) {
        if (typeof id !== 'string' || !UUID_PATTERN.test(id)) {
          return NextResponse.json({ error: `유효하지 않은 identity ID입니다: ${tier}` }, { status: 400 })
        }
        if (seenIdentityIds.has(id)) {
          return NextResponse.json({ error: `중복된 identity ID입니다: ${id}` }, { status: 400 })
        }
        seenIdentityIds.add(id)
        rows.push({ identity_id: id, tier, sort_order: idx, category: REROLL_CATEGORY })
      }
    }

    if (rows.length > 0) {
      const { error: upsertErr } = await supabase
        .schema('limbus')
        .from('tier_list')
        .upsert(rows, { onConflict: 'category,identity_id' })

      if (upsertErr) return NextResponse.json({ error: upsertErr.message }, { status: 500 })
    }

    let deleteQuery = supabase
      .schema('limbus')
      .from('tier_list')
      .delete()
      .eq('category', REROLL_CATEGORY)

    if (rows.length > 0) {
      deleteQuery = deleteQuery.not('identity_id', 'in', `(${[...seenIdentityIds].join(',')})`)
    }

    const { error: deleteErr } = await deleteQuery

    if (deleteErr) return NextResponse.json({ error: deleteErr.message }, { status: 500 })

    revalidateTierListCaches()

    return NextResponse.json({ success: true, count: rows.length })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal Server Error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

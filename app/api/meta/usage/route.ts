import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { KEYWORD_SIN_MAP } from '@/lib/data/sinners'

export const dynamic = 'force-dynamic'

export async function GET() {
  const supabase = await createClient()

  const { data, error } = await supabase
    .schema('limbus')
    .from('deck_identities')
    .select('identity_id, identities(sinner_id, keywords)')

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const usageByIdentity: Record<string, number> = {}
  const usageBySinner: Record<string, number> = {}
  const usageBySin: Record<string, number> = {}

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data?.forEach((row: any) => {
    if (!row.identity_id) return
    usageByIdentity[row.identity_id] = (usageByIdentity[row.identity_id] || 0) + 1

    const identity = Array.isArray(row.identities) ? row.identities[0] : row.identities
    if (identity) {
      usageBySinner[identity.sinner_id] = (usageBySinner[identity.sinner_id] || 0) + 1
      const keywords: string[] = identity.keywords || []
      for (const kw of keywords) {
        const sin = KEYWORD_SIN_MAP[kw]
        if (sin) { usageBySin[sin] = (usageBySin[sin] || 0) + 1; break }
      }
    }
  })

  return NextResponse.json({ usageByIdentity, usageBySinner, usageBySin })
}

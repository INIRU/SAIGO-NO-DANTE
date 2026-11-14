import { createAdminClient } from '@/lib/supabase/admin'

type LegalSection = {
  heading: string
  body?: string
  items?: string[]
  itemAccent?: 'gold' | 'red'
}

export type LegalDoc = {
  type: 'privacy' | 'terms'
  title: string
  version?: string
  last_updated: string
  sections: LegalSection[]
}

type LegalDocSummary = {
  type: 'privacy' | 'terms'
  version: string
  last_updated: string | null
  updated_at?: string | null
}

type LegalAcknowledgement = {
  doc_type: 'privacy' | 'terms'
  version: string
  acknowledged_at: string
}

function normalizeLegalType(value: unknown): 'privacy' | 'terms' | null {
  return value === 'privacy' || value === 'terms' ? value : null
}

function resolveVersion(row: { version?: string | null; last_updated?: string | null; updated_at?: string | null }) {
  return row.version?.trim() || row.last_updated?.trim() || row.updated_at?.trim() || 'v1'
}

export async function getLegalDoc(type: 'privacy' | 'terms', lang: string = 'ko'): Promise<LegalDoc | null> {
  try {
    const supabase = createAdminClient()
    const extended = await supabase
      .schema('limbus')
      .from('legal_docs')
      .select('type, title, version, last_updated, sections')
      .eq('type', type)
      .eq('lang', lang)
      .maybeSingle()
    if (!extended.error && extended.data) {
      const row = extended.data as LegalDoc
      return { ...row, version: resolveVersion(row) }
    }

    const fallback = await supabase
      .schema('limbus')
      .from('legal_docs')
      .select('type, title, last_updated, sections')
      .eq('type', type)
      .maybeSingle()
    if (fallback.error || !fallback.data) return null
    const row = fallback.data as Omit<LegalDoc, 'version'>
    return { ...row, version: resolveVersion(row) }
  } catch {
    return null
  }
}

export async function getCurrentLegalDocs(lang: string = 'ko'): Promise<LegalDocSummary[]> {
  const supabase = createAdminClient()
  const extended = await supabase
    .schema('limbus')
    .from('legal_docs')
    .select('type, version, last_updated, updated_at')
    .in('type', ['terms', 'privacy'])
    .eq('lang', lang)

  if (!extended.error) {
    return ((extended.data ?? []) as Array<{ type: unknown; version?: string | null; last_updated?: string | null; updated_at?: string | null }>)
      .flatMap(row => {
        const type = normalizeLegalType(row.type)
        if (!type) return []
        return [{
          type,
          version: resolveVersion(row),
          last_updated: row.last_updated ?? null,
          updated_at: row.updated_at ?? null,
        }]
      })
  }

  const fallback = await supabase
    .schema('limbus')
    .from('legal_docs')
    .select('type, last_updated')
    .in('type', ['terms', 'privacy'])

  if (fallback.error) {
    throw new Error(fallback.error.message)
  }

  return ((fallback.data ?? []) as Array<{ type: unknown; last_updated?: string | null }>)
    .flatMap(row => {
      const type = normalizeLegalType(row.type)
      if (!type) return []
      return [{
        type,
        version: resolveVersion(row),
        last_updated: row.last_updated ?? null,
      }]
    })
}

export async function getUserLegalAcknowledgements(userId: string): Promise<LegalAcknowledgement[]> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .schema('limbus')
    .from('legal_acknowledgements')
    .select('doc_type, version, acknowledged_at')
    .eq('user_id', userId)
    .in('doc_type', ['terms', 'privacy'])
    .order('acknowledged_at', { ascending: false })

  if (error) {
    if (error.code === '42P01' || error.code === 'PGRST205') return []
    throw new Error(error.message)
  }

  return ((data ?? []) as Array<{ doc_type: unknown; version: string; acknowledged_at: string }>)
    .map(row => {
      const doc_type = normalizeLegalType(row.doc_type)
      if (!doc_type) return null
      return { doc_type, version: row.version, acknowledged_at: row.acknowledged_at }
    })
    .filter((row): row is LegalAcknowledgement => row !== null)
}

export function toLegalStatusPayload(docs: LegalDocSummary[], acknowledgements: LegalAcknowledgement[]) {
  const docsByType = new Map(docs.map(doc => [doc.type, doc]))
  const ackByType = new Map<'privacy' | 'terms', LegalAcknowledgement>()

  for (const acknowledgement of acknowledgements) {
    if (!ackByType.has(acknowledgement.doc_type)) {
      ackByType.set(acknowledgement.doc_type, acknowledgement)
    }
  }

  const termsVersion = docsByType.get('terms')?.version ?? null
  const privacyVersion = docsByType.get('privacy')?.version ?? null
  const termsAcknowledgedVersion = ackByType.get('terms')?.version ?? null
  const privacyAcknowledgedVersion = ackByType.get('privacy')?.version ?? null
  const termsStale = Boolean(termsVersion && termsAcknowledgedVersion !== termsVersion)
  const privacyStale = Boolean(privacyVersion && privacyAcknowledgedVersion !== privacyVersion)

  return {
    required: termsStale || privacyStale,
    stale: termsStale || privacyStale,
    currentVersion: termsVersion === privacyVersion ? termsVersion : [termsVersion, privacyVersion].filter(Boolean).join(' / ') || null,
    acknowledgedVersion:
      termsAcknowledgedVersion === privacyAcknowledgedVersion
        ? termsAcknowledgedVersion
        : [termsAcknowledgedVersion, privacyAcknowledgedVersion].filter(Boolean).join(' / ') || null,
    termsVersion,
    privacyVersion,
    termsAcknowledgedVersion,
    privacyAcknowledgedVersion,
    documents: {
      terms: termsVersion
        ? { version: termsVersion, acknowledgedVersion: termsAcknowledgedVersion, stale: termsStale }
        : null,
      privacy: privacyVersion
        ? { version: privacyVersion, acknowledgedVersion: privacyAcknowledgedVersion, stale: privacyStale }
        : null,
    },
  }
}

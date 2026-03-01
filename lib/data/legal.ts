import { createClient } from '@/lib/supabase/server'

export type LegalSection = {
  heading: string
  body?: string
  items?: string[]
  itemAccent?: 'gold' | 'red'
}

export type LegalDoc = {
  type: 'privacy' | 'terms'
  title: string
  last_updated: string
  sections: LegalSection[]
}

export async function getLegalDoc(type: 'privacy' | 'terms'): Promise<LegalDoc | null> {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .schema('limbus')
      .from('legal_docs')
      .select('type, title, last_updated, sections')
      .eq('type', type)
      .single()
    if (error || !data) return null
    return data as LegalDoc
  } catch {
    return null
  }
}

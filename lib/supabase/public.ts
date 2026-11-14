import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/database.types'

let client: SupabaseClient<Database> | null = null

/**
 * The publishable-key client for public reads (the game data, boards, share images): one per process, without a session
 * or token refresh. A client with them starts a refresh timer that keeps it, and the clients it saw, in memory for good;
 * one new client per query filled the server's heap until it died (2026-10-23).
 */
export function publicSupabase(): SupabaseClient<Database> {
  return client ??= createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
}

import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/database.types'

// RLS를 우회하는 서비스 역할 클라이언트 (서버 사이드 전용)
export function createAdminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

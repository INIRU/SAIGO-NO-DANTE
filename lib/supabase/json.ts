import type { Json } from '@/lib/supabase/database.types'

/**
 * A value for a jsonb column. The generated `Json` type only admits shapes it can prove are JSON, which excludes object
 * types with optional or `unknown` members; whatever is passed here is serialized as it is.
 */
export const toJson = (value: unknown): Json => value as Json

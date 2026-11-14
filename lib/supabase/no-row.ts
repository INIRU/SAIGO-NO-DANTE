/**
 * A `.single()` read that found nothing: no row (PGRST116) or an id that is not a uuid (22P02, which cannot name a row).
 * That is "not there", unlike a read that failed (connection, permission), which callers answer with a 500.
 */
export function isNoRow(error: { code?: string } | null | undefined): boolean {
  return error?.code === 'PGRST116' || error?.code === '22P02'
}

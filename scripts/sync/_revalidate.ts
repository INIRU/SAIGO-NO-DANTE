/**
 * Post-sync on-demand revalidation helper (TypeScript).
 *
 * Called by `scripts/sync/*.ts` at the end of a successful `--fix` run to
 * signal the live site (`/api/revalidate`) to invalidate all game-data
 * cache tags. The fetch fails silently with a console.warn when the required
 * env vars are missing so the sync completes even in local environments.
 *
 * Env:
 *   SITE_URL (or NEXT_PUBLIC_SITE_URL) — https://saigo-no-dante.com in production
 *   REVALIDATION_SECRET                — shared secret with the revalidate route
 *
 * Usage:
 *   import { triggerRevalidation } from './_revalidate'
 *   if (appliedChanges) await triggerRevalidation()
 */
export type RevalidateScope = 'all-game-data' | 'announcements'

export interface TriggerRevalidationOptions {
  /** Default: 'all-game-data'. */
  scope?: RevalidateScope
  /** Extra cache tags to invalidate alongside the scope bundle. */
  tags?: readonly string[]
  /** Explicit paths to revalidate (backward compat). */
  paths?: readonly string[]
}

export async function triggerRevalidation(
  options: TriggerRevalidationOptions = {},
): Promise<void> {
  const siteUrl = process.env.SITE_URL || process.env.NEXT_PUBLIC_SITE_URL
  const secret = process.env.REVALIDATION_SECRET
  if (!siteUrl || !secret) {
    console.warn('[sync] SITE_URL or REVALIDATION_SECRET not set — skipping revalidate')
    return
  }

  const body: Record<string, unknown> = {
    scope: options.scope ?? 'all-game-data',
  }
  if (options.tags && options.tags.length > 0) body.tags = [...options.tags]
  if (options.paths && options.paths.length > 0) body.paths = [...options.paths]

  try {
    const res = await fetch(`${siteUrl}/api/revalidate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-revalidation-secret': secret,
      },
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      console.warn(`[sync] revalidate call failed: ${res.status} ${res.statusText}`)
      return
    }
    const data = (await res.json().catch(() => ({}))) as { revalidated?: unknown }
    console.log('[sync] revalidated:', data.revalidated)
  } catch (err) {
    console.warn('[sync] revalidate call threw:', err instanceof Error ? err.message : err)
  }
}

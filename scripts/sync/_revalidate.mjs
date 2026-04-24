/**
 * Post-sync on-demand revalidation helper (ESM / JS).
 *
 * Mirrors scripts/sync/_revalidate.ts for `.mjs` consumers. Called at the end
 * of a successful `--fix` run to signal `/api/revalidate` to invalidate all
 * game-data cache tags. Fails silently (console.warn) when env vars are
 * missing so sync scripts can still finish in local/dev environments.
 *
 * Env:
 *   SITE_URL (or NEXT_PUBLIC_SITE_URL)
 *   REVALIDATION_SECRET
 *
 * Usage:
 *   import { triggerRevalidation } from './_revalidate.mjs'
 *   if (appliedChanges) await triggerRevalidation()
 */

/**
 * @typedef {'all-game-data' | 'announcements'} RevalidateScope
 * @typedef {{ scope?: RevalidateScope, tags?: readonly string[], paths?: readonly string[] }} TriggerRevalidationOptions
 */

/**
 * @param {TriggerRevalidationOptions} [options]
 * @returns {Promise<void>}
 */
export async function triggerRevalidation(options = {}) {
  const siteUrl = process.env.SITE_URL || process.env.NEXT_PUBLIC_SITE_URL
  const secret = process.env.REVALIDATION_SECRET
  if (!siteUrl || !secret) {
    console.warn('[sync] SITE_URL or REVALIDATION_SECRET not set — skipping revalidate')
    return
  }

  /** @type {Record<string, unknown>} */
  const body = { scope: options.scope ?? 'all-game-data' }
  if (options.tags && options.tags.length > 0) body.tags = [...options.tags]
  if (options.paths && options.paths.length > 0) body.paths = [...options.paths]

  try {
    const res = await fetch(`${siteUrl}/api/revalidate?secret=${encodeURIComponent(secret)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      console.warn(`[sync] revalidate call failed: ${res.status} ${res.statusText}`)
      return
    }
    const data = await res.json().catch(() => ({}))
    console.log('[sync] revalidated:', data.revalidated)
  } catch (err) {
    console.warn('[sync] revalidate call threw:', err instanceof Error ? err.message : err)
  }
}

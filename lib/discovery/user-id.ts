/** The part of the admin client the lookup needs (`createAdminClient().schema('limbus')`). */
type DiscoveryDb = { rpc(name: 'discovery_user_id', args: { user_email: string }): PromiseLike<{ data: unknown; error: { message: string } | null }> }

/**
 * The profile id of a NextAuth email, without creating an account: null when the email has no profile yet.
 * A failed lookup (missing function, network) throws, so it is never mistaken for "no account".
 */
export async function discoveryUserId(db: DiscoveryDb, email: string): Promise<string | null> {
  const { data, error } = await db.rpc('discovery_user_id', { user_email: email })
  if (error) throw new Error(`discovery_user_id failed: ${error.message}`)
  return typeof data === 'string' && data ? data : null
}

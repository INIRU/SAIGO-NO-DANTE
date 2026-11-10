/** Who a Bearer key belongs to and what it may do on /api/v1. Server only. */
import { adminEmails } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { hashApiKey, readApiKey } from "./developer-keys";

export type Scope = "catalog:read" | "news:write";
export type KeyAccess = { partner: string | null; scopes: string[]; admin: boolean; remaining: number | null };
type Refusal = { status: number; error: string; retry?: number };

/** Checks the key and counts the request against its limits. Throws when the database cannot be reached. */
export async function consumeApiKey(authorization: string | null): Promise<{ access: KeyAccess; refusal?: undefined } | { refusal: Refusal }> {
  const token = readApiKey(authorization);
  if (!token) return { refusal: { status: 401, error: "Bearer API key required" } };
  const { data, error } = await createAdminClient()
    .schema("limbus")
    .rpc("consume_developer_key", {
      token_hash: hashApiKey(token),
      p_admin_emails: adminEmails(),
    });
  if (error) throw error;
  if (data.status !== 200)
    return { refusal: { status: data.status, error: data.status === 429 ? "Rate limit exceeded" : "Key unavailable", retry: data.retry ?? 60 } };
  return { access: { partner: data.partner ?? null, scopes: data.scopes ?? [], admin: data.admin === true, remaining: data.remaining ?? null } };
}

/** An administrator may use every scope, to check the developer tools without being a partner. */
export const allows = (access: KeyAccess, scope: Scope) => access.admin || access.scopes.includes(scope);

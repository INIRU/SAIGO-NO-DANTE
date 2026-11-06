import { isAllowedRequestOrigin } from "@/lib/request-origin";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireActiveUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { findOrCreateSupabaseUser } from "@/lib/supabase/findOrCreateUser";
import { createApiKey } from "@/features/account/server";
import { checkRequestRateLimit, rateLimitResponse } from "@/lib/rate-limit";
const headers = { "Cache-Control": "private, no-store" };
async function handle(request: Request) {
  if (
    request.method !== "GET" &&
    request.headers.get("origin") &&
    !isAllowedRequestOrigin(
      request.headers.get("origin"),
      new URL(request.url).origin,
      request.headers.get("host"),
      [],
    )
  )
    return new Response(null, { status: 403 });
  const auth = await requireActiveUser();
  if (auth.error) return auth.response;
  const limit = checkRequestRateLimit(request, {
    scope: "developer-keys",
    bucket: request.method === "GET" ? "readonly" : "create",
    authenticatedKey: auth.session.user.email,
  });
  if (!limit.allowed) return rateLimitResponse(limit);
  try {
    const db = createAdminClient();
    const user = auth.session.user;
    const userId = await findOrCreateSupabaseUser(
      db,
      user.email!,
      user.name,
      user.image,
    );
    if (request.method === "GET") {
      const { data, error } = await db
        .schema("limbus")
        .from("developer_keys")
        .select(
          "id,name,prefix,created_at,revoked_at,last_used_at,developer_usage(day,requests)",
        )
        .eq("user_id", userId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      const profile = await db
        .schema("limbus")
        .from("profiles")
        .select("partner:partners(code,name,scopes)")
        .eq("id", userId)
        .maybeSingle();
      if (profile.error) throw profile.error;
      return NextResponse.json(
        { keys: data, partner: profile.data?.partner ?? null, admin: user.isAdmin === true },
        { headers },
      );
    }
    const body = await request.json();
    if (request.method === "DELETE") {
      const id = z.string().uuid().parse(body.id);
      const { error } = await db
        .schema("limbus")
        .from("developer_keys")
        .update({ revoked_at: new Date().toISOString() })
        .eq("id", id)
        .eq("user_id", userId);
      if (error) throw error;
      return NextResponse.json({ ok: true }, { headers });
    }
    const name = z.string().trim().min(1).max(60).parse(body.name);
    const { key, ...secret } = createApiKey();
    const { error } = await db
      .schema("limbus")
      .from("developer_keys")
      .insert({ ...secret, name, user_id: userId });
    if (error) throw error;
    return NextResponse.json({ key }, { status: 201, headers });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof z.ZodError || error instanceof SyntaxError
            ? "Invalid input"
            : "Request failed",
      },
      {
        status:
          error instanceof z.ZodError || error instanceof SyntaxError
            ? 400
            : 500,
        headers,
      },
    );
  }
}
export { handle as GET, handle as POST, handle as DELETE };

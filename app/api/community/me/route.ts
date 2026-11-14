import { invalidateProfileDecks, loadCommunityProfile, communitySettingsSchema } from '@/features/community/server';
import { NextResponse } from "next/server";
import { requireActiveUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { findOrCreateSupabaseUser } from "@/lib/supabase/find-or-create-user";
import { isAllowedRequestOrigin } from '@/lib/request-origin';
const headers = { "Cache-Control": "private, no-store" };
async function actor() {
  const auth = await requireActiveUser();
  if (auth.error) return { response: auth.response } as const;
  const db = createAdminClient();
  const id = await findOrCreateSupabaseUser(
    db,
    auth.session.user!.email!,
    auth.session.user!.name,
    auth.session.user!.image,
  );
  if (!id)
    return {
      response: NextResponse.json(
        { error: "Account unavailable" },
        { status: 503 },
      ),
    } as const;
  return { db, id } as const;
}
export async function GET() {
  try {
    const auth = await actor();
    if ("response" in auth) return auth.response;
    const data = await loadCommunityProfile(auth.db, auth.id, true);
    return data
      ? NextResponse.json(data, { headers })
      : NextResponse.json({ error: "Not found" }, { status: 404, headers });
  } catch {
    return NextResponse.json(
      { error: "Unable to load profile" },
      { status: 503, headers },
    );
  }
}
export async function PATCH(request: Request) {
  if (request.headers.get('origin') && !isAllowedRequestOrigin(request.headers.get('origin'), new URL(request.url).origin, request.headers.get('host'), []))
    return new Response(null, { status: 403, headers });
  try {
    const auth = await actor();
    if ("response" in auth) return auth.response;
    const parsed = communitySettingsSchema.safeParse(
      await request.json().catch(() => null),
    );
    if (!parsed.success)
      return NextResponse.json({ error: "Invalid settings" }, { status: 400 });
    const { error } = await auth.db
      .schema("limbus")
      .from("profiles")
      .update(parsed.data)
      .eq("id", auth.id);
    if (error) throw error;
    await invalidateProfileDecks(auth.db, auth.id);
    return NextResponse.json({ ok: true }, { headers });
  } catch {
    return NextResponse.json(
      { error: "Unable to save settings" },
      { status: 503, headers },
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { createHmac, randomUUID } from "node:crypto";
import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkRequestRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { discoveryUserId } from "@/lib/discovery/user-id";
const schema = z.object({
  kind: z.enum(["identity", "deck", "planner"]),
  id: z.string().uuid(),
});
export async function POST(request: NextRequest) {
  if (
    request.headers.get("origin") &&
    request.headers.get("origin") !== request.nextUrl.origin
  )
    return new Response(null, { status: 403 });
  const limit = checkRequestRateLimit(request, {
    scope: "discovery-visit",
    bucket: "write",
  });
  if (!limit.allowed) return rateLimitResponse(limit);
  try {
    const { kind, id } = schema.parse(await request.json());
    const secret = process.env.NEXTAUTH_SECRET;
    if (!secret) throw Error();
    const db = createAdminClient().schema("limbus");
    const table = {
      identity: "identities",
      deck: "decks",
      planner: "md_plans",
    }[kind];
    const { data, error } = await db
      .from(table)
      .select("id")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    if (!data) return new Response(null, { status: 404 });
    const old = request.cookies.get("limbus_visitor")?.value;
    const visitor =
      old && z.string().uuid().safeParse(old).success ? old : randomUUID();
    const hash = createHmac("sha256", secret)
      .update("discovery:" + visitor)
      .digest("hex");
    // Logged-in visits also feed the personal shelf. A failed lookup is logged and the visit stays anonymous.
    const email = (await getServerSession(authOptions))?.user?.email;
    const userId = email
      ? await discoveryUserId(db, email).catch((error: Error) => { console.error("[discovery/visit]", error.message); return null; })
      : null;
    const result = await db
      .from("discovery_visits")
      .upsert(
        {
          visitor_hash: hash,
          kind,
          entity_id: id,
          day: new Date().toISOString().slice(0, 10),
          ...(userId && { user_id: userId }),
        },
        {
          onConflict: "visitor_hash,kind,entity_id,day",
          ignoreDuplicates: !userId,
        },
      );
    if (result.error) throw result.error;
    const response = new NextResponse(null, {
      status: 204,
      headers: { "Cache-Control": "no-store" },
    });
    response.cookies.set("limbus_visitor", visitor, {
      httpOnly: true,
      sameSite: "lax",
      secure: request.nextUrl.protocol === "https:",
      maxAge: 60 * 60 * 24 * 180,
      path: "/",
    });
    return response;
  } catch (e) {
    return NextResponse.json(
      { error: "Visit unavailable" },
      { status: e instanceof z.ZodError ? 400 : 503 },
    );
  }
}

import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { loadCommunityProfile } from "@/lib/community/server";
const headers = { "Cache-Control": "no-store" };
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success)
    return NextResponse.json({ error: "Not found" }, { status: 404, headers });
  try {
    const data = await loadCommunityProfile(createAdminClient(), id);
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

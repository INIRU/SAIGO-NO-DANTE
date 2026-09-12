import { requireActiveUser } from "@/lib/auth";
import { checkRequestRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { uploadImage } from "@/lib/uploads/image";
export async function POST(request: Request) {
  const auth = await requireActiveUser();
  if (auth.error) return auth.response;
  const limit = checkRequestRateLimit(request, {
    scope: "note-images",
    bucket: "create",
    authenticatedKey: auth.session.user!.email,
  });
  if (!limit.allowed) return rateLimitResponse(limit);
  return uploadImage(request, "notes");
}

import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { createAdminClient } from "@/lib/supabase/admin";
export async function uploadImage(
  request: Request,
  folder: "announcements" | "notes",
) {
  if (Number(request.headers.get("content-length")) > 9 * 1024 * 1024)
    return NextResponse.json(
      { error: "이미지는 8MB 이하로 선택해주세요." },
      { status: 413 },
    );
  try {
    const form = await request.formData();
    const file = form.get("file");
    if (
      !(file instanceof File) ||
      file.size > 8 * 1024 * 1024 ||
      !["image/png", "image/jpeg", "image/webp"].includes(file.type)
    )
      return NextResponse.json(
        { error: "8MB 이하 PNG, JPEG, WebP 이미지를 선택해주세요." },
        { status: 400 },
      );
    const input = Buffer.from(await file.arrayBuffer());
    const decoder = sharp(input, { limitInputPixels: 40000000 });
    const meta = await decoder.metadata();
    if (!["png", "jpeg", "webp"].includes(meta.format ?? ""))
      return NextResponse.json(
        { error: "지원하지 않는 이미지입니다." },
        { status: 400 },
      );
    const bytes = await decoder
      .rotate()
      .resize({
        width: 1920,
        height: 1920,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: 90 })
      .toBuffer();
    const path = `${folder}/${randomUUID()}.webp`;
    const bucket = createAdminClient().storage.from("limbus-assets");
    const { error } = await bucket.upload(path, bytes, {
      contentType: "image/webp",
      cacheControl: "31536000",
      upsert: false,
    });
    if (error) throw error;
    return NextResponse.json(
      { url: bucket.getPublicUrl(path).data.publicUrl },
      { status: 201 },
    );
  } catch {
    return NextResponse.json(
      { error: "이미지를 처리하지 못했습니다. 다른 파일로 다시 시도해주세요." },
      { status: 400 },
    );
  }
}

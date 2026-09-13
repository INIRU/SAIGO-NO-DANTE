export function isNoteImageUrl(value: unknown): value is string {
  if (typeof value !== "string") return false;
  try {
    const url = new URL(value);
    return (
      url.origin === new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).origin &&
      /^\/storage\/v1\/object\/public\/limbus-assets\/notes\/[\da-f-]{36}\.webp$/.test(
        url.pathname,
      ) &&
      !url.search &&
      !url.hash
    );
  } catch {
    return false;
  }
}
export function parseNoteImage(line: string) {
  const match = line.trim().match(/^!\[([^\]\n]*)\]\((https:\/\/[^\s)]+)\)$/);
  return match && isNoteImageUrl(match[2])
    ? { src: match[2], alt: match[1] }
    : null;
}

// Shared by mounted note editors so a save cannot silently omit an in-flight image.
export const pendingNoteUploads = new Set<string>();
export function noteUploadInProgressMessage(lang: string) {
  return lang === 'ja' ? '画像のアップロード完了後に保存してください。' : lang === 'en' ? 'Wait for image uploads to finish before saving.' : '이미지 업로드가 끝난 뒤 저장해주세요.';
}

import { createHash, randomBytes } from "node:crypto";
export const hashApiKey = (key: string) =>
  createHash("sha256").update(key).digest("hex");
export function createApiKey() {
  const key = `lmb_${randomBytes(32).toString("hex")}`;
  return { key, key_hash: hashApiKey(key), prefix: key.slice(0, 12) };
}
export function readApiKey(header: string | null) {
  const match = header?.match(/^Bearer (lmb_[a-f0-9]{64})$/);
  return match?.[1] ?? null;
}

import { deflate, inflate } from "pako";
import { planSchema, type Plan } from "./calculator";
export const COOKIE_NAME = "limbus_lunacy_v1";
const MAX_COOKIE_LENGTH = 3800;
export function encodePlans(plans: Record<string, Plan>): string {
  const json = JSON.stringify(plans);
  if (json.length > 100000) throw new Error("Plan storage limit exceeded");
  const value = btoa(String.fromCharCode(...deflate(json)))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "");
  if (value.length > MAX_COOKIE_LENGTH)
    throw new Error("Cookie storage limit exceeded");
  return value;
}
export function decodePlans(value: string): Record<string, Plan> {
  if (!value || value.length > MAX_COOKIE_LENGTH)
    throw new Error("Invalid cookie");
  const bytes = Uint8Array.from(
    atob(value.replaceAll("-", "+").replaceAll("_", "/")),
    (c) => c.charCodeAt(0),
  );
  const json = inflate(bytes, { toText: true });
  if (json.length > 100000) throw new Error("Invalid cookie");
  const raw = JSON.parse(json);
  if (
    !raw ||
    typeof raw !== "object" ||
    Array.isArray(raw) ||
    Object.keys(raw).length > 24
  )
    throw new Error("Invalid plans");
  const plans: Record<string, Plan> = {};
  for (const [month, value] of Object.entries(raw)) {
    const plan = planSchema.parse(value);
    if (month !== plan.month) throw new Error("Invalid period");
    plans[month] = plan;
  }
  return plans;
}
export function readPlans(): Record<string, Plan> {
  const value = document.cookie
    .split("; ")
    .find((c) => c.startsWith(COOKIE_NAME + "="))
    ?.slice(COOKIE_NAME.length + 1);
  return value ? decodePlans(value) : {};
}
export function savePlan(plan: Plan): void {
  const value = encodePlans({
    ...readPlans(),
    [plan.month]: planSchema.parse(plan),
  });
  document.cookie = `${COOKIE_NAME}=${value}; Path=/; Max-Age=31536000; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`;
  const saved = document.cookie
    .split("; ")
    .find((c) => c.startsWith(COOKIE_NAME + "="))
    ?.slice(COOKIE_NAME.length + 1);
  if (saved !== value) throw new Error("Cookie write blocked");
}

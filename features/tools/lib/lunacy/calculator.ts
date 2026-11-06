import { z } from "zod";
import catalog from "@/lib/generated/lunacy-products.json";

export type Product = {
  id: string;
  name: { ko: string; en: string; ja: string };
  price: number;
  paid: number;
  free: number;
  firstPaid?: number;
  dailyFree?: number;
  days?: number;
  limit: string;
  max: number;
};
export const PRODUCTS = catalog as Product[];
const DAY = 86_400_000;
export function dateNumber(date: string) {
  return Date.parse(`${date}T00:00:00Z`);
}
export function addDays(date: string, days: number) {
  return new Date(dateNumber(date) + days * DAY).toISOString().slice(0, 10);
}
export function nextMonth(month: string) {
  const [year, m] = month.split("-").map(Number);
  return new Date(Date.UTC(year, m, 1)).toISOString().slice(0, 7);
}
export function weekday(date: string) {
  return new Date(dateNumber(date)).getUTCDay();
}
export function weekKey(date: string) {
  return addDays(date, -((weekday(date) + 3) % 7));
}
export function monthDays(month: string) {
  const end = `${nextMonth(month)}-01`,
    days: string[] = [];
  for (let d = `${month}-01`; d < end; d = addDays(d, 1)) days.push(d);
  return days;
}
const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(
    (s) =>
      Number.isFinite(dateNumber(s)) &&
      new Date(dateNumber(s)).toISOString().slice(0, 10) === s,
  );
const amount = z.number().int().min(0).max(10_000_000);
const eventBase = { id: z.string().min(1).max(80), date: dateSchema };
export const eventSchema = z.discriminatedUnion("kind", [
  z.object({
    ...eventBase,
    kind: z.literal("mirror"),
    difficulty: z.enum(["normal", "hard"]),
    runs: z.number().int().min(1).max(3),
    bonuses: z.number().int().min(0).max(3),
  }),
  z.object({
    ...eventBase,
    kind: z.literal("purchase"),
    productId: z.string().refine((id) => PRODUCTS.some((p) => p.id === id)),
    first: z.boolean().optional(),
    quantity: z.number().int().min(1).max(100).optional(),
  }),
  z.object({
    ...eventBase,
    kind: z.literal("bonus"),
    label: z.string().trim().min(1).max(60),
    free: amount,
    paid: amount,
  }),
]);
export const planSchema = z.object({
  version: z.literal(1),
  month: z.string().regex(/^20\d{2}-(0[1-9]|1[0-2])$/),
  openingFree: amount,
  openingPaid: amount,
  priorBonuses: z.number().int().min(0).max(3).default(0),
  firstUsed: z.array(z.string()).max(30),
  existingDays: z.object({
    "21": z.number().int().min(0).max(60),
    "22": z.number().int().min(0).max(60),
  }),
  maintenance: z.boolean(),
  maintenanceExcluded: z.array(dateSchema).max(100),
  events: z
    .array(eventSchema)
    .max(500)
    .refine(
      (events) => new Set(events.map((e) => e.id)).size === events.length,
    ),
});
export type Plan = z.infer<typeof planSchema>;
export type CalendarEvent = z.infer<typeof eventSchema>;
export function createPlan(month: string): Plan {
  return {
    version: 1,
    month,
    openingFree: 0,
    openingPaid: 0,
    priorBonuses: 0,
    firstUsed: [],
    existingDays: { "21": 0, "22": 0 },
    maintenance: true,
    maintenanceExcluded: [],
    events: [],
  };
}
export type Reward = {
  free: number;
  paid: number;
  cash: number;
};
export type Entry = Reward & {
  id: string;
  date: string;
  kind: CalendarEvent["kind"] | "maintenance" | "daily";
  productId?: string;
  event?: CalendarEvent;
  first?: boolean;
  bonuses?: number;
  warning?: "weeklyCap" | "purchaseCap" | "membershipCap";
};
export type Day = Reward & {
  date: string;
  entries: Entry[];
  balanceFree: number;
  balancePaid: number;
};
export type Month = Reward & {
  month: string;
  balanceFree: number;
  balancePaid: number;
};
const zero = (): Reward => ({ free: 0, paid: 0, cash: 0 });
function sum(target: Reward, source: Reward) {
  for (const key of ["free", "paid", "cash"] as const)
    target[key] += source[key];
}

export function calculatePlan(plan: Plan) {
  const start = `${plan.month}-01`,
    end = `${nextMonth(nextMonth(plan.month))}-01`;
  const days: Record<string, Day> = {};
  for (let d = start; d < end; d = addDays(d, 1))
    days[d] = {
      ...zero(),
      date: d,
      entries: [],
      balanceFree: 0,
      balancePaid: 0,
    };
  const entries: Entry[] = [];
  function add(entry: Entry) {
    entries.push(entry);
    if (days[entry.date]) {
      days[entry.date].entries.push(entry);
      sum(days[entry.date], entry);
    }
  }
  // Membership periods include purchase day. Extensions add days, never duplicate daily income.
  const memberships = new Map<string, { start: string; end: string }[]>();
  for (const id of ["21", "22"] as const) {
    const remaining = plan.existingDays[id];
    memberships.set(
      id,
      remaining ? [{ start, end: addDays(start, remaining) }] : [],
    );
  }
  const usedFirst = new Set(plan.firstUsed),
    quota = new Map<string, number>(),
    mirror = new Map<string, number>();
  if (weekday(start) !== 4) mirror.set(weekKey(start), plan.priorBonuses);
  // Preserve insertion order on the same date; chronological processing shares limits across months.
  const events = plan.events
    .filter((e) => e.date >= start && e.date < end)
    .map((e, index) => ({ e, index }))
    .sort((a, b) => a.e.date.localeCompare(b.e.date) || a.index - b.index);
  for (const { e } of events) {
    const row: Entry = {
      ...zero(),
      id: e.id,
      date: e.date,
      kind: e.kind,
      event: e,
    };
    if (e.kind === "bonus") {
      row.free = e.free;
      row.paid = e.paid;
    }
    if (e.kind === "mirror") {
      const key = weekKey(e.date),
        used = mirror.get(key) || 0;
      const requested = Math.min(
        e.bonuses,
        e.runs * (e.difficulty === "hard" ? 3 : 1),
      );
      row.bonuses = Math.min(requested, Math.max(0, 3 - used));
      row.free = row.bonuses * 250;
      mirror.set(key, used + row.bonuses);
      if (row.bonuses < e.bonuses) row.warning = "weeklyCap";
    }
    if (e.kind === "purchase") {
      const product = PRODUCTS.find((p) => p.id === e.productId)!;
      row.productId = product.id;
      const key = `${product.id}:${product.limit === "weekly" ? weekKey(e.date) : product.limit === "monthly" ? e.date.slice(0, 7) : "once"}`;
      const used = quota.get(key) || 0;
      if (
        !["none", "membership"].includes(product.limit) &&
        (used >= product.max ||
          (plan.firstUsed.includes(product.id) && product.limit === "seasonal"))
      )
        row.warning = "purchaseCap";
      if (product.dailyFree) {
        const periods = memberships.get(product.id) || [],
          last = periods.at(-1);
        const starts = last && last.end > e.date ? last.end : e.date;
        if (
          (dateNumber(starts) - dateNumber(e.date)) / DAY + product.days! >
          60
        )
          row.warning = "membershipCap";
        else {
          periods.push({ start: starts, end: addDays(starts, product.days!) });
          memberships.set(product.id, periods);
        }
      }
      if (!row.warning) {
        row.first =
          product.firstPaid !== undefined && (e.first ?? !usedFirst.has(product.id));
        const quantity = product.limit === "none" ? (e.quantity ?? 1) : 1;
        row.paid = (row.first ? product.firstPaid! : product.paid) + product.paid * (quantity - 1);
        row.free = (row.first ? 0 : product.free) + product.free * (quantity - 1);
        row.cash = product.price * quantity;
        usedFirst.add(product.id);
        quota.set(key, used + 1);
      }
    }
    add(row);
  }
  for (const day of Object.values(days)) {
    if (
      plan.maintenance &&
      weekday(day.date) === 4 &&
      !plan.maintenanceExcluded.includes(day.date)
    )
      add({
        ...zero(),
        id: `maintenance-${day.date}`,
        date: day.date,
        kind: "maintenance",
        free: 300,
      });
    for (const [id, periods] of memberships)
      if (periods.some((p) => day.date >= p.start && day.date < p.end)) {
        add({
          ...zero(),
          id: `daily-${id}-${day.date}`,
          date: day.date,
          kind: "daily",
          productId: id,
          free: PRODUCTS.find((p) => p.id === id)!.dailyFree!,
        });
      }
  }
  let free = plan.openingFree,
    paid = plan.openingPaid;
  const months: Month[] = [plan.month, nextMonth(plan.month)].map((month) => ({
    ...zero(),
    month,
    balanceFree: 0,
    balancePaid: 0,
  }));
  for (const day of Object.values(days)) {
    free += day.free;
    paid += day.paid;
    day.balanceFree = free;
    day.balancePaid = paid;
    const month = months.find((m) => m.month === day.date.slice(0, 7))!;
    sum(month, day);
    month.balanceFree = free;
    month.balancePaid = paid;
  }
  return { days, months, entries };
}

export function weeklyMirrorEvents(
  plan: Plan,
  mode: "normal3" | "hard1" | "hard3",
): CalendarEvent[] {
  const dates = [
    ...monthDays(plan.month),
    ...monthDays(nextMonth(plan.month)),
  ].filter((d) => weekday(d) === 4);
  return dates
    .filter(
      (date) =>
        !plan.events.some(
          (e) => e.kind === "mirror" && weekKey(e.date) === weekKey(date),
        ),
    )
    .map((date) => ({
      id: `weekly-${date}`,
      date,
      kind: "mirror",
      difficulty: mode === "normal3" ? "normal" : "hard",
      runs: mode === "hard1" ? 1 : 3,
      bonuses: 3,
    }));
}

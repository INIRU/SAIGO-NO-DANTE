import { describe, expect, it } from "vitest";
import {
  calculatePlan,
  createPlan,
  planSchema,
  monthDays,
  weekKey,
  weeklyMirrorEvents,
  type CalendarEvent,
} from "@/lib/tools/lunacy/calculator";
const purchase = (
  id: string,
  date: string,
  productId: string,
): CalendarEvent => ({ id, date, kind: "purchase", productId });
describe("Lunacy calendar accounting", () => {
  it("counts actual Thursdays and keeps free and paid opening balances separate", () => {
    const p = createPlan("2026-09");
    p.openingFree = 100;
    p.openingPaid = 50;
    const r = calculatePlan(p);
    expect(r.months.map((m) => m.free)).toEqual([1200, 1500]);
    expect(r.months.map((m) => m.balancePaid)).toEqual([50, 50]);
    expect(r.months[1].balanceFree).toBe(2800);
  });
  it("shares first purchase status across months; repeat bonus is free currency", () => {
    const p = createPlan("2026-09");
    p.maintenance = false;
    p.events = [
      purchase("first", "2026-09-19", "6"),
      purchase("repeat", "2026-10-01", "6"),
    ];
    const r = calculatePlan(p);
    expect(r.months[0]).toMatchObject({ paid: 16672, free: 0, cash: 110000 });
    expect(r.months[1]).toMatchObject({ paid: 8336, free: 1349, cash: 110000 });
    p.firstUsed = ["6"];
    expect(calculatePlan(p).months[0].paid).toBe(8336);
  });
  it("attributes purchase to its month and distributes exactly 30 daily rewards across months", () => {
    const p = createPlan("2026-09");
    p.maintenance = false;
    p.events = [purchase("monthly", "2026-09-19", "21")];
    const r = calculatePlan(p);
    expect(r.months[0]).toMatchObject({ paid: 650, free: 12 * 65, cash: 9900 });
    expect(r.months[1]).toMatchObject({ paid: 0, free: 18 * 65, cash: 0 });
    expect(r.days["2026-10-19"].free).toBe(0);
  });
  it("extends memberships without stacking daily income and rejects more than 60 remaining days", () => {
    const p = createPlan("2026-09");
    p.maintenance = false;
    p.events = [1, 2, 3].map((i) => purchase(String(i), "2026-09-01", "21"));
    const r = calculatePlan(p);
    expect(r.entries.find((e) => e.id === "3")?.warning).toBe("membershipCap");
    expect(r.months[0].cash).toBe(19800);
    expect(r.months[0].paid).toBe(1300);
    expect(r.months[0].free + r.months[1].free).toBe(60 * 65);
  });
  it("carries existing membership days without charging again", () => {
    const p = createPlan("2026-09");
    p.maintenance = false;
    p.existingDays["22"] = 5;
    const r = calculatePlan(p);
    expect(r.months[0]).toMatchObject({ free: 195, paid: 0, cash: 0 });
  });
  it("caps weekly bonus across a month boundary and resets on Thursday", () => {
    const p = createPlan("2026-10");
    p.maintenance = false;
    p.events = [
      {
        id: "a",
        kind: "mirror",
        date: "2026-10-31",
        difficulty: "hard",
        runs: 1,
        bonuses: 3,
      },
      {
        id: "b",
        kind: "mirror",
        date: "2026-11-01",
        difficulty: "hard",
        runs: 3,
        bonuses: 3,
      },
      {
        id: "c",
        kind: "mirror",
        date: "2026-11-05",
        difficulty: "normal",
        runs: 3,
        bonuses: 3,
      },
    ];
    const r = calculatePlan(p);
    expect(r.months.map((m) => m.free)).toEqual([750, 750]);
    expect(r.entries.find((e) => e.id === "b")?.warning).toBe("weeklyCap");
    expect(weekKey("2026-11-01")).toBe("2026-10-29");
  });
  it("caps ordinary rewards by clears; three hard clears still give only 750", () => {
    const p = createPlan("2026-09");
    p.maintenance = false;
    p.events = [
      {
        id: "a",
        date: "2026-09-01",
        kind: "mirror",
        difficulty: "normal",
        runs: 1,
        bonuses: 3,
      },
      {
        id: "b",
        date: "2026-09-03",
        kind: "mirror",
        difficulty: "hard",
        runs: 3,
        bonuses: 3,
      },
    ];
    expect(calculatePlan(p).months[0].free).toBe(1000);
  });
  it("resets monthly purchase quota but keeps tickets outside Lunacy", () => {
    const p = createPlan("2026-09");
    p.maintenance = false;
    p.events = [
      purchase("a", "2026-09-01", "101"),
      purchase("b", "2026-09-02", "101"),
      purchase("c", "2026-10-01", "101"),
    ];
    expect(
      calculatePlan(p).months.map((m) => [m.paid, m.free, m.cash]),
    ).toEqual([
      [650, 0, 14000],
      [650, 0, 14000],
    ]);
  });
  it("uses calendar dates rather than a fixed 30-day month and validates saved input", () => {
    expect(monthDays("2028-02")).toHaveLength(29);
    const p = createPlan("2026-09");
    p.events = [purchase("a", "2026-02-30", "6")];
    expect(planSchema.safeParse(p).success).toBe(false);
    p.events = [purchase("a", "2026-09-01", "unknown")];
    expect(planSchema.safeParse(p).success).toBe(false);
    p.events = [];
    expect(weeklyMirrorEvents(p, "hard1")).toHaveLength(9);
    p.events = weeklyMirrorEvents(p, "hard1");
    expect(weeklyMirrorEvents(p, "hard1")).toHaveLength(0);
  });
});

it("subtracts bonuses already used before a partial first week", () => {
  const p = createPlan("2026-09");
  p.priorBonuses = 2;
  p.events = [
    {
      id: "partial",
      date: "2026-09-01",
      kind: "mirror",
      difficulty: "hard",
      runs: 1,
      bonuses: 3,
    },
    {
      id: "reset",
      date: "2026-09-03",
      kind: "mirror",
      difficulty: "hard",
      runs: 1,
      bonuses: 3,
    },
  ];
  const r = calculatePlan(p);
  expect(r.days["2026-09-01"].free).toBe(250);
  expect(r.days["2026-09-03"].free).toBe(1050);
});

it("does not count extraction tickets from legacy saved rewards", () => {
  const plan = planSchema.parse({
    ...createPlan("2026-09"),
    events: [
      {
        id: "legacy",
        kind: "bonus",
        date: "2026-09-19",
        label: "legacy",
        free: 0,
        paid: 0,
        tickets: 10,
      },
    ],
  });
  expect(plan.events[0]).not.toHaveProperty("tickets");
  expect(calculatePlan(plan).months[0]).not.toHaveProperty("tickets");
});

it('honors explicit first-purchase resets and counts repeated 110000-won packs', () => {
  const p = createPlan('2026-09'); p.maintenance = false;
  p.events = [
    { id: 'a', date: '2026-09-01', kind: 'purchase', productId: '6', first: true, quantity: 3 },
    { id: 'b', date: '2026-09-02', kind: 'purchase', productId: '6', first: false, quantity: 2 },
    { id: 'reset', date: '2026-09-03', kind: 'purchase', productId: '6', first: true, quantity: 1 },
  ];
  const r = calculatePlan(p);
  expect(r.entries.find(e => e.id === 'a')).toMatchObject({ first: true, paid: 33344, free: 2698, cash: 330000 });
  expect(r.entries.find(e => e.id === 'b')).toMatchObject({ first: false, paid: 16672, free: 2698, cash: 220000 });
  expect(r.entries.find(e => e.id === 'reset')).toMatchObject({ first: true, paid: 16672, free: 0, cash: 110000 });
  expect(planSchema.parse(JSON.parse(JSON.stringify(p))).events).toEqual(p.events);
  expect(planSchema.safeParse({ ...p, events: [{ ...p.events[0], quantity: 0 }] }).success).toBe(false);
})

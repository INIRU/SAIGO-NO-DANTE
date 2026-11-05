import { it, expect } from "vitest";
import { encodePlans, decodePlans } from "@/lib/tools/lunacy/storage";
import { createPlan, weeklyMirrorEvents } from "@/lib/tools/lunacy/calculator";
it("round trips multiple periods and two-month schedules within one cookie", () => {
  const plan = createPlan("2026-09");
  plan.events = weeklyMirrorEvents(plan, "hard1");
  plan.events.push({
    id: "p",
    date: "2026-09-19",
    kind: "purchase",
    productId: "21",
  });
  const plans = { "2026-09": plan, "2026-11": createPlan("2026-11") };
  const encoded = encodePlans(plans);
  expect(encoded.length).toBeLessThan(3800);
  expect(decodePlans(encoded)).toEqual(plans);
});
it("rejects corrupt, oversized and mismatched cookie plans", () => {
  expect(() => decodePlans("not-a-cookie")).toThrow();
  expect(() => decodePlans("a".repeat(3801))).toThrow();
  expect(() =>
    decodePlans(encodePlans({ "2026-10": createPlan("2026-09") })),
  ).toThrow();
});

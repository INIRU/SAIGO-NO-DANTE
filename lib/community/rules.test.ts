import { expect, it } from "vitest";
import { communitySettingsSchema } from "./rules";
import { inquiryAdminPatchSchema, inquirySchema } from "@/lib/support";

it("only accepts the owner profile visibility setting", () => {
  for (const data of [
    { points: 999 },
    { user_id: "other" },
    { public_profile: "true" },
    {},
    { public_profile: true, role: "admin" },
  ]) {
    expect(communitySettingsSchema.safeParse(data).success).toBe(false);
  }
  expect(
    communitySettingsSchema.safeParse({ public_profile: false }).success,
  ).toBe(true);
});
it("keeps contribution approval an explicit admin change", () => {
  expect(inquiryAdminPatchSchema.safeParse({}).success).toBe(false);
  expect(
    inquiryAdminPatchSchema.safeParse({ contribution_accepted: true }).success,
  ).toBe(true);
  expect(
    inquirySchema.parse({
      title: "Correction",
      content: "Details",
      category: "data",
      contribution_accepted: true,
    }),
  ).not.toHaveProperty("contribution_accepted");
});

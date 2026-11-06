import { expect, it } from "vitest";
import { communitySettingsSchema } from "@/features/community/lib/rules";
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
it("REQ-COMMUNITY-089 accepts the six owner settings and nothing else", () => {
  expect(communitySettingsSchema.safeParse({ notify_comments: false, notify_follows: true, notify_posts: false }).success).toBe(true);
  expect(communitySettingsSchema.safeParse({ public_following: true, public_followers: false }).success).toBe(true);
  for (const data of [{ notify_comments: "false" }, { notify_all: true }, { notifications_read_at: "2026-10-25" }])
    expect(communitySettingsSchema.safeParse(data).success).toBe(false);
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
